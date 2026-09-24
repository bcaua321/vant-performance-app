"""Microservico de calculo de desempenho de VANTs (FastAPI).

Expoe POST /analyze: recebe os parametros da aeronave, helice, motor e
condicao de voo, executa a analise completa e grava os graficos PNG em
GRAPHS_DIR/<analysis_id>/.
"""

from __future__ import annotations

import math
import os
import time

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

from engine.atmosphere import RHO0
from engine.charts import generate_charts
from engine.performance import Aircraft, analyze
from engine.propulsion import build_propeller

DATA_DIR = os.environ.get(
    "PROPELLER_DATA_DIR",
    os.path.join(os.path.dirname(__file__), "data", "propellers"),
)
GRAPHS_DIR = os.environ.get(
    "GRAPHS_DIR",
    os.path.join(os.path.dirname(__file__), "output"),
)

app = FastAPI(
    title="VANT Performance Engine",
    description="Motor de cálculo de desempenho de VANTs elétricos de asa fixa",
    version="1.0.0",
)


class AnalysisInput(BaseModel):
    analysisId: str = Field(min_length=1)
    # geometria
    wingspan: float = Field(gt=0, le=20)
    chord: float = Field(gt=0, le=5)
    area: float = Field(gt=0, le=50)
    # aerodinamica
    clMax: float = Field(ge=0.5, le=3.0)
    cd0: float = Field(ge=0.005, le=0.2)
    oswald: float = Field(ge=0.5, le=1.0)
    # fator de carga limite: fecha o envelope pelo lado estrutural
    loadFactor: float = Field(gt=1.0, le=10.0, default=3.8)
    # pesos [kg]
    emptyWeight: float = Field(gt=0)
    payload: float = Field(ge=0)
    # bateria
    batteryCapacity: int = Field(gt=0)
    batteryVoltage: float = Field(gt=0)
    batteryCells: int = Field(ge=1, le=12)
    # eficiencias
    etaEsc: float = Field(ge=0.5, le=1.0, default=0.95)
    etaMotor: float = Field(ge=0.5, le=1.0, default=0.85)
    etaProp: float = Field(ge=0.3, le=1.0, default=0.75)
    # helice
    propellerName: str
    propellerDiameter: float = Field(gt=0)   # polegadas
    propellerPitch: float = Field(gt=0)      # polegadas
    propellerDataFile: str | None = None
    propellerTestDensity: float = Field(gt=0, default=RHO0)
    # motor
    motorName: str
    motorKv: int = Field(gt=0)
    motorMaxPower: float = Field(gt=0)       # W
    # condicao
    altitude: float = Field(ge=0, le=11000)
    # altitudes extras nas curvas dos graficos (as metricas seguem na principal);
    # vazio recai no padrao de dois degraus acima (ver engine.performance)
    comparisonAltitudes: list[float] = Field(default_factory=list, max_length=3)

    @field_validator("comparisonAltitudes")
    @classmethod
    def _altitudes_validas(cls, v: list[float]) -> list[float]:
        if any(a < 0 or a > 11000 for a in v):
            raise ValueError("altitudes adicionais devem estar entre 0 e 11000 m")
        return v


class AnalysisMetrics(BaseModel):
    vStall: float
    vMin: float
    vMax: float
    rcMax: float
    vBestClimb: float
    ceiling: float
    endurance: float          # horas
    vBestEndurance: float
    range: float              # km
    vBestRange: float
    # distancias totais, do repouso ate transpor o obstaculo de 15,24 m e do
    # obstaculo ate a parada (Phillips, 2004). Mudanca de semantica em relacao
    # a versao anterior, que devolvia apenas a corrida no solo -- por isso as
    # parcelas vao explicitas abaixo.
    takeoffDistance: float    # m
    landingDistance: float    # m
    takeoffGroundRoll: float  # m: aceleracao + rotacao
    takeoffClimb: float       # m: subida ate o obstaculo
    takeoffClimbAngle: float  # graus
    landingGroundRoll: float  # m: rolagem livre + frenagem
    landingAirborne: float    # m: obstaculo ate o toque
    vLiftoff: float           # m/s
    vTouchdown: float         # m/s
    clCdMax: float
    airDensity: float
    totalWeight: float        # N
    computeTimeMs: float


class AnalysisOutput(BaseModel):
    metrics: AnalysisMetrics
    graphs: dict[str, str]
    series: dict


def _downsample(xs: list, ys: list, n: int = 120) -> list[dict]:
    """Reduz a serie a ~n pontos para os graficos interativos do frontend."""
    step = max(len(xs) // n, 1)
    return [
        {"x": round(float(x), 3), "y": round(float(y), 3)}
        for x, y in list(zip(xs, ys))[::step]
    ]


def _clean(x: float) -> float:
    """Converte NaN/inf em valores serializaveis (-1 sinaliza 'nao atingido')."""
    if x is None or not math.isfinite(x):
        return -1.0
    return float(x)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalysisOutput)
def run_analysis(params: AnalysisInput) -> AnalysisOutput:
    t0 = time.perf_counter()
    try:
        aircraft = Aircraft(
            wingspan=params.wingspan,
            chord=params.chord,
            area=params.area,
            cl_max=params.clMax,
            cd0=params.cd0,
            oswald=params.oswald,
            load_factor=params.loadFactor,
            empty_weight=params.emptyWeight,
            payload=params.payload,
            battery_capacity=params.batteryCapacity,
            battery_voltage=params.batteryVoltage,
            eta_esc=params.etaEsc,
            eta_motor=params.etaMotor,
            eta_prop=params.etaProp,
        )
        shaft_power = params.motorMaxPower * params.etaEsc * params.etaMotor
        prop = build_propeller(
            name=params.propellerName,
            diameter_in=params.propellerDiameter,
            pitch_in=params.propellerPitch,
            data_file=params.propellerDataFile,
            data_dir=DATA_DIR,
            test_density=params.propellerTestDensity,
            shaft_power_w=shaft_power,
            eta_prop=params.etaProp,
            motor_kv=params.motorKv,
            battery_voltage=params.batteryVoltage,
        )
        result = analyze(aircraft, prop, params.altitude, params.comparisonAltitudes)

        out_dir = os.path.join(GRAPHS_DIR, params.analysisId)
        graphs = generate_charts(result, out_dir)
        graphs = {k: f"{params.analysisId}/{v}" for k, v in graphs.items()}

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        metrics = AnalysisMetrics(
            vStall=_clean(result.v_stall),
            vMin=_clean(result.v_min),
            vMax=_clean(result.v_max),
            rcMax=_clean(result.rc_max),
            vBestClimb=_clean(result.v_best_climb),
            ceiling=_clean(result.ceiling),
            endurance=_clean(result.endurance_h),
            vBestEndurance=_clean(result.v_best_endurance),
            range=_clean(result.range_km),
            vBestRange=_clean(result.v_best_range),
            takeoffDistance=_clean(result.takeoff_distance),
            landingDistance=_clean(result.landing_distance),
            takeoffGroundRoll=_clean(result.takeoff.ground_roll),
            takeoffClimb=_clean(result.takeoff.climb),
            takeoffClimbAngle=_clean(result.takeoff.climb_angle_deg),
            landingGroundRoll=_clean(result.landing.ground_roll),
            landingAirborne=_clean(result.landing.airborne),
            vLiftoff=_clean(result.takeoff.v_liftoff),
            vTouchdown=_clean(result.landing.v_touchdown),
            clCdMax=_clean(result.cl_cd_max),
            airDensity=_clean(result.density),
            totalWeight=_clean(aircraft.weight_n),
            computeTimeMs=round(elapsed_ms, 1),
        )
        c = result.curves
        grid = c["speed_grid"]
        por_alt = c["series_by_altitude"]
        principal = por_alt[min(por_alt, key=lambda h: abs(h - params.altitude))]
        series = {
            "thrustAvailable": _downsample(grid, c["thrust_available"]),
            "thrustRequired": _downsample(grid, c["thrust_required"]),
            "powerAvailable": _downsample(grid, c["power_available"]),
            "powerRequired": _downsample(grid, c["power_required"]),
            "rateOfClimb": _downsample(principal["speed_grid"], principal["rate_of_climb"]),
            # RF013: a tela de resultados sobrepoe as altitudes; a de comparacao
            # (RF014) continua usando as series planas da altitude principal
            "curvesByAltitude": [
                {
                    "altitude": round(h, 1),
                    "thrustAvailable": _downsample(s["speed_grid"], s["thrust_available"]),
                    "thrustRequired": _downsample(s["speed_grid"], s["thrust_required"]),
                    "powerAvailable": _downsample(s["speed_grid"], s["power_available"]),
                    "powerRequired": _downsample(s["speed_grid"], s["power_required"]),
                    "rateOfClimb": _downsample(s["speed_grid"], s["rate_of_climb"]),
                }
                for h, s in por_alt.items()
            ],
            # vStall e vManeuver sao os limites aerodinamico e estrutural que
            # fecham o envelope em Rodrigues (2014), Fig. 4.41
            "envelope": [
                {"altitude": round(h, 1), "vMin": round(vmin, 2), "vMax": round(vmax, 2),
                 "vStall": round(vst, 2), "vManeuver": round(vman, 2)}
                for h, vmin, vmax, vst, vman in c["envelope"]
            ],
            "payloadCurve": [
                {"altitude": round(h, 1), "payload": round(p, 3)}
                for h, p in c["payload_curve"]
            ],
            # distancia de pouso x vento de proa (negativo = vento de cauda)
            "landingWind": [
                {
                    "headwind": round(p["headwind"], 2),
                    "total": round(p["total"], 2),
                    "groundRoll": round(p["ground_roll"], 2),
                    "airborne": round(p["airborne"], 2),
                }
                for p in c["landing_wind"]
            ],
            # distancia de decolagem x vento de proa, mesma convencao de sinal
            "takeoffWind": [
                {
                    "headwind": round(p["headwind"], 2),
                    "total": round(p["total"], 2),
                    "groundRoll": round(p["ground_roll"], 2),
                    "climb": round(p["climb"], 2),
                }
                for p in c["takeoff_wind"]
                if p["total"] == p["total"] and abs(p["total"]) != float("inf")
            ],
        }
        return AnalysisOutput(metrics=metrics, graphs=graphs, series=series)
    except HTTPException:
        raise
    except Exception as exc:  # devolve a causa ao worker (RNF007)
        raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}") from exc
