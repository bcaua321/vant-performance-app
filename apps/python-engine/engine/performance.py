"""Nucleo de analise de desempenho de VANTs eletricos de asa fixa.

Implementa modelos analiticos classicos de desempenho (Anderson, 1999;
Rodrigues, 2014; Sadraey, 2013):

  - velocidade de estol;
  - tracao disponivel x requerida e envelope de velocidades (V_min, V_max);
  - razao de subida maxima e teto de servico;
  - autonomia e alcance para propulsao eletrica;
  - distancias de decolagem e pouso (integracao numerica);
  - carga paga em funcao da altitude.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from .atmosphere import G0, density
from .propulsion import PropellerModel
from .takeoff_landing import (
    DEFAULT_SURFACE,
    LandingResult,
    TakeoffResult,
    landing,
    landing_wind_sweep,
    takeoff,
    takeoff_wind_sweep,
)

# criterio classico de teto de servico para pequenas aeronaves: RC = 0,5 m/s
SERVICE_CEILING_RC = 0.5
USABLE_BATTERY_FRACTION = 0.80   # profundidade de descarga segura p/ LiPo

#: altura da asa sobre a pista como fracao da envergadura, quando o usuario nao
#: a informa. Phillips usa h_w/b_w = 6/33 = 0,18 no Ex. 3.10.1 (Cessna); VANTs
#: de asa alta com trem baixo ficam proximos de 0,12.
WING_HEIGHT_RATIO = 0.12


@dataclass
class Aircraft:
    wingspan: float          # m
    chord: float             # m
    area: float              # m^2
    cl_max: float
    cd0: float
    oswald: float
    empty_weight: float      # kg
    payload: float           # kg
    battery_capacity: int    # mAh
    battery_voltage: float   # V
    eta_esc: float = 0.95
    eta_motor: float = 0.85
    eta_prop: float = 0.75
    #: fator de carga limite positivo, usado no ponto de manobra que fecha o
    #: envelope pelo lado estrutural (Rodrigues, 2014, Eq. 4.154a).
    load_factor: float = 3.8
    #: altura da asa sobre a pista [m], usada no fator de efeito solo de
    #: Phillips (Eq. 3.10.5). Zero recai na estimativa geometrica de
    #: `WING_HEIGHT_RATIO` da envergadura.
    wing_height: float = 0.0

    def __post_init__(self) -> None:
        if self.wing_height <= 0.0:
            self.wing_height = WING_HEIGHT_RATIO * self.wingspan

    @property
    def aspect_ratio(self) -> float:
        return self.wingspan ** 2 / self.area

    @property
    def k_induced(self) -> float:
        return 1.0 / (math.pi * self.oswald * self.aspect_ratio)

    @property
    def mass(self) -> float:
        return self.empty_weight + self.payload

    @property
    def weight_n(self) -> float:
        return self.mass * G0

    @property
    def eta_total(self) -> float:
        return self.eta_esc * self.eta_motor * self.eta_prop

    @property
    def battery_energy_wh(self) -> float:
        return self.battery_capacity / 1000.0 * self.battery_voltage * USABLE_BATTERY_FRACTION


@dataclass
class PerformanceResult:
    v_stall: float
    v_min: float
    v_max: float
    rc_max: float
    v_best_climb: float
    ceiling: float
    endurance_h: float
    v_best_endurance: float
    range_km: float
    v_best_range: float
    takeoff_distance: float
    landing_distance: float
    cl_cd_max: float
    density: float
    #: fator de carga limite, repetido aqui para o rotulo do envelope
    load_factor: float = 3.8
    # decomposicao por fase das manobras de solo (Phillips, 2004)
    takeoff: TakeoffResult | None = None
    landing: LandingResult | None = None
    # series para graficos
    curves: dict = field(default_factory=dict)


def stall_speed(ac: Aircraft, rho: float) -> float:
    return math.sqrt(2.0 * ac.weight_n / (rho * ac.area * ac.cl_max))


def thrust_required(ac: Aircraft, v: float, rho: float) -> float:
    q = 0.5 * rho * v * v
    return q * ac.area * ac.cd0 + ac.k_induced * ac.weight_n ** 2 / (q * ac.area)


SEARCH_V_TOP = 70.0     # topo da varredura numerica (busca de V_max, RC, teto)
PLOT_V_MARGIN = 1.15    # folga acima de V_max no dominio dos graficos


def _search_grid(ac: Aircraft, rho: float, v_top: float = SEARCH_V_TOP) -> np.ndarray:
    """Grade ampla para BUSCA numerica de V_max, RC_max e teto.

    Comeca abaixo do estol de proposito: o cruzamento T_disp x T_req pode
    ocorrer abaixo de V_stall (caso A de `Codigo 2026/desempenho.py`), e a
    deteccao precisa enxergar esse trecho para classificar o cruzamento. O
    resultado e' saturado em V_stall por `velocity_envelope`.
    """
    v_s = stall_speed(ac, rho)
    return np.linspace(max(0.5 * v_s, 1.0), v_top, 700)


def _plot_grid(ac: Aircraft, rho: float, v_max: float, n: int = 400) -> np.ndarray:
    """Grade de EXIBICAO das curvas: de V_stall ate uma folga acima de V_max.

    Segue a convencao do motor de referencia (`Codigo 2026/desempenho.py`,
    "Vetor de velocidades - inicia exatamente em v_stall"): abaixo do estol o
    voo nivelado nao existe e CL fica preso em CL_max, gerando um trecho
    artificial na curva de tracao requerida. Acima de V_max a aeronave nao voa
    nivelada, e a tracao disponivel interpolada dos ensaios cai a zero fora do
    dominio medido -- prolongar o eixo ate 70 m/s comprime todo o regime util
    do VANT em uma fracao do grafico.
    """
    v_s = stall_speed(ac, rho)
    v_top = v_max * PLOT_V_MARGIN if math.isfinite(v_max) and v_max > v_s else SEARCH_V_TOP
    return np.linspace(v_s, v_top, n)


def maneuver_speed(ac: Aircraft, rho: float) -> float:
    """Velocidade do ponto de manobra [m/s], Rodrigues (2014), Eq. (4.154a).

    `v* = v_estol * sqrt(n_max)`. E' o limite ESTRUTURAL do envelope: acima dela
    uma manobra a CL_max excede o fator de carga de projeto. Cresce com a
    altitude pelo mesmo motivo que a velocidade de estol.
    """
    return stall_speed(ac, rho) * math.sqrt(max(ac.load_factor, 1.0))


def velocity_envelope(ac: Aircraft, prop: PropellerModel, rho: float) -> tuple[float, float]:
    """(V_min, V_max) de voo nivelado: interseccoes T_disp x T_req."""
    v_s = stall_speed(ac, rho)
    grid = _search_grid(ac, rho)
    excess = np.array([prop.thrust_available(v, rho) - thrust_required(ac, v, rho) for v in grid])
    feasible = excess >= 0.0
    if not feasible.any():
        return float("nan"), float("nan")
    idx = np.where(feasible)[0]
    v_min_aero = grid[idx[0]]
    v_max = grid[idx[-1]]
    # refina V_max por bisseccao no ultimo cruzamento
    if idx[-1] + 1 < len(grid):
        lo, hi = grid[idx[-1]], grid[idx[-1] + 1]
        for _ in range(40):
            mid = 0.5 * (lo + hi)
            if prop.thrust_available(mid, rho) >= thrust_required(ac, mid, rho):
                lo = mid
            else:
                hi = mid
        v_max = lo
    return max(v_min_aero, v_s), v_max


def max_rate_of_climb(ac: Aircraft, prop: PropellerModel, rho: float) -> tuple[float, float]:
    """(RC_max [m/s], velocidade de melhor subida [m/s])."""
    v_s = stall_speed(ac, rho)
    grid = np.linspace(v_s, SEARCH_V_TOP, 600)
    rc = np.array([
        v * (prop.thrust_available(v, rho) - thrust_required(ac, v, rho)) / ac.weight_n
        for v in grid
    ])
    i = int(np.argmax(rc))
    return max(float(rc[i]), 0.0), float(grid[i])


def _ceiling_for_rc(ac: Aircraft, prop: PropellerModel, rc_target: float) -> float:
    """Altitude [m] em que RC_max cai ao valor alvo."""
    lo, hi = 0.0, 11000.0
    rc_lo, _ = max_rate_of_climb(ac, prop, density(lo))
    if rc_lo <= rc_target:
        return 0.0
    rc_hi, _ = max_rate_of_climb(ac, prop, density(hi))
    if rc_hi > rc_target:
        return hi
    for _ in range(50):
        mid = 0.5 * (lo + hi)
        rc_mid, _ = max_rate_of_climb(ac, prop, density(mid))
        if rc_mid > rc_target:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def service_ceiling(ac: Aircraft, prop: PropellerModel) -> float:
    """Altitude [m] em que RC_max cai a 0,5 m/s (teto de servico)."""
    return _ceiling_for_rc(ac, prop, SERVICE_CEILING_RC)


def absolute_ceiling(ac: Aircraft, prop: PropellerModel) -> float:
    """Altitude [m] em que RC_max cai a zero (teto absoluto).

    E' o topo do envelope de voo: V_min e V_max convergem para a velocidade de
    melhor subida, fechando a curva.
    """
    return _ceiling_for_rc(ac, prop, 0.0)


def electric_power_required(ac: Aircraft, v: float, rho: float) -> float:
    """Potencia eletrica drenada da bateria [W] em voo nivelado a v."""
    return thrust_required(ac, v, rho) * v / ac.eta_total


def endurance_and_range(ac: Aircraft, prop: PropellerModel, rho: float,
                        v_min: float, v_max: float) -> tuple[float, float, float, float]:
    """(autonomia [h], V de melhor autonomia, alcance [km], V de melhor alcance).

    Para propulsao eletrica com energia E fixa:
      autonomia maxima  -> minimo de P_eletrica(V)   (condicao CL^{3/2}/CD max)
      alcance maximo    -> minimo de P_eletrica/V    (condicao CL/CD max)
    """
    if not (math.isfinite(v_min) and math.isfinite(v_max)) or v_max <= v_min:
        return 0.0, float("nan"), 0.0, float("nan")
    grid = np.linspace(v_min, v_max, 400)
    p_elec = np.array([electric_power_required(ac, v, rho) for v in grid])
    i_end = int(np.argmin(p_elec))
    i_rng = int(np.argmin(p_elec / grid))
    e_wh = ac.battery_energy_wh
    endurance_h = e_wh / p_elec[i_end]
    range_km = e_wh / p_elec[i_rng] * grid[i_rng] * 3.6
    return float(endurance_h), float(grid[i_end]), float(range_km), float(grid[i_rng])


def takeoff_distance(ac: Aircraft, prop: PropellerModel, rho: float,
                     surface: str = DEFAULT_SURFACE, headwind: float = 0.0) -> float:
    """Distancia total de decolagem [m] ate transpor o obstaculo de 15,24 m.

    Delega a `takeoff_landing.takeoff`, que integra a corrida no solo por
    Runge-Kutta de 4a ordem e soma rotacao e subida (Phillips, 2004). Devolve
    infinito quando a aeronave nao consegue decolar.
    """
    return takeoff(ac, prop, rho, surface=surface, headwind=headwind).total


def landing_distance(ac: Aircraft, rho: float, prop: PropellerModel | None = None,
                     surface: str = DEFAULT_SURFACE, headwind: float = 0.0) -> float:
    """Distancia total de pouso [m] desde o obstaculo de 15,24 m ate a parada.

    Delega a `takeoff_landing.landing` (trecho aereo + rolagem livre + frenagem
    integrada por Runge-Kutta de 4a ordem).
    """
    return landing(ac, rho, prop=prop, surface=surface, headwind=headwind).total


PAYLOAD_SEARCH_LIMIT = 500.0   # kg: teto absoluto da busca (guarda contra laco infinito)


def max_payload_at_altitude(ac: Aircraft, prop: PropellerModel, alt: float) -> float:
    """Maior carga paga [kg] que mantem RC_max >= 0,5 m/s na altitude.

    O limite superior da bisseccao cresce ate tornar-se inviavel. Um teto fixo
    (p.ex. 3x a carga atual) e' atingido pela aeronave nas altitudes baixas e a
    funcao devolveria o proprio teto, produzindo um plato horizontal artificial
    no inicio da curva de carga paga x altitude.

    O limite e' aerodinamico e propulsivo (sustentacao e excesso de tracao); nao
    considera restricoes estruturais nem o volume util da fuselagem.
    """
    rho = density(alt)

    def rc_at(payload: float) -> float:
        test = Aircraft(**{**ac.__dict__, "payload": payload})
        return max_rate_of_climb(test, prop, rho)[0]

    if rc_at(0.0) <= SERVICE_CEILING_RC:
        return 0.0
    lo = 0.0
    hi = max(ac.payload, 1.0)
    while rc_at(hi) > SERVICE_CEILING_RC:
        lo = hi
        hi *= 2.0
        if hi > PAYLOAD_SEARCH_LIMIT:
            return PAYLOAD_SEARCH_LIMIT
    for _ in range(40):
        mid = 0.5 * (lo + hi)
        if rc_at(mid) > SERVICE_CEILING_RC:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


DEFAULT_ALTITUDE_STEPS = (500.0, 1000.0)   # degraus acima da altitude principal


def altitude_family(altitude: float, extras: list[float] | None = None) -> list[float]:
    """Altitudes plotadas nas curvas de tracao, potencia e razao de subida.

    Sem altitudes extras informadas, mantem o padrao de dois degraus acima da
    altitude de operacao. O motor de referencia do autor (`Codigo 2026`,
    inputs.py: ALTITUDES_ANALISE = [0, 600, 1500]) trata a lista de altitudes
    como entrada do estudo; aqui ela e' opcional e recai nesse padrao.
    """
    if extras:
        alts = [altitude] + [float(a) for a in extras]
    else:
        alts = [altitude] + [altitude + passo for passo in DEFAULT_ALTITUDE_STEPS]
    return sorted({round(a, 3) for a in alts})


def altitude_series(ac: Aircraft, prop: PropellerModel, alt: float) -> dict:
    """Curvas de tracao, potencia e razao de subida em uma altitude."""
    rho = density(alt)
    _, v_max = velocity_envelope(ac, prop, rho)
    vg = _plot_grid(ac, rho, v_max, n=200)
    t_av = [prop.thrust_available(v, rho) for v in vg]
    t_rq = [thrust_required(ac, v, rho) for v in vg]
    return {
        "speed_grid": vg.tolist(),
        "thrust_available": t_av,
        "thrust_required": t_rq,
        "power_available": [t * v for t, v in zip(t_av, vg)],
        "power_required": [t * v for t, v in zip(t_rq, vg)],
        # sem saturar em zero: o ponto RC = 0 e' justamente V_max, e o trecho
        # negativo alem dele deixa de ser desenhado pelo limite inferior do eixo
        "rate_of_climb": [v * (ta - tr) / ac.weight_n
                          for v, ta, tr in zip(vg, t_av, t_rq)],
    }


def analyze(ac: Aircraft, prop: PropellerModel, altitude: float,
            comparison_altitudes: list[float] | None = None,
            surface: str = DEFAULT_SURFACE) -> PerformanceResult:
    """Executa a analise completa na altitude solicitada.

    `comparison_altitudes` acrescenta altitudes as curvas dos graficos; as
    metricas continuam sendo calculadas apenas na altitude de operacao.
    `surface` seleciona os coeficientes de atrito de rolagem e frenagem.
    """
    rho = density(altitude)
    v_s = stall_speed(ac, rho)
    v_min, v_max = velocity_envelope(ac, prop, rho)
    rc_max, v_bc = max_rate_of_climb(ac, prop, rho)
    ceiling = service_ceiling(ac, prop)
    end_h, v_be, rng_km, v_br = endurance_and_range(ac, prop, rho, v_min, v_max)
    to = takeoff(ac, prop, rho, surface=surface)
    ld = landing(ac, rho, prop=prop, surface=surface)
    wind_curve = landing_wind_sweep(ac, rho, prop=prop, surface=surface)
    takeoff_wind_curve = takeoff_wind_sweep(ac, prop, rho, surface=surface)
    cl_cd_max = 1.0 / (2.0 * math.sqrt(ac.cd0 * ac.k_induced))

    # series para graficos: dominio util de voo, nao a grade de busca
    grid = _plot_grid(ac, rho, v_max)
    t_av = [prop.thrust_available(v, rho) for v in grid]
    t_rq = [thrust_required(ac, v, rho) for v in grid]
    p_av = [t * v for t, v in zip(t_av, grid)]
    p_rq = [t * v for t, v in zip(t_rq, grid)]

    alts = altitude_family(altitude, comparison_altitudes)
    series_by_altitude = {h: altitude_series(ac, prop, h) for h in alts}

    # o envelope fecha no teto ABSOLUTO (RC = 0), onde V_min e V_max convergem;
    # parar no teto de servico deixa a curva aberta com uma lacuna espuria
    ceiling_abs = absolute_ceiling(ac, prop)
    # V_min e V_max so convergem nas ultimas centenas de metros: uma grade
    # uniforme perde o fechamento e a curva sai truncada, parecendo defeito.
    # A grade abaixo adensa perto do topo (expoente 1,6 no parametro normalizado).
    topo = max(ceiling_abs, 100.0)
    env_alts = topo * (1.0 - (1.0 - np.linspace(0.0, 1.0, 60)) ** 1.6)
    env = []
    # Rodrigues (2014, Fig. 4.41): alem das interseccoes de tracao, o envelope e'
    # cortado a esquerda pelo estol (limite aerodinamico, Eq. 4.153) e a direita
    # pelo ponto de manobra (limite estrutural, Eq. 4.154a). As quatro curvas vao
    # para o grafico; a metrica `v_max` continua sendo a limitada por tracao,
    # para nao redefinir em silencio um numero ja publicado.
    for h in env_alts:
        rho_h = density(h)
        vmin_h, vmax_h = velocity_envelope(ac, prop, rho_h)
        if math.isfinite(vmin_h) and math.isfinite(vmax_h) and vmax_h > vmin_h:
            env.append((float(h), vmin_h, vmax_h,
                        stall_speed(ac, rho_h), maneuver_speed(ac, rho_h)))
    # apice: no teto absoluto sobra uma unica velocidade de voo nivelado, a de
    # melhor subida. Acrescenta-lo fecha a envoltoria em ponto, como na Fig. 4.38
    # de Rodrigues, em vez de deixar o topo reto pela ultima amostra viavel.
    if env and ceiling_abs > env[-1][0]:
        rho_top = density(ceiling_abs)
        _, v_apex = max_rate_of_climb(ac, prop, rho_top)
        env.append((float(ceiling_abs), v_apex, v_apex,
                    stall_speed(ac, rho_top), maneuver_speed(ac, rho_top)))

    pay_alts = np.linspace(0.0, max(ceiling, 100.0), 15)
    payload_curve = [
        (float(h), max_payload_at_altitude(ac, prop, float(h)))
        for h in pay_alts
    ]

    return PerformanceResult(
        v_stall=v_s,
        v_min=v_min,
        v_max=v_max,
        rc_max=rc_max,
        v_best_climb=v_bc,
        ceiling=ceiling,
        endurance_h=end_h,
        v_best_endurance=v_be,
        range_km=rng_km,
        v_best_range=v_br,
        takeoff_distance=to.total,
        landing_distance=ld.total,
        cl_cd_max=cl_cd_max,
        load_factor=ac.load_factor,
        density=rho,
        takeoff=to,
        landing=ld,
        curves={
            "landing_wind": wind_curve,
            "takeoff_wind": takeoff_wind_curve,
            "speed_grid": grid.tolist(),
            "thrust_available": t_av,
            "thrust_required": t_rq,
            "power_available": p_av,
            "power_required": p_rq,
            "series_by_altitude": series_by_altitude,
            "envelope": env,
            "payload_curve": payload_curve,
        },
    )
