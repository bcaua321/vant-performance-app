"""Modelo de Atmosfera Padrao Internacional (ISA) — troposfera (0 a 11.000 m).

Referencia: Anderson (1999), equacao da atmosfera-padrao na troposfera.
"""

T0 = 288.15        # K
P0 = 101325.0      # Pa
RHO0 = 1.225       # kg/m^3
LAPSE = 0.0065     # K/m
G0 = 9.80665       # m/s^2
R_AIR = 287.05     # J/(kg.K)


def temperature(altitude_m: float) -> float:
    """Temperatura ISA [K] na altitude dada [m]."""
    return T0 - LAPSE * altitude_m


def pressure(altitude_m: float) -> float:
    """Pressao ISA [Pa] na altitude dada [m]."""
    return P0 * (temperature(altitude_m) / T0) ** (G0 / (LAPSE * R_AIR))


def density(altitude_m: float) -> float:
    """Densidade do ar ISA [kg/m^3] na altitude dada [m]."""
    t = temperature(altitude_m)
    return pressure(altitude_m) / (R_AIR * t)


def sigma(altitude_m: float) -> float:
    """Razao de densidades rho/rho0."""
    return density(altitude_m) / RHO0
