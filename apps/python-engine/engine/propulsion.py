"""Modelo do grupo moto-propulsor eletrico.

A tracao disponivel e obtida prioritariamente de dados experimentais de
ensaio (curva V x T em grama-forca, ensaios de bancada do autor). Na ausencia
de arquivo de dados, recorre-se a um modelo analitico baseado na teoria do
momento (disco atuador) com decaimento linear ate a velocidade de passo.
"""

from __future__ import annotations

import csv
import math
import os
from dataclasses import dataclass

import numpy as np

from .atmosphere import RHO0

GF_TO_N = 0.00980665   # 1 gf = 9.80665 mN
IN_TO_M = 0.0254


@dataclass
class PropellerModel:
    name: str
    diameter_in: float
    pitch_in: float
    # pontos experimentais (V [m/s], T [N]) ao nivel da densidade de ensaio
    v_data: np.ndarray | None = None
    t_data: np.ndarray | None = None
    test_density: float = RHO0
    # parametros do modelo analitico de reserva
    shaft_power_w: float = 0.0
    eta_prop: float = 0.75
    motor_kv: float = 0.0
    battery_voltage: float = 0.0

    @property
    def has_experimental_data(self) -> bool:
        return self.v_data is not None and len(self.v_data) >= 2

    def static_thrust_momentum_theory(self, rho: float) -> float:
        """Tracao estatica ideal pela teoria do momento, corrigida por eta_prop.

        T = eta * (2 * rho * A * P^2)^(1/3)   [N]
        """
        area = math.pi * (self.diameter_in * IN_TO_M / 2.0) ** 2
        p = max(self.shaft_power_w, 1e-6)
        return self.eta_prop * (2.0 * rho * area * p * p) ** (1.0 / 3.0)

    def pitch_speed(self) -> float:
        """Velocidade de passo [m/s] estimada a partir de Kv e tensao."""
        if self.motor_kv > 0 and self.battery_voltage > 0:
            rpm = 0.85 * self.motor_kv * self.battery_voltage  # queda sob carga
        else:
            rpm = 7000.0
        return self.pitch_in * IN_TO_M * rpm / 60.0

    def thrust_available(self, v: float, rho: float) -> float:
        """Tracao disponivel [N] na velocidade v [m/s] e densidade rho."""
        v = max(v, 0.0)
        if self.has_experimental_data:
            t0 = float(np.interp(v, self.v_data, self.t_data,
                                 left=self.t_data[0], right=0.0))
            return max(t0 * rho / self.test_density, 0.0)
        # modelo analitico: decaimento linear da tracao estatica ate V_pitch
        t_static = self.static_thrust_momentum_theory(rho)
        vp = max(self.pitch_speed(), 1.0)
        return max(t_static * (1.0 - v / vp), 0.0)


def load_propeller_csv(path: str) -> tuple[np.ndarray, np.ndarray]:
    """Le um CSV experimental `velocidade[m/s],tracao,...` e retorna (V, T[N]).

    Os ensaios de bancada registram tracao em grama-forca (valores na casa
    dos milhares); alguns arquivos ja estao convertidos para newtons (valores
    < 200). A unidade e detectada pela magnitude maxima da serie.
    """
    vs: list[float] = []
    ts: list[float] = []
    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.reader(fh):
            if len(row) < 2:
                continue
            try:
                v = float(row[0])
                t = float(row[1])
            except ValueError:
                continue
            vs.append(v)
            ts.append(t)
    if len(vs) < 2:
        raise ValueError(f"arquivo de helice sem dados validos: {path}")
    t_arr = np.asarray(ts)
    if t_arr.max() > 200.0:  # serie em gf
        t_arr = t_arr * GF_TO_N
    order = np.argsort(vs)
    return np.asarray(vs)[order], t_arr[order]


def build_propeller(
    *,
    name: str,
    diameter_in: float,
    pitch_in: float,
    data_file: str | None,
    data_dir: str,
    test_density: float,
    shaft_power_w: float,
    eta_prop: float,
    motor_kv: float,
    battery_voltage: float,
) -> PropellerModel:
    model = PropellerModel(
        name=name,
        diameter_in=diameter_in,
        pitch_in=pitch_in,
        test_density=test_density,
        shaft_power_w=shaft_power_w,
        eta_prop=eta_prop,
        motor_kv=motor_kv,
        battery_voltage=battery_voltage,
    )
    if data_file:
        path = data_file if os.path.isabs(data_file) else os.path.join(data_dir, data_file)
        if os.path.exists(path):
            model.v_data, model.t_data = load_propeller_csv(path)
    return model
