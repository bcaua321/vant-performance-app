"""Desempenho de decolagem e pouso por integracao de Runge-Kutta de 4a ordem.

Substitui a integracao de Euler explicita usada anteriormente em
`performance.takeoff_distance` / `landing_distance` e decompoe as manobras nas
fases de Phillips (2004, secs. 3.10 e 3.11), em vez de considerar apenas a
corrida no solo:

  decolagem: aceleracao (s_a) + rotacao (s_r) + subida ao obstaculo (s_c)
  pouso:     trecho aereo (s_air) + rolagem livre (s_f) + frenagem (s_b)

MODELO DA CORRIDA NO SOLO
-------------------------
Problema de valor inicial em dois estados (Phillips, Eq. 3.10.1):

    d/dt [V, s] = [ (T(V) - D(V) - mu (W - L(V))) / m ,  V ]

POR QUE RUNGE-KUTTA E NAO A SOLUCAO FECHADA DE PHILLIPS
-------------------------------------------------------
Phillips integra essa equacao analiticamente (Eqs. 3.10.8 a 3.10.19), mas a
forma fechada so existe porque ele *impoe* um modelo parabolico de tracao,
T = T_0 + T' V + T'' V^2 (Eq. 3.10.7), ajustado em um unico passo pelas
Eqs. (3.10.21)-(3.10.24). O proprio autor observa (p. 304) que, para maior
exatidao, "a distancia de aceleracao deve ser dividida em muitos segmentos
pequenos".

Este motor dispoe da curva T(V) *medida em bancada* e interpolada ponto a
ponto (`propulsion.PropellerModel.thrust_available`). Forcar um ajuste
parabolico sobre dados experimentais introduziria um erro de modelagem que a
integracao numerica dispensa. RK4 (erro global O(dt^4), contra O(dt) do Euler
anterior) leva o erro de discretizacao para varias ordens de grandeza abaixo
do erro dos proprios ensaios, e permite usar a tracao medida diretamente.

A equivalencia entre as duas rotas e verificada em
`tests/test_takeoff_landing.py`, que reproduz o Exemplo 3.10.1 de Phillips
(p. 308-311) com tracao linear e confere s_a = 600 ft e s_g = 704 ft.

Referencias: Phillips (2004, secs. 3.10-3.11); Anderson (1999, cap. 6);
Rodrigues (2014, cap. 7).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable, Sequence

# --- constantes das manobras -------------------------------------------------

#: altura do obstaculo padrao [m]. Phillips (p. 315): 35 ft para transporte
#: comercial e 50 ft para aviacao geral leve e militar. VANTs de asa fixa
#: seguem a referencia de 50 ft = 15,24 m.
OBSTACLE_HEIGHT = 15.24

#: V_LOF / V_stall na soltura do solo (Phillips, Eq. 3.10.20).
K_LIFTOFF = 1.10
#: V_OC / V_stall na passagem do obstaculo (Phillips, Ex. 3.11.1, p. 321).
K_CLIMB_OUT = 1.20
#: V_ref / V_stall na aproximacao final sobre o obstaculo.
K_APPROACH = 1.30
#: V_TD / V_stall no toque (Phillips, p. 313: ~15% acima do estol).
K_TOUCHDOWN = 1.15

#: tempo de rotacao [s] (Phillips, p. 306: ~1 s para aeronaves pequenas).
ROTATION_TIME = 1.0
#: tempo de rolagem livre [s] apos o toque, antes da frenagem plena
#: (Phillips, p. 313: tipicamente 1 a 3 s). VANTs com frenagem simples ou
#: acionamento automatico ficam no extremo inferior da faixa.
FREE_ROLL_TIME = 1.5

#: coeficientes de atrito de rolagem. Phillips (p. 302) da apenas a faixa em
#: texto corrido -- 0,04 em superficie pavimentada a 0,10 em pista de grama,
#: "valores ainda maiores para pistas de solo solto" -- sem tabela por tipo de
#: pista. Os valores intermediarios abaixo interpolam essa faixa.
ROLLING_FRICTION = {
    "asfalto": 0.04,
    "concreto": 0.04,
    "grama_curta": 0.07,
    "grama_alta": 0.10,
    "terra": 0.10,
}
#: atrito com frenagem plena. Phillips (p. 313) adota mu_r ~ 0,4; o valor vale
#: para pneus em pavimento. Em grama a frenagem disponivel e menor.
BRAKING_FRICTION = {
    "asfalto": 0.40,
    "concreto": 0.40,
    "grama_curta": 0.30,
    "grama_alta": 0.20,
    "terra": 0.30,
}
DEFAULT_SURFACE = "grama_curta"

#: fracao maxima de CL_max admitida na rolagem. Phillips (p. 302): o CL de
#: rolagem "pode variar de menos de 0,1 a ate 70% de CL_max".
CL_ROLL_CAP = 0.70

#: passo de integracao [s]. Com RK4 o resultado ja esta convergido; ver
#: `test_rk4_independe_do_passo`.
DT = 0.02
#: guarda contra aeronave que nao acelera: tempo maximo de corrida [s].
MAX_ROLL_TIME = 180.0


# --- integrador --------------------------------------------------------------

def rk4_step(f: Callable[[float, Sequence[float]], Sequence[float]],
             t: float, y: Sequence[float], dt: float) -> list[float]:
    """Um passo de Runge-Kutta classico de 4a ordem para dy/dt = f(t, y).

        k1 = f(t, y)
        k2 = f(t + dt/2, y + dt k1 / 2)
        k3 = f(t + dt/2, y + dt k2 / 2)
        k4 = f(t + dt,   y + dt k3)
        y_{n+1} = y_n + dt (k1 + 2 k2 + 2 k3 + k4) / 6

    Erro local O(dt^5), global O(dt^4). Mesmo esquema do simulador longitudinal
    de referencia do autor (`AEG/decolagem.py`), aqui aplicado ao modelo de
    massa pontual da corrida no solo.
    """
    k1 = f(t, y)
    k2 = f(t + 0.5 * dt, [yi + 0.5 * dt * ki for yi, ki in zip(y, k1)])
    k3 = f(t + 0.5 * dt, [yi + 0.5 * dt * ki for yi, ki in zip(y, k2)])
    k4 = f(t + dt, [yi + dt * ki for yi, ki in zip(y, k3)])
    return [
        yi + dt * (a + 2.0 * b + 2.0 * c + d) / 6.0
        for yi, a, b, c, d in zip(y, k1, k2, k3, k4)
    ]


# --- efeito solo -------------------------------------------------------------

def ground_effect_factor(height: float, wingspan: float) -> float:
    """Fator que multiplica o arrasto induzido em efeito solo.

    Phillips (2004, Eq. 3.10.5, p. 302):

        C_D = C_D0 + [ (16 h_w/b_w)^2 / (1 + (16 h_w/b_w)^2) ] C_L^2/(pi e AR)

    `h_w` e a altura da asa sobre a pista e `b_w` a envergadura. Com a asa
    junto ao solo (h/b -> 0) o fator tende a zero e o arrasto induzido
    desaparece; para h/b >~ 0,5 o fator ja passa de 0,98 e o efeito solo e
    desprezivel.
    """
    if wingspan <= 0 or height < 0:
        return 1.0
    x = (16.0 * height / wingspan) ** 2
    return x / (1.0 + x)


def optimal_roll_cl(k_induced: float, mu_roll: float, ge: float,
                    cl_max: float) -> float:
    """CL de rolagem que minimiza D + F_r (Phillips, Ex. 3.10.1, p. 309).

        (C_L)_opt = pi e AR [1 + (16h/b)^2] / [2 (16h/b)^2] (mu_r - C_D0,L)

    Com 1/(pi e AR) = K e o termo C_D0,L nulo neste modelo de polar, e
    escrevendo o fator de efeito solo como ge = X/(1+X):

        (C_L)_opt = mu_r / (2 K ge)

    Sem efeito solo (ge -> 1) recai em mu_r/(2K), a forma usada por Rodrigues
    (2014). Phillips observa (p. 311) que o otimo e muito chato: dobrar ou
    zerar o CL altera a corrida em cerca de 1%.
    """
    if k_induced <= 0 or ge <= 1e-9:
        return min(0.1, CL_ROLL_CAP * cl_max)
    return min(mu_roll / (2.0 * k_induced * ge), CL_ROLL_CAP * cl_max)


# --- resultados --------------------------------------------------------------

@dataclass
class TakeoffResult:
    """Decomposicao da decolagem (Phillips, secs. 3.10-3.11). Distancias em m."""
    acceleration: float         # s_a: soltura dos freios ate V_LOF
    rotation: float             # s_r: rotacao, Eq. (3.10.36)
    ground_roll: float          # s_g = s_a + s_r, Eq. (3.10.37)
    climb: float                # s_c: ate o obstaculo, Eq. (3.11.13)
    total: float                # s_OC = s_g + s_c
    v_stall: float              # [m/s]
    v_liftoff: float            # [m/s]
    v_obstacle: float           # [m/s]
    climb_angle_deg: float
    time_ground_roll: float     # [s]
    feasible: bool
    #: motivo da inviabilidade, quando `feasible` e False
    limitation: str = ""
    #: historico da corrida no solo para grafico: (t [s], V [m/s], s [m])
    history: list[tuple[float, float, float]] = field(default_factory=list)


@dataclass
class LandingResult:
    """Decomposicao do pouso. Distancias em m.

    Phillips (sec. 3.10, p. 313-315) modela apenas a rolagem no solo,
    s_g = s_f + s_b (Eq. 3.10.42), a partir do toque. O trecho aereo `airborne`
    e uma extensao deste trabalho: aplica a mesma equacao de energia da subida
    de decolagem (Eq. 3.11.9) no sentido descendente, com tracao em marcha
    lenta. Sem ele a distancia de pouso nao seria comparavel ao comprimento de
    pista disponivel, que e o uso previsto no sistema.
    """
    airborne: float             # obstaculo ate o toque (extensao, ver acima)
    free_roll: float            # s_f: Eq. (3.10.41)
    braking: float              # s_b: frenagem ate a parada
    ground_roll: float          # s_g = s_f + s_b, Eq. (3.10.42)
    total: float                # s_air + s_g
    v_stall: float              # [m/s]
    v_approach: float           # [m/s]
    v_touchdown: float          # [m/s]
    descent_angle_deg: float
    time_braking: float         # [s]
    history: list[tuple[float, float, float]] = field(default_factory=list)


# --- corrida no solo ---------------------------------------------------------

def _roll_derivative(ac: "Aircraft", thrust: Callable[[float], float], rho: float,
                     mu: float, cl_roll: float, ge: float, headwind: float = 0.0):
    """Fabrica f(t, [V, s]) da corrida no solo (Phillips, Eq. 3.10.1).

    O estado `V` e a velocidade AERODINAMICA; o solo percorrido avanca a
    velocidade de SOLO, V_g = V - V_hw (Phillips, Eq. 3.10.2). Com vento de
    proa (`headwind` > 0) a aeronave ja parte de V = V_hw com o aviao parado,
    e toda a sustentacao e o arrasto respondem a V, nao a V_g -- e dai que vem
    o encurtamento da pista. Vento de cauda entra com `headwind` < 0.

    `thrust` ja embute a densidade e o ajuste de manete; `ge` e o fator de
    efeito solo, constante ao longo da corrida (a asa permanece na mesma
    altura ate a rotacao).
    """
    cd_roll = ac.cd0 + ge * ac.k_induced * cl_roll ** 2
    w = ac.weight_n
    m = ac.mass

    def f(_t: float, y: Sequence[float]) -> list[float]:
        v = max(y[0], 0.0)
        q_s = 0.5 * rho * v * v * ac.area
        lift = q_s * cl_roll
        drag = q_s * cd_roll
        friction = mu * max(w - lift, 0.0)
        return [(thrust(v) - drag - friction) / m, max(v - headwind, 0.0)]

    return f


def _integrate_roll(f, v0: float, v_end: float, accelerating: bool,
                    dt: float = DT) -> tuple[float, float, list[tuple[float, float, float]]]:
    """Integra a corrida por RK4 de `v0` a `v_end`. Devolve (distancia, tempo, historico).

    O ultimo passo e interpolado linearmente sobre a velocidade para nao
    ultrapassar `v_end` -- o erro dessa interpolacao e O(dt^2) sobre um unico
    passo e nao degrada a ordem global do esquema.
    """
    t, y = 0.0, [v0, 0.0]
    hist = [(0.0, v0, 0.0)]
    while t < MAX_ROLL_TIME:
        y_next = rk4_step(f, t, y, dt)
        # aeronave empacou: nao acelera mais (decolagem) ou nao desacelera (pouso)
        if accelerating and y_next[0] <= y[0]:
            return math.inf, math.inf, hist
        if not accelerating and y_next[0] >= y[0]:
            return math.inf, math.inf, hist
        t += dt
        reached = y_next[0] >= v_end if accelerating else y_next[0] <= v_end
        if reached:
            span = y_next[0] - y[0]
            frac = 1.0 if abs(span) < 1e-12 else (v_end - y[0]) / span
            frac = min(max(frac, 0.0), 1.0)
            s = y[1] + frac * (y_next[1] - y[1])
            t_end = t - dt + frac * dt
            hist.append((t_end, v_end, s))
            return s, t_end, hist
        y = y_next
        hist.append((t, y[0], y[1]))
    return math.inf, math.inf, hist


def _stall_speed(ac: "Aircraft", rho: float) -> float:
    return math.sqrt(2.0 * ac.weight_n / (rho * ac.area * ac.cl_max))


def _drag_at(ac: "Aircraft", v: float, rho: float, cl: float, ge: float) -> float:
    return 0.5 * rho * v * v * ac.area * (ac.cd0 + ge * ac.k_induced * cl ** 2)


# --- decolagem ---------------------------------------------------------------

def takeoff(ac: "Aircraft", prop, rho: float, surface: str = DEFAULT_SURFACE,
            obstacle: float = OBSTACLE_HEIGHT, headwind: float = 0.0) -> TakeoffResult:
    """Decolagem completa: s_OC = s_a + s_r + s_c (Phillips, secs. 3.10-3.11).

    `headwind` [m/s] positivo e vento de proa, negativo e vento de cauda.
    """
    from .atmosphere import G0

    mu = ROLLING_FRICTION.get(surface, ROLLING_FRICTION[DEFAULT_SURFACE])
    v_s = _stall_speed(ac, rho)
    v_lof = K_LIFTOFF * v_s
    v_oc = K_CLIMB_OUT * v_s
    w = ac.weight_n

    ge_ground = ground_effect_factor(ac.wing_height, ac.wingspan)
    cl_roll = optimal_roll_cl(ac.k_induced, mu, ge_ground, ac.cl_max)

    def thrust(v: float) -> float:
        return prop.thrust_available(v, rho)

    f = _roll_derivative(ac, thrust, rho, mu, cl_roll, ge_ground, headwind)
    # parada com vento de proa ja implica velocidade aerodinamica inicial V_hw
    s_a, t_a, hist = _integrate_roll(f, max(headwind, 0.0), v_lof, accelerating=True)

    if not math.isfinite(s_a):
        return TakeoffResult(
            acceleration=math.inf, rotation=math.inf, ground_roll=math.inf,
            climb=math.inf, total=math.inf, v_stall=v_s, v_liftoff=v_lof,
            v_obstacle=v_oc, climb_angle_deg=float("nan"), time_ground_roll=math.inf,
            feasible=False,
            limitation="tracao insuficiente para acelerar ate V_LOF",
            history=hist,
        )

    # rotacao a velocidade praticamente constante: s_r = (V_LOF - V_hw) t_r
    # (Phillips, Eq. 3.10.36)
    s_r = max(v_lof - headwind, 0.0) * ROTATION_TIME
    s_g = s_a + s_r

    # subida ao obstaculo pelo metodo de energia (Eqs. 3.11.11-3.11.14).
    # No obstaculo o efeito solo ja e avaliado em (h_w + h_OC)/b.
    ge_oc = ground_effect_factor(ac.wing_height + obstacle, ac.wingspan)
    t_lof, t_oc = thrust(v_lof), thrust(v_oc)
    q_oc_s = 0.5 * rho * v_oc * v_oc * ac.area
    # CL logo apos a soltura: a sustentacao equilibra o peso
    cl_lof = w / max(0.5 * rho * v_lof * v_lof * ac.area, 1e-9)
    d_lof = _drag_at(ac, v_lof, rho, cl_lof, ge_ground)

    gamma = 0.0
    d_oc = 0.0
    for _ in range(3):   # Phillips (p. 322): duas iteracoes ja convergem
        cl_oc = w * math.cos(gamma) / max(q_oc_s, 1e-9)
        d_oc = _drag_at(ac, v_oc, rho, cl_oc, ge_oc)
        arg = (t_oc - d_oc) / w
        if arg >= 1.0 or arg <= -1.0:
            break
        gamma = math.asin(arg)

    if t_oc <= d_oc:
        return TakeoffResult(
            acceleration=s_a, rotation=s_r, ground_roll=s_g, climb=math.inf,
            total=math.inf, v_stall=v_s, v_liftoff=v_lof, v_obstacle=v_oc,
            climb_angle_deg=0.0, time_ground_roll=t_a, feasible=False,
            limitation="tracao insuficiente para subir ate o obstaculo",
            history=hist,
        )

    f_bar = 0.5 * ((t_lof - d_lof) + (t_oc - d_oc) / math.cos(gamma))
    s_c = (w / f_bar) * (obstacle + (v_oc ** 2 - v_lof ** 2) / (2.0 * G0))

    return TakeoffResult(
        acceleration=s_a, rotation=s_r, ground_roll=s_g, climb=s_c,
        total=s_g + s_c, v_stall=v_s, v_liftoff=v_lof, v_obstacle=v_oc,
        climb_angle_deg=math.degrees(gamma), time_ground_roll=t_a,
        feasible=True, history=hist,
    )


# --- pouso -------------------------------------------------------------------

#: fracao da tracao estatica mantida em marcha lenta durante o pouso. Phillips
#: (p. 313) trata a tracao de marcha lenta como "pequena o bastante para ser
#: ignorada" em aeronaves sem reversor; mantida explicita e pequena para nao
#: subestimar a distancia.
IDLE_THRUST_FRACTION = 0.05


def landing(ac: "Aircraft", rho: float, prop=None, surface: str = DEFAULT_SURFACE,
            obstacle: float = OBSTACLE_HEIGHT, headwind: float = 0.0) -> LandingResult:
    """Pouso completo: s_air + s_f + s_b (Phillips, Eqs. 3.10.40-3.10.42).

    `headwind` [m/s] positivo e vento de proa, negativo e vento de cauda.
    """
    from .atmosphere import G0

    mu_b = BRAKING_FRICTION.get(surface, BRAKING_FRICTION[DEFAULT_SURFACE])
    v_s = _stall_speed(ac, rho)
    v_app = K_APPROACH * v_s
    v_td = K_TOUCHDOWN * v_s
    w = ac.weight_n

    def thrust(v: float) -> float:
        if prop is None:
            return 0.0
        return IDLE_THRUST_FRACTION * prop.thrust_available(v, rho)

    # trecho aereo: Eq. (3.11.9) no sentido descendente, com marcha lenta
    ge_air = ground_effect_factor(ac.wing_height + obstacle, ac.wingspan)
    ge_ground = ground_effect_factor(ac.wing_height, ac.wingspan)
    cl_app = w / max(0.5 * rho * v_app * v_app * ac.area, 1e-9)
    cl_td = w / max(0.5 * rho * v_td * v_td * ac.area, 1e-9)
    d_app = _drag_at(ac, v_app, rho, cl_app, ge_air)
    d_td = _drag_at(ac, v_td, rho, cl_td, ge_ground)
    f_bar = 0.5 * ((thrust(v_app) - d_app) + (thrust(v_td) - d_td))
    energy = -w * obstacle + w * (v_td ** 2 - v_app ** 2) / (2.0 * G0)
    # f_bar < 0 (arrasto supera a marcha lenta) e energy < 0: s_air > 0
    s_air = energy / f_bar if f_bar < -1e-9 else 0.0
    # o trecho aereo e percorrido em relacao ao solo: com vento de proa a
    # aeronave desce sobre um trecho de pista mais curto, na razao V_g/V
    if s_air > 0 and v_app > 1e-9:
        s_air *= max(v_app - headwind, 0.0) / v_app
    gamma = math.asin(min(max(-energy / (w * max(s_air, 1e-9)), -1.0), 1.0)) if s_air > 0 else 0.0

    # rolagem livre a velocidade constante: s_f = (V_TD - V_hw) t_f (Eq. 3.10.41)
    s_f = max(v_td - headwind, 0.0) * FREE_ROLL_TIME

    # frenagem: mesma equacao da corrida, com mu de frenagem e marcha lenta.
    # Na frenagem interessa MINIMIZAR a sustentacao residual para carregar as
    # rodas; sem spoilers o CL e o da atitude de solo, aqui o mesmo CL otimo de
    # rolagem avaliado com o atrito de frenagem (Phillips, p. 313).
    cl_brake = optimal_roll_cl(ac.k_induced, mu_b, ge_ground, ac.cl_max)
    f = _roll_derivative(ac, thrust, rho, mu_b, cl_brake, ge_ground, headwind)
    # a corrida termina com a aeronave parada EM RELACAO AO SOLO: V = V_hw
    s_b, t_b, hist = _integrate_roll(f, v_td, max(headwind, 0.0), accelerating=False)

    s_g = s_f + s_b
    return LandingResult(
        airborne=s_air, free_roll=s_f, braking=s_b, ground_roll=s_g,
        total=s_air + s_g, v_stall=v_s, v_approach=v_app, v_touchdown=v_td,
        descent_angle_deg=math.degrees(gamma), time_braking=t_b, history=hist,
    )


# --- sensibilidade ao vento --------------------------------------------------

#: faixa padrao de vento varrida na curva de pouso [m/s]. Negativo e vento de
#: cauda, positivo e vento de proa -- mesma convencao do estudo de referencia
#: do autor (`AEG/helice_analise.py`, `vels_vento = [-2, -1, 0, 1, 2]`), aqui
#: estendida e refinada para render uma curva em vez de cinco pontos.
WIND_SWEEP = tuple(round(-3.0 + 0.5 * i, 1) for i in range(23))   # -3,0 a +8,0


def takeoff_wind_sweep(ac: "Aircraft", prop, rho: float,
                       surface: str = DEFAULT_SURFACE,
                       winds: Sequence[float] = WIND_SWEEP,
                       obstacle: float = OBSTACLE_HEIGHT) -> list[dict]:
    """Distancia de decolagem em funcao do vento de proa.

    Contraparte de `landing_wind_sweep`: o vento entra pela mesma distincao
    entre velocidade aerodinamica e velocidade de solo na Eq. (3.10.1), de modo
    que a aeronave atinge V_LOF com menos pista percorrida. Permite ler as duas
    manobras de solo na mesma escala.

    Uma condicao de vento em que a aeronave nao decola devolve `total` infinito;
    cabe a quem plota descartar esses pontos.
    """
    out = []
    for hw in winds:
        r = takeoff(ac, prop, rho, surface=surface, obstacle=obstacle,
                    headwind=float(hw))
        out.append({
            "headwind": float(hw),
            "total": r.total,
            "ground_roll": r.ground_roll,
            "acceleration": r.acceleration,
            "rotation": r.rotation,
            "climb": r.climb,
            "v_liftoff": r.v_liftoff,
            "feasible": r.feasible,
        })
    return out


def landing_wind_sweep(ac: "Aircraft", rho: float, prop=None,
                       surface: str = DEFAULT_SURFACE,
                       winds: Sequence[float] = WIND_SWEEP,
                       obstacle: float = OBSTACLE_HEIGHT) -> list[dict]:
    """Distancia de pouso em funcao do vento de proa.

    O vento entra na Eq. (3.10.1) de Phillips pela distincao entre velocidade
    aerodinamica e velocidade de solo: a sustentacao, o arrasto e a frenagem
    respondem a V, mas a pista consumida avanca a V - V_hw. O resultado e uma
    curva monotonicamente decrescente com o vento de proa -- a justificativa
    operacional para pousar contra o vento.

    Devolve uma lista de dicionarios prontos para serializacao/plotagem.
    """
    out = []
    for hw in winds:
        r = landing(ac, rho, prop=prop, surface=surface, obstacle=obstacle,
                    headwind=float(hw))
        out.append({
            "headwind": float(hw),
            "total": r.total,
            "airborne": r.airborne,
            "ground_roll": r.ground_roll,
            "free_roll": r.free_roll,
            "braking": r.braking,
            "v_touchdown": r.v_touchdown,
        })
    return out
