import { describe, expect, it } from "vitest";
import { mergeSeries } from "./performance-charts";

/*
 * Regressao: com `data` so nos <Line> e nenhum no <LineChart>, o eixo numerico
 * resolve `dataKey="x"` contra o data do grafico, o dominio colapsa e a area de
 * plotagem sai vazia. mergeSeries e' o que mantem um dataset unico no grafico.
 */
describe("mergeSeries", () => {
  it("funde series que compartilham o mesmo x", () => {
    const merged = mergeSeries([
      { name: "a", color: "#000", points: [{ x: 1, y: 10 }, { x: 2, y: 20 }] },
      { name: "b", color: "#111", points: [{ x: 1, y: 30 }, { x: 2, y: 40 }] },
    ]);
    expect(merged).toEqual([
      { x: 1, s0: 10, s1: 30 },
      { x: 2, s0: 20, s1: 40 },
    ]);
  });

  it("ordena por x e preenche apenas as series presentes em cada ponto", () => {
    const merged = mergeSeries([
      { name: "a", color: "#000", points: [{ x: 3, y: 1 }, { x: 1, y: 2 }] },
      { name: "b", color: "#111", points: [{ x: 2, y: 5 }] },
    ]);
    expect(merged.map((p) => p.x)).toEqual([1, 2, 3]);
    expect(merged[1]).toEqual({ x: 2, s1: 5 });
  });

  it("preserva o dominio completo de series com grades diferentes", () => {
    // Curvas por altitude nao compartilham a grade de velocidades.
    const merged = mergeSeries([
      { name: "0 m", color: "#000", points: [{ x: 8.6, y: 1 }, { x: 19.4, y: 2 }] },
      { name: "600 m", color: "#111", points: [{ x: 9.1, y: 3 }, { x: 18.2, y: 4 }] },
    ]);
    expect(merged[0].x).toBe(8.6);
    expect(merged[merged.length - 1].x).toBe(19.4);
  });
});
