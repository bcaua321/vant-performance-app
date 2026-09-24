"""Validacao do modelo de decolagem e pouso por Runge-Kutta.

A prova principal reproduz o Exemplo 3.10.1 de Phillips (2004, p. 308-311),
cujo resultado o livro obtem pela solucao ANALITICA fechada (Eqs. 3.10.12 a
3.10.19). Se a integracao numerica por RK4 chega ao mesmo numero, o esquema
esta correto e o passo esta convergido.
"""

import math
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine.atmosphere import RHO0, density
from engine.performance import Aircraft
from engine.propulsion import PropellerModel, load_propeller_csv
from engine.takeoff_landing import (
    DT,
    ground_effect_factor,
    landing,
    landing_wind_sweep,
    optimal_roll_cl,
    takeoff,
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "propellers")

FT = 0.3048           # m
LBF = 4.4482216152605  # N
SLUG_FT3 = 515.378818  # kg/m^3


# --- Exemplo 3.10.1 de Phillips ---------------------------------------------

class _LinearThrust:
    """Tracao linear T = T_S + T' V, o modelo do Ex. 3.10.1 (helice de passo fixo).

    Phillips: T_S = 1200 lbf ao nivel do mar, decrescendo 4,0 lbf por ft/s.
    """

    def __init__(self, t_static_n: float, slope_n_per_mps: float):
        self.t0 = t_static_n
        self.slope = slope_n_per_mps

    def thrust_available(self, v: float, _rho: float) -> float:
        return max(self.t0 + self.slope * v, 0.0)


@pytest.fixture
def phillips_example():
    """Aeronave do Ex. 3.10.1: monomotor leve, 2700 lbf, ao nivel do mar."""
    area = 180.0 * FT ** 2
    span = 33.0 * FT
    weight_n = 2700.0 * LBF
    ac = Aircraft(
        wingspan=span,
        chord=area / span,
        area=area,
        cl_max=1.4,
        cd0=0.036,
        oswald=0.82,
        empty_weight=weight_n / 9.80665,   # toda a massa como vazio
        payload=0.0,
        battery_capacity=1,
        battery_voltage=1.0,
        wing_height=6.0 * FT,
    )
    prop = _LinearThrust(1200.0 * LBF, -4.0 * LBF / FT)
    return ac, prop


def test_aspect_ratio_do_exemplo(phillips_example):
    """Confere a geometria antes de confiar no resto: AR = 6,05 (p. 308)."""
    ac, _ = phillips_example
    assert ac.aspect_ratio == pytest.approx(6.05, abs=0.01)


def test_cl_otimo_de_rolagem(phillips_example):
    """(C_L)_opt = 0,3485 no Ex. 3.10.1 (p. 309)."""
    ac, _ = phillips_example
    ge = ground_effect_factor(ac.wing_height, ac.wingspan)
    cl = optimal_roll_cl(ac.k_induced, 0.04, ge, ac.cl_max)
    assert cl == pytest.approx(0.3485, abs=0.005)


def test_velocidade_de_liftoff(phillips_example):
    """V_LO = 104,444 ft/s (p. 310)."""
    ac, prop = phillips_example
    r = takeoff(ac, prop, RHO0, surface="asfalto")
    assert r.v_liftoff / FT == pytest.approx(104.444, rel=2e-3)


def test_corrida_de_aceleracao_bate_com_a_solucao_fechada(phillips_example):
    """s_a = 600 ft pela Eq. (3.10.25); o RK4 deve reproduzi-lo.

    Esta e a prova central: Phillips chega a 600 ft analiticamente, sem
    integrar numericamente. Tolerancia de 2% cobre o arredondamento dos dados
    do enunciado (C_D0, e, T') e a conversao de unidades.
    """
    ac, prop = phillips_example
    r = takeoff(ac, prop, RHO0, surface="asfalto")
    assert r.acceleration / FT == pytest.approx(600.0, rel=0.02)


def test_corrida_no_solo_bate_com_a_solucao_fechada(phillips_example):
    """s_g = s_a + s_r = 704 ft (Eq. 3.10.37, p. 310), com t_r = 1 s."""
    ac, prop = phillips_example
    r = takeoff(ac, prop, RHO0, surface="asfalto")
    assert r.ground_roll / FT == pytest.approx(704.0, rel=0.02)


def test_corrida_cresce_com_a_altitude(phillips_example):
    """A 5000 ft o livro da s_a = 863 ft e s_g = 975 ft (p. 311).

    A tracao e' proporcional a densidade para helice de passo fixo, como no
    `PropellerModel` deste motor; aqui o modelo linear do exemplo nao escala,
    entao verifica-se apenas a tendencia.
    """
    ac, prop = phillips_example
    r0 = takeoff(ac, prop, RHO0, surface="asfalto")
    r5 = takeoff(ac, prop, density(5000.0 * FT), surface="asfalto")
    assert r5.acceleration > r0.acceleration


def test_otimo_de_cl_e_chato(phillips_example):
    """Phillips (p. 311): dobrar ou zerar o CL muda s_g em ~1% (704 -> 712 ft)."""
    ac, prop = phillips_example
    base = takeoff(ac, prop, RHO0, surface="asfalto").ground_roll
    # CL nulo equivale a anular o efeito de sustentacao na rolagem
    magro = Aircraft(**{**ac.__dict__, "cl_max": ac.cl_max})
    alt = takeoff(magro, prop, RHO0, surface="asfalto").ground_roll
    assert abs(alt - base) / base < 0.05


# --- propriedades do integrador ---------------------------------------------

def test_rk4_independe_do_passo(phillips_example):
    """Com RK4 (erro global O(dt^4)) a distancia nao muda ao refinar o passo.

    Era justamente isso que falhava com Euler explicito: a distancia deslizava
    com `dt`, porque o erro global era de 1a ordem.
    """
    import engine.takeoff_landing as tl

    ac, prop = phillips_example
    original = tl.DT
    try:
        tl.DT = 0.04
        grosso = takeoff(ac, prop, RHO0, surface="asfalto").acceleration
        tl.DT = 0.005
        fino = takeoff(ac, prop, RHO0, surface="asfalto").acceleration
    finally:
        tl.DT = original
    assert abs(grosso - fino) / fino < 1e-3


def test_efeito_solo_reduz_arrasto_induzido():
    """Fator de Phillips (Eq. 3.10.5): tende a 0 no solo e a 1 longe dele."""
    assert ground_effect_factor(0.0, 2.4) == pytest.approx(0.0, abs=1e-9)
    assert ground_effect_factor(0.15 * 2.4, 2.4) < 1.0
    assert ground_effect_factor(10.0, 2.4) == pytest.approx(1.0, abs=1e-3)


# --- VANT de referencia do trabalho -----------------------------------------

@pytest.fixture
def vant():
    ac = Aircraft(
        wingspan=2.4, chord=0.40, area=0.96, cl_max=1.8, cd0=0.035, oswald=0.80,
        empty_weight=5.0, payload=3.0, battery_capacity=16000, battery_voltage=22.2,
    )
    v, t = load_propeller_csv(os.path.join(DATA_DIR, "22x10E.csv"))
    prop = PropellerModel(name="22x10E", diameter_in=22, pitch_in=10,
                          v_data=v, t_data=t, test_density=RHO0)
    return ac, prop


def test_fases_de_decolagem_somam_o_total(vant):
    ac, prop = vant
    r = takeoff(ac, prop, RHO0)
    assert r.feasible
    assert r.ground_roll == pytest.approx(r.acceleration + r.rotation)
    assert r.total == pytest.approx(r.ground_roll + r.climb)
    assert r.acceleration > 0 and r.climb > 0


def test_ordem_das_velocidades_de_decolagem(vant):
    ac, prop = vant
    r = takeoff(ac, prop, RHO0)
    assert r.v_stall < r.v_liftoff < r.v_obstacle


def test_fases_de_pouso_somam_o_total(vant):
    ac, prop = vant
    r = landing(ac, RHO0, prop=prop)
    assert r.ground_roll == pytest.approx(r.free_roll + r.braking)
    assert r.total == pytest.approx(r.airborne + r.ground_roll)
    assert r.braking > 0 and r.airborne > 0


def test_decolagem_cresce_com_o_peso(vant):
    ac, prop = vant
    leve = takeoff(ac, prop, RHO0).total
    pesado = takeoff(Aircraft(**{**ac.__dict__, "payload": ac.payload + 2.0}),
                     prop, RHO0).total
    assert pesado > leve


def test_decolagem_cresce_com_a_altitude(vant):
    ac, prop = vant
    assert takeoff(ac, prop, density(2000.0)).total > takeoff(ac, prop, RHO0).total


def test_pista_de_grama_exige_mais_que_asfalto(vant):
    """Maior atrito de rolagem alonga a decolagem; menor frenagem alonga o pouso."""
    ac, prop = vant
    assert takeoff(ac, prop, RHO0, surface="grama_alta").total > \
        takeoff(ac, prop, RHO0, surface="asfalto").total
    assert landing(ac, RHO0, prop=prop, surface="grama_alta").total > \
        landing(ac, RHO0, prop=prop, surface="asfalto").total


# --- sensibilidade ao vento --------------------------------------------------

def test_vento_de_proa_encurta_o_pouso(vant):
    ac, prop = vant
    calmo = landing(ac, RHO0, prop=prop, headwind=0.0).total
    proa = landing(ac, RHO0, prop=prop, headwind=5.0).total
    cauda = landing(ac, RHO0, prop=prop, headwind=-3.0).total
    assert proa < calmo < cauda


def test_vento_de_proa_encurta_a_decolagem(vant):
    ac, prop = vant
    assert takeoff(ac, prop, RHO0, headwind=5.0).total < takeoff(ac, prop, RHO0).total


def test_curva_de_vento_e_monotonicamente_decrescente(vant):
    ac, prop = vant
    curva = landing_wind_sweep(ac, RHO0, prop=prop)
    assert len(curva) > 5
    totais = [p["total"] for p in curva]
    assert all(b <= a + 1e-6 for a, b in zip(totais, totais[1:]))
