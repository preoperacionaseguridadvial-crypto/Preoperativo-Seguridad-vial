import { describe, expect, it } from "vitest";
import {
  anchoBarra,
  construirGrillaSemanal,
  formatoDiaMes,
  indicesEtiquetas,
  opacidadCelda,
  rutaBarra,
  TICKS_TASA,
  ticksEje,
} from "./graficos";

// Helpers puros de los gráficos SVG a mano (barras de tendencia y heatmap):
// escalas "redondas", adelgazado de etiquetas del eje X para rangos largos
// (hasta 400 días) y la grilla de semanas lunes-primero del heatmap.
describe("ticksEje", () => {
  it("elige un paso redondo y cubre el máximo (caso del panel de referencia: 15 -> 0/5/10/15)", () => {
    expect(ticksEje(15)).toEqual([0, 5, 10, 15]);
    expect(ticksEje(7)).toEqual([0, 2, 4, 6, 8]);
    expect(ticksEje(400)).toEqual([0, 100, 200, 300, 400]);
  });

  it("nunca baja de un eje 0-1 ni produce ticks fraccionarios con conteos chicos", () => {
    expect(ticksEje(0)).toEqual([0, 1]);
    expect(ticksEje(1)).toEqual([0, 1]);
    expect(ticksEje(3)).toEqual([0, 1, 2, 3]);
  });

  it("para cualquier máximo: arranca en 0, cubre el máximo, son enteros y no hay demasiados ticks", () => {
    for (let max = 0; max <= 1000; max += 1) {
      const ticks = ticksEje(max);
      expect(ticks[0]).toBe(0);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
      expect(ticks.every(Number.isInteger)).toBe(true);
      expect(ticks.length).toBeLessThanOrEqual(6);
    }
  });
});

describe("TICKS_TASA", () => {
  it("es el eje fijo de 0 a 100 de la vista de tasa de aprobación", () => {
    expect(TICKS_TASA).toEqual([0, 25, 50, 75, 100]);
  });
});

describe("indicesEtiquetas", () => {
  it("con pocas etiquetas muestra todas", () => {
    expect(indicesEtiquetas(7, 10)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(indicesEtiquetas(0, 10)).toEqual([]);
  });

  it("adelgaza a intervalos regulares empezando por la primera", () => {
    expect(indicesEtiquetas(30, 10)).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24, 27]);
  });

  it("nunca supera el máximo, ni siquiera con el rango tope de 400 días", () => {
    for (const n of [11, 31, 90, 365, 400]) {
      const idx = indicesEtiquetas(n, 10);
      expect(idx.length).toBeLessThanOrEqual(10);
      expect(idx[0]).toBe(0);
      expect(idx.every((i) => i < n)).toBe(true);
    }
  });
});

describe("formatoDiaMes", () => {
  it("convierte una fecha ISO (YYYY-MM-DD) a dd/mm", () => {
    expect(formatoDiaMes("2026-09-18")).toBe("18/09");
    expect(formatoDiaMes("2026-01-05")).toBe("05/01");
  });
});

describe("anchoBarra", () => {
  it("nunca pasa de 24px (las barras no llenan la ranura)", () => {
    expect(anchoBarra(100)).toBe(24);
    expect(anchoBarra(20)).toBeCloseTo(14, 6);
  });

  it("con ranuras diminutas (rango largo) mantiene al menos 1px visible", () => {
    expect(anchoBarra(1.35)).toBe(1);
    expect(anchoBarra(0)).toBe(1);
  });
});

describe("rutaBarra", () => {
  it("dibuja una barra con el extremo superior redondeado y la base recta", () => {
    expect(rutaBarra({ x: 10, y: 20, ancho: 16, alto: 40 })).toBe(
      "M10 60 L10 24 Q10 20 14 20 L22 20 Q26 20 26 24 L26 60 Z",
    );
  });

  it("acota el radio a la mitad del ancho y al alto (barras finas o bajitas no se deforman)", () => {
    // ancho 4 -> radio 2 en vez de 4
    expect(rutaBarra({ x: 0, y: 0, ancho: 4, alto: 40 })).toBe("M0 40 L0 2 Q0 0 2 0 L2 0 Q4 0 4 2 L4 40 Z");
    // alto 2 -> radio 2 (no puede superar el alto)
    expect(rutaBarra({ x: 0, y: 8, ancho: 20, alto: 2 })).toBe("M0 10 L0 10 Q0 8 2 8 L18 8 Q20 8 20 10 L20 10 Z");
  });

  it("devuelve cadena vacía cuando no hay barra que dibujar", () => {
    expect(rutaBarra({ x: 0, y: 0, ancho: 10, alto: 0 })).toBe("");
    expect(rutaBarra({ x: 0, y: 0, ancho: 0, alto: 10 })).toBe("");
  });

  it("redondea coordenadas a 2 decimales", () => {
    expect(rutaBarra({ x: 0.123456, y: 0, ancho: 10, alto: 10 })).toContain("M0.12 10");
  });
});

describe("construirGrillaSemanal", () => {
  const dia = (fecha: string) => ({ fecha });

  it("arma filas de 7 columnas empezando en lunes, con huecos al inicio y al final", () => {
    // 2026-09-18 es viernes; 2026-09-21 es lunes.
    const grilla = construirGrillaSemanal([
      dia("2026-09-18"),
      dia("2026-09-19"),
      dia("2026-09-20"),
      dia("2026-09-21"),
    ]);
    expect(grilla).toHaveLength(2);
    expect(grilla[0]).toEqual([null, null, null, null, dia("2026-09-18"), dia("2026-09-19"), dia("2026-09-20")]);
    expect(grilla[1]).toEqual([dia("2026-09-21"), null, null, null, null, null, null]);
  });

  it("un rango que empieza en lunes no lleva huecos iniciales", () => {
    const grilla = construirGrillaSemanal([dia("2026-09-21"), dia("2026-09-22")]);
    expect(grilla[0][0]).toEqual(dia("2026-09-21"));
    expect(grilla[0][1]).toEqual(dia("2026-09-22"));
  });

  it("un domingo cae en la última columna", () => {
    const grilla = construirGrillaSemanal([dia("2026-09-20")]);
    expect(grilla).toHaveLength(1);
    expect(grilla[0][6]).toEqual(dia("2026-09-20"));
    expect(grilla[0].slice(0, 6).every((c) => c === null)).toBe(true);
  });

  it("sin datos devuelve una grilla vacía", () => {
    expect(construirGrillaSemanal([])).toEqual([]);
  });

  it("todas las filas tienen exactamente 7 celdas y se conservan todos los días", () => {
    const fechas = Array.from({ length: 400 }, (_, i) => {
      const d = new Date(Date.UTC(2025, 0, 1 + i));
      return dia(d.toISOString().slice(0, 10));
    });
    const grilla = construirGrillaSemanal(fechas);
    expect(grilla.every((fila) => fila.length === 7)).toBe(true);
    expect(grilla.flat().filter((c) => c !== null)).toHaveLength(400);
  });
});

describe("opacidadCelda", () => {
  it("la tasa 0 sigue siendo visible (distinta de 'sin inspecciones') y la 100 es opaca", () => {
    expect(opacidadCelda(0)).toBeCloseTo(0.15, 6);
    expect(opacidadCelda(100)).toBeCloseTo(1, 6);
    expect(opacidadCelda(50)).toBeCloseTo(0.575, 6);
  });

  it("acota tasas fuera de rango", () => {
    expect(opacidadCelda(-20)).toBeCloseTo(0.15, 6);
    expect(opacidadCelda(250)).toBeCloseTo(1, 6);
  });
});
