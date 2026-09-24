"""Testes unitarios do nucleo de desempenho.

Os valores de referencia analiticos sao calculados em forma fechada
(Anderson, 1999; Rodrigues, 2014) e comparados com a saida numerica.
"""

import math
import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine.atmosphere import RHO0, density
from engine.performance import (
    Aircraft,
    altitude_family,
    analyze,
    electric_power_required,
    landing_distance,
    max_rate_of_climb,
    stall_speed,
    takeoff_distance,
    thrust_required,
    velocity_envelope,
)
from engine.propulsion import GF_TO_N, PropellerModel, load_propeller_csv

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "propellers")


@pytest.fixture
def aircraft() -> Aircraft:
    """Aeronave de referencia: VANT classe SAE-AeroDesign ~ 8 kg."""
    return Aircraft(
        wingspan=2.4,
        chord=0.40,
        area=0.96,
        cl_max=1.8,
        cd0=0.035,
        oswald=0.80,
        empty_weight=5.0,
        payload=3.0,
        battery_capacity=16000,
        battery_voltage=22.2,
    )


@pytest.fixture
def propeller(aircraft) -> PropellerModel:
    v, t = load_propeller_csv(os.path.join(DATA_DIR, "22x10E.csv"))
    return PropellerModel(name="22x10E", diameter_in=22, pitch_in=10,
                          v_data=v, t_data=t, test_density=RHO0)


def test_isa_density_sea_level():
    assert density(0.0) == pytest.approx(1.225, abs=1e-3)


def test_isa_density_1000m():
    # valor tabelado ISA a 1000 m: 1,112 kg/m^3
    assert density(1000.0) == pytest.approx(1.112, abs=2e-3)


def test_stall_speed_closed_form(aircraft):
    rho = RHO0
    expected = math.sqrt(2 * aircraft.weight_n / (rho * aircraft.area * aircraft.cl_max))
    assert stall_speed(aircraft, rho) == pytest.approx(expected, rel=1e-12)


def test_thrust_required_minimum_at_clcd_max(aircraft):
    """T_req minima ocorre em (L/D)max e vale W/(L/D)max (Anderson, 1999)."""
    rho = RHO0
    grid = np.linspace(8.0, 40.0, 4000)
    t_min = min(thrust_required(aircraft, v, rho) for v in grid)
    ld_max = 1.0 / (2.0 * math.sqrt(aircraft.cd0 * aircraft.k_induced))
    assert t_min == pytest.approx(aircraft.weight_n / ld_max, rel=1e-3)


def test_velocity_envelope_brackets_stall(aircraft, propeller):
    v_min, v_max = velocity_envelope(aircraft, propeller, RHO0)
    assert v_min >= stall_speed(aircraft, propeller.test_density) - 1e-6
    assert v_max > v_min


def test_rate_of_climb_positive_at_sea_level(aircraft, propeller):
    rc, v_bc = max_rate_of_climb(aircraft, propeller, RHO0)
    assert rc > 0.5
    assert v_bc > stall_speed(aircraft, RHO0)


def test_rc_decreases_with_altitude(aircraft, propeller):
    rc0, _ = max_rate_of_climb(aircraft, propeller, density(0))
    rc2k, _ = max_rate_of_climb(aircraft, propeller, density(2000))
    assert rc2k < rc0


def test_takeoff_distance_increases_with_weight(propeller, aircraft):
    rho = RHO0
    s1 = takeoff_distance(aircraft, propeller, rho)
    heavier = Aircraft(**{**aircraft.__dict__, "payload": aircraft.payload + 2.0})
    s2 = takeoff_distance(heavier, propeller, rho)
    assert s2 > s1 > 0


def test_landing_distance_positive(aircraft):
    s = landing_distance(aircraft, RHO0)
    assert 0 < s < 500


def test_electric_endurance_uses_battery_energy(aircraft, propeller):
    res = analyze(aircraft, propeller, 0.0)
    p_at_best = electric_power_required(aircraft, res.v_best_endurance, density(0.0))
    assert res.endurance_h == pytest.approx(aircraft.battery_energy_wh / p_at_best, rel=1e-6)


def test_full_analysis_consistency(aircraft, propeller):
    res = analyze(aircraft, propeller, 0.0)
    assert res.v_stall <= res.v_min <= res.v_best_climb <= res.v_max
    assert res.ceiling > 0
    assert res.range_km > 0 and res.endurance_h > 0
    assert res.takeoff_distance > 0


def test_propeller_csv_static_thrust():
    v, t = load_propeller_csv(os.path.join(DATA_DIR, "20x10E.csv"))
    # primeira linha do ensaio: V=0, T=3584 gf
    assert v[0] == 0.0
    assert t[0] == pytest.approx(3584 * GF_TO_N, rel=1e-9)


def test_momentum_theory_static_thrust_order_of_magnitude():
    """Tracao estatica analitica deve ficar na ordem dos ensaios (~35 N p/ 22x10 @ 600 W)."""
    prop = PropellerModel(name="22x10E", diameter_in=22, pitch_in=10,
                          shaft_power_w=600 * 0.95 * 0.85, eta_prop=0.75,
                          motor_kv=350, battery_voltage=22.2)
    t_st = prop.static_thrust_momentum_theory(RHO0)
    assert 20.0 < t_st < 60.0


def test_altitude_family_padrao_e_explicita():
    """Sem extras, dois degraus acima; com extras, ordenada e sem repetir."""
    assert altitude_family(0.0) == [0.0, 500.0, 1000.0]
    assert altitude_family(600.0) == [600.0, 1100.0, 1600.0]
    assert altitude_family(0.0, [1500.0, 600.0]) == [0.0, 600.0, 1500.0]
    assert altitude_family(600.0, [600.0, 0.0]) == [0.0, 600.0]


def test_series_por_altitude_degradam_com_a_altitude(aircraft, propeller):
    """Tracao disponivel cai e a razao de subida encolhe quando a altitude sobe."""
    res = analyze(aircraft, propeller, 0.0, [1500.0])
    por_alt = res.curves["series_by_altitude"]
    assert sorted(por_alt) == [0.0, 1500.0]
    for s in por_alt.values():
        assert set(s) == {"speed_grid", "thrust_available", "thrust_required",
                          "power_available", "power_required", "rate_of_climb"}
    nivel_mar, alto = por_alt[0.0], por_alt[1500.0]
    assert max(alto["rate_of_climb"]) < max(nivel_mar["rate_of_climb"])
    assert alto["speed_grid"][0] > nivel_mar["speed_grid"][0]   # V_stall maior


def test_altitude_family_vazia_preserva_tres_curvas(aircraft, propeller):
    res = analyze(aircraft, propeller, 0.0)
    assert len(res.curves["series_by_altitude"]) == 3
