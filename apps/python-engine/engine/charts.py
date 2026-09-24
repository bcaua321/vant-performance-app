"""Geracao dos graficos PNG da analise (Matplotlib, backend Agg)."""

from __future__ import annotations

import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from .performance import PerformanceResult  # noqa: E402

_STYLE = {"figsize": (8, 5), "dpi": 110}

# um par de cores por altitude: (requerida, disponivel). Segue a convencao de
# `Codigo 2026/visualizacao.py` (plot_tracoes_geral / plot_potencias_geral).
_PARES = [("#d62728", "#1f77b4"), ("#9467bd", "#ffc800"), ("#2ca02c", "#17becf"),
          ("#8c564b", "#e377c2")]


def _rotulo(alt: float, varias: bool, nome: str) -> str:
    return f"{nome} {alt:.0f} m" if varias else nome


def _save(fig, path: str) -> None:
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def generate_charts(result: PerformanceResult, out_dir: str) -> dict[str, str]:
    """Gera os 5 graficos da analise e retorna {tipo: caminho_relativo}."""
    os.makedirs(out_dir, exist_ok=True)
    c = result.curves
    graphs: dict[str, str] = {}

    por_alt = c["series_by_altitude"]
    varias = len(por_alt) > 1
    v_lo = min(s["speed_grid"][0] for s in por_alt.values())
    v_hi = max(s["speed_grid"][-1] for s in por_alt.values())

    # 1. Tracao disponivel x requerida, por altitude
    fig, ax = plt.subplots(**_STYLE)
    for i, (h, s) in enumerate(por_alt.items()):
        cor_r, cor_d = _PARES[i % len(_PARES)]
        ax.plot(s["speed_grid"], s["thrust_required"], color=cor_r, lw=1.6,
                label=_rotulo(h, varias, "Tração requerida"))
        ax.plot(s["speed_grid"], s["thrust_available"], color=cor_d, lw=1.6,
                label=_rotulo(h, varias, "Tração disponível"))
    ax.axvline(result.v_stall, ls="--", color="gray", lw=0.8,
               label=f"V_stall = {result.v_stall:.1f} m/s")
    ax.set_xlabel("Velocidade (m/s)")
    ax.set_ylabel("Tração (N)")
    ax.set_title("Curvas de tração disponível e requerida")
    ax.grid(alpha=0.3)
    ax.legend(fontsize=8)
    ax.set_ylim(bottom=0)
    ax.set_xlim(v_lo, v_hi)
    _save(fig, os.path.join(out_dir, "thrust_curves.png"))
    graphs["thrust_curves"] = "thrust_curves.png"

    # 2. Potencia disponivel x requerida, por altitude
    fig, ax = plt.subplots(**_STYLE)
    for i, (h, s) in enumerate(por_alt.items()):
        cor_r, cor_d = _PARES[i % len(_PARES)]
        ax.plot(s["speed_grid"], s["power_required"], color=cor_r, lw=1.6,
                label=_rotulo(h, varias, "Potência requerida"))
        ax.plot(s["speed_grid"], s["power_available"], color=cor_d, lw=1.6,
                label=_rotulo(h, varias, "Potência disponível"))
    if result.v_best_endurance == result.v_best_endurance:  # not NaN
        ax.axvline(result.v_best_endurance, ls=":", color="green", lw=0.8,
                   label=f"V melhor autonomia = {result.v_best_endurance:.1f} m/s")
    ax.set_xlabel("Velocidade (m/s)")
    ax.set_ylabel("Potência (W)")
    ax.set_title("Curvas de potência disponível e requerida")
    ax.grid(alpha=0.3)
    ax.legend(fontsize=8)
    ax.set_ylim(bottom=0)
    ax.set_xlim(v_lo, v_hi)
    _save(fig, os.path.join(out_dir, "power_curves.png"))
    graphs["power_curves"] = "power_curves.png"

    # 3. Razao de subida x velocidade, por altitude
    fig, ax = plt.subplots(**_STYLE)
    for h, s in por_alt.items():
        ax.plot(s["speed_grid"], s["rate_of_climb"], label=f"h = {h:.0f} m")
    ax.axhline(0.5, ls="--", color="gray", lw=0.8, label="RC teto de serviço (0,5 m/s)")
    ax.set_xlabel("Velocidade (m/s)")
    ax.set_ylabel("Razão de subida (m/s)")
    ax.set_title("Razão de subida em função da velocidade")
    ax.grid(alpha=0.3)
    ax.legend(fontsize=8)
    ax.set_ylim(bottom=0)
    ax.set_xlim(v_lo, v_hi)
    _save(fig, os.path.join(out_dir, "rate_of_climb.png"))
    graphs["rate_of_climb"] = "rate_of_climb.png"

    # 4. Envelope de voo (altitude x velocidade)
    if c["envelope"]:
        alts = [e[0] for e in c["envelope"]]
        vmins = [e[1] for e in c["envelope"]]
        vmaxs = [e[2] for e in c["envelope"]]
        vstall = [e[3] for e in c["envelope"]] if len(c["envelope"][0]) > 3 else None
        vman = [e[4] for e in c["envelope"]] if len(c["envelope"][0]) > 4 else None
        fig, ax = plt.subplots(**_STYLE)
        # a regiao e' dividida no teto de servico: acima dele a aeronave ainda
        # voa, mas nao sustenta 0,5 m/s de subida. Pintar tudo com a mesma cor
        # sugeria operacao normal ate o teto absoluto.
        teto = result.ceiling if result.ceiling > 0 else max(alts)
        sob = [a <= teto for a in alts]
        # lado direito cortado pelo ponto de manobra, como na Fig. 4.41 de
        # Rodrigues (2014): a envoltoria operacional e' a intersecao do que a
        # tracao permite com o que a estrutura permite.
        vdir = [min(a, b) for a, b in zip(vmaxs, vman)] if vman else vmaxs
        ax.fill_betweenx(alts, vmins, vdir, where=sob, alpha=0.18,
                         color=_COR_AR, label="Região de operação", lw=0)
        ax.fill_betweenx(alts, vmins, vdir, where=[not s for s in sob], alpha=0.07,
                         color=_COR_SOLO, label="Acima do teto de serviço", lw=0)
        if vstall:
            ax.plot(vstall, alts, color=_COR_AR, lw=1.6,
                    label="Estol (limite aerodinâmico)")
        else:
            ax.plot(vmins, alts, color=_COR_AR, lw=1.6, label="V mínima")
        ax.plot(vmaxs, alts, color=_COR_SOLO, lw=1.6, ls=":",
                label="V máxima (limite de tração)")
        if vman:
            ax.plot(vman, alts, color=_COR_REF, lw=1.6,
                    label=f"Ponto de manobra (n = {result.load_factor:.1f})")
        if result.ceiling > 0:
            ax.axhline(result.ceiling, ls="--", color=_COR_REF, lw=1.0)
            ax.annotate(f"teto de serviço: {result.ceiling:.0f} m",
                        xy=(min(vmins), result.ceiling), xytext=(4, 4),
                        textcoords="offset points", fontsize=8,
                        color=_COR_REF, fontweight="bold")
        ax.set_xlabel("Velocidade (m/s)")
        ax.set_ylabel("Altitude (m)")
        ax.set_title("Envelope de voo")
        ax.grid(alpha=0.25)
        ax.legend(fontsize=7.5, loc="upper left", framealpha=0.92)
        _save(fig, os.path.join(out_dir, "flight_envelope.png"))
        graphs["flight_envelope"] = "flight_envelope.png"

    # 5. Carga paga x altitude
    if c["payload_curve"]:
        alts = [p[0] for p in c["payload_curve"]]
        pays = [p[1] for p in c["payload_curve"]]
        fig, ax = plt.subplots(**_STYLE)
        ax.plot(alts, pays, color="#9467bd")
        ax.set_xlabel("Altitude (m)")
        ax.set_ylabel("Carga paga máxima (kg)")
        ax.set_title("Carga paga máxima em função da altitude")
        ax.grid(alpha=0.3)
        ax.set_ylim(bottom=0)
        _save(fig, os.path.join(out_dir, "payload_altitude.png"))
        graphs["payload_altitude"] = "payload_altitude.png"

    # 6. Manobras de solo x vento de proa, decolagem e pouso lado a lado. Segue
    # o estudo de referencia do autor (`AEG/helice_analise.py`), que tabula a
    # distancia para ventos de -2 a +2 m/s; aqui a varredura vira curva.
    if c.get("takeoff_wind"):
        p = _maneuver_chart(
            c["takeoff_wind"], out_dir, "takeoff_distance.png", "Decolagem",
            "Subida ao obstáculo", result.takeoff.total if result.takeoff else None,
            (result.takeoff.ground_roll, result.takeoff.climb) if result.takeoff else None)
        if p:
            graphs["takeoff_distance"] = p
    if c.get("landing_wind"):
        p = _maneuver_chart(
            c["landing_wind"], out_dir, "landing_distance.png", "Pouso",
            "Trecho aéreo (obstáculo até o toque)",
            result.landing.total if result.landing else None,
            (result.landing.ground_roll, result.landing.airborne) if result.landing else None)
        if p:
            graphs["landing_distance"] = p

    return graphs


# cores das manobras de solo. A distincao que o leitor precisa fazer e entre
# distancia percorrida NO SOLO (pista consumida) e NO AR (sobrevoo do
# obstaculo); por isso a cor codifica a fase, nao a manobra, e vale igual nos
# dois paineis. O ambar fica reservado para a referencia de vento nulo, mantendo
# a convencao da interface de marcar so limites com ele.
_COR_SOLO = "#1a1c1b"
_COR_AR = "#008e80"
_COR_REF = "#8f5500"


def _banda(ax, x, base, topo, cor, rotulo):
    """Empilha uma fase e devolve o novo topo acumulado."""
    ax.fill_between(x, base, topo, color=cor, alpha=0.20, label=rotulo, lw=0)
    ax.plot(x, topo, color=cor, lw=1.4)
    return topo


def _marca_sem_vento(ax, total_sem_vento: float) -> None:
    """Linha de referencia em vento nulo, com o valor lido sobre a curva."""
    if total_sem_vento is None or not _finito(total_sem_vento):
        return
    ax.axvline(0.0, ls="--", color=_COR_REF, lw=0.9)
    ax.plot([0.0], [total_sem_vento], marker="o", ms=5, color=_COR_REF, zorder=5)
    ax.annotate(f"sem vento: {total_sem_vento:.0f} m",
                xy=(0.0, total_sem_vento), xytext=(7, 7),
                textcoords="offset points", fontsize=8, color=_COR_REF,
                fontweight="bold")


def _rotulo_banda(ax, x0: float, y0: float, y1: float, texto: str) -> None:
    """Escreve a espessura da fase dentro da propria banda, em vento nulo."""
    if not (_finito(y0) and _finito(y1)) or (y1 - y0) <= 0:
        return
    ax.annotate(texto, xy=(x0, (y0 + y1) / 2.0), xytext=(6, 0),
                textcoords="offset points", fontsize=7.5, va="center",
                color=_COR_SOLO, alpha=0.85)


def _finito(v: float) -> bool:
    return v == v and abs(v) != float("inf")


def _maneuver_chart(pontos: list[dict], out_dir: str, arquivo: str, titulo: str,
                    rotulo_ar: str, total_sem_vento: float | None,
                    parcelas: tuple[float, float] | None) -> str | None:
    """Uma manobra de solo x vento de proa, empilhada por fase.

    Decolagem e pouso saem em graficos separados, cada um com a propria escala:
    o pouso e' cerca de tres vezes a decolagem, e uma escala comum achatava a
    decolagem contra o eixo. A cor da fase e' a mesma nos dois, o que mantem a
    leitura comparavel sem impor a escala.
    """
    pontos = [p for p in pontos if _finito(p["total"])]
    if not pontos:
        return None

    x = [p["headwind"] for p in pontos]
    solo = [p["ground_roll"] for p in pontos]
    total = [p["total"] for p in pontos]

    fig, ax = plt.subplots(**_STYLE)
    _banda(ax, x, [0] * len(x), solo, _COR_SOLO, "No solo (pista consumida)")
    _banda(ax, x, solo, total, _COR_AR, rotulo_ar)
    _marca_sem_vento(ax, total_sem_vento)
    if parcelas:
        s, a = parcelas
        _rotulo_banda(ax, 0.0, 0.0, s, f"solo {s:.0f} m")
        _rotulo_banda(ax, 0.0, s, s + a, f"ar {a:.0f} m")

    ax.set_xlabel("Vento de proa (m/s). Negativo: vento de cauda.")
    ax.set_ylabel("Distância (m)")
    ax.set_title(f"{titulo}: distância em função do vento")
    ax.grid(alpha=0.25)
    ax.set_ylim(bottom=0)
    ax.set_xlim(min(x), max(x))
    ax.legend(fontsize=8, loc="upper right")
    _save(fig, os.path.join(out_dir, arquivo))
    return arquivo
