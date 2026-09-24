"""Estudo reprodutivel de validacao do motor de desempenho.

Executa tres frentes:
  1. Regressao: saida do sistema completo (HTTP) vs execucao direta do motor;
  2. Experimental: tracao estatica calculada (teoria do momento) vs medida em bancada;
  3. Analitica: parametros do sistema vs formas fechadas da literatura
     (Anderson, 1999; Rodrigues, 2014).

Uso: python tests/validation_study.py  (requer o motor rodando em :8000)
"""

import json
import math
import os
import sys
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine.atmosphere import RHO0, density
from engine.performance import Aircraft, analyze, stall_speed
from engine.propulsion import GF_TO_N, PropellerModel, load_propeller_csv

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "propellers")
ENGINE_URL = "http://localhost:8000"

AIRCRAFT = dict(
    wingspan=2.4, chord=0.4, area=0.96, cl_max=1.8, cd0=0.035, oswald=0.8,
    empty_weight=5.0, payload=3.0, battery_capacity=16000, battery_voltage=22.2,
)

PAYLOAD_HTTP = {
    "analysisId": "validation-regression",
    "wingspan": 2.4, "chord": 0.4, "area": 0.96,
    "clMax": 1.8, "cd0": 0.035, "oswald": 0.8,
    "emptyWeight": 5.0, "payload": 3.0,
    "batteryCapacity": 16000, "batteryVoltage": 22.2, "batteryCells": 6,
    "etaEsc": 0.95, "etaMotor": 0.85, "etaProp": 0.75,
    "propellerName": "APC 22x10E", "propellerDiameter": 22, "propellerPitch": 10,
    "propellerDataFile": "22x10E.csv", "propellerTestDensity": 1.12,
    "motorName": "Dualsky ECO4120C 350KV", "motorKv": 350, "motorMaxPower": 1200,
    "altitude": 0,
}


def pct(a: float, b: float) -> float:
    return abs(a - b) / abs(b) * 100.0 if b else float("nan")


def regression_study():
    print("=" * 70)
    print("1. REGRESSAO — sistema completo (HTTP) vs execucao direta do motor")
    print("=" * 70)
    req = urllib.request.Request(
        f"{ENGINE_URL}/analyze",
        data=json.dumps(PAYLOAD_HTTP).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        http_metrics = json.load(resp)["metrics"]

    ac = Aircraft(**AIRCRAFT)
    v, t = load_propeller_csv(os.path.join(DATA_DIR, "22x10E.csv"))
    prop = PropellerModel(name="22x10E", diameter_in=22, pitch_in=10,
                          v_data=v, t_data=t, test_density=1.12)
    direct = analyze(ac, prop, 0.0)
    pairs = [
        ("V_stall (m/s)", http_metrics["vStall"], direct.v_stall),
        ("V_max (m/s)", http_metrics["vMax"], direct.v_max),
        ("RC_max (m/s)", http_metrics["rcMax"], direct.rc_max),
        ("Teto (m)", http_metrics["ceiling"], direct.ceiling),
        ("Autonomia (h)", http_metrics["endurance"], direct.endurance_h),
        ("Alcance (km)", http_metrics["range"], direct.range_km),
        ("S_decolagem (m)", http_metrics["takeoffDistance"], direct.takeoff_distance),
        ("S_pouso (m)", http_metrics["landingDistance"], direct.landing_distance),
    ]
    print(f"{'Parametro':24} {'Sistema (HTTP)':>16} {'Motor direto':>14} {'Dif (%)':>9}")
    worst = 0.0
    for label, h, d in pairs:
        e = pct(h, d)
        worst = max(worst, e)
        print(f"{label:24} {h:16.4f} {d:14.4f} {e:9.4f}")
    print(f"--> divergencia maxima: {worst:.4f}%")
    return worst


def experimental_study():
    print()
    print("=" * 70)
    print("2. EXPERIMENTAL — tracao estatica: teoria do momento vs bancada")
    print("=" * 70)
    rho_test = 1.12  # densidade media nos ensaios (Ponta Grossa, ~900 m)
    cases = [
        # (arquivo, diametro_pol, passo_pol, potencia_eletrica_W)
        ("22x10E_400W.csv", 22, 10, 400.0),
        ("22x10E_600W.csv", 22, 10, 600.0),
        ("22x12E_600W.csv", 22, 12, 600.0),
        ("24x12_580W.csv", 24, 12, 580.0),
    ]
    print(f"{'Helice':22} {'P (W)':>6} {'Medida (N)':>11} {'Calc. (N)':>10} {'Erro (%)':>9}")
    rows = []
    for fname, d, p, power in cases:
        v, t = load_propeller_csv(os.path.join(DATA_DIR, fname))
        measured = t[0]  # V = 0
        shaft = power * 0.95 * 0.85  # eta_esc * eta_motor
        prop = PropellerModel(name=fname, diameter_in=d, pitch_in=p,
                              shaft_power_w=shaft, eta_prop=0.75)
        calc = prop.static_thrust_momentum_theory(rho_test)
        e = pct(calc, measured)
        label = fname.replace(".csv", "").replace("_", " ")
        rows.append((label, power, measured, calc, e))
        print(f"{label:22} {power:6.0f} {measured:11.2f} {calc:10.2f} {e:9.2f}")
    mean_err = sum(r[4] for r in rows) / len(rows)
    print(f"--> erro medio absoluto: {mean_err:.2f}%")
    return rows, mean_err


def analytic_study():
    print()
    print("=" * 70)
    print("3. ANALITICA — sistema vs formas fechadas (Anderson, 1999)")
    print("=" * 70)
    ac = Aircraft(**AIRCRAFT)
    rho = density(0.0)
    v, t = load_propeller_csv(os.path.join(DATA_DIR, "22x10E.csv"))
    prop = PropellerModel(name="22x10E", diameter_in=22, pitch_in=10,
                          v_data=v, t_data=t, test_density=1.12)
    res = analyze(ac, prop, 0.0)

    # Formas fechadas
    w = ac.weight_n
    v_stall_cf = math.sqrt(2 * w / (rho * ac.area * ac.cl_max))
    k = ac.k_induced
    ld_max_cf = 1.0 / (2.0 * math.sqrt(ac.cd0 * k))
    # velocidade de minima potencia requerida (CL^{3/2}/CD max): CL = sqrt(3 CD0 / K)
    cl_mp = math.sqrt(3.0 * ac.cd0 / k)
    v_mp_cf = math.sqrt(2 * w / (rho * ac.area * cl_mp))
    # velocidade de (L/D)max: CL = sqrt(CD0/K)
    cl_ld = math.sqrt(ac.cd0 / k)
    v_ld_cf = math.sqrt(2 * w / (rho * ac.area * cl_ld))

    pairs = [
        ("V_stall (m/s)", res.v_stall, v_stall_cf),
        ("(L/D)max", res.cl_cd_max, ld_max_cf),
        ("V melhor autonomia (m/s)", res.v_best_endurance, v_mp_cf),
        ("V melhor alcance (m/s)", res.v_best_range, v_ld_cf),
    ]
    print(f"{'Parametro':28} {'Sistema':>10} {'Anal.':>10} {'Erro (%)':>9}")
    worst = 0.0
    for label, s, a in pairs:
        e = pct(s, a)
        worst = max(worst, e)
        print(f"{label:28} {s:10.4f} {a:10.4f} {e:9.3f}")
    print(f"--> erro maximo: {worst:.3f}%")
    return worst


if __name__ == "__main__":
    r = regression_study()
    rows, mean_err = experimental_study()
    a = analytic_study()
    print()
    print("RESUMO:")
    print(f"  regressao max: {r:.4f}% | experimental medio: {mean_err:.2f}% | analitico max: {a:.3f}%")
