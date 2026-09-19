import { describe, expect, it } from "vitest";
import {
  formatoPorcentaje,
  geometriaAnillo,
  porcentaje,
  tonoSeveridad,
  tonoVariacion,
  variacion,
} from "./metricas";

// Funciones puras detrás de las tarjetas KPI del dashboard: porcentaje del
// total, variación contra el período anterior, geometría del anillo SVG y
// tono de severidad de las barras de ranking.
describe("porcentaje", () => {
  it("devuelve la proporción con un decimal", () => {
    expect(porcentaje(16, 24)).toBe(66.7);
    expect(porcentaje(6, 24)).toBe(25);
    expect(porcentaje(2, 24)).toBe(8.3);
  });

  it("devuelve 0 cuando el total es 0 (sin dividir por cero)", () => {
    expect(porcentaje(0, 0)).toBe(0);
    expect(porcentaje(5, 0)).toBe(0);
  });
});

describe("formatoPorcentaje", () => {
  it("agrega el signo % y omite el decimal cuando es entero", () => {
    expect(formatoPorcentaje(25)).toBe("25%");
    expect(formatoPorcentaje(66.7)).toBe("66.7%");
  });
});

describe("variacion", () => {
  it("es null cuando ambos períodos valen 0 (nada que comparar)", () => {
    expect(variacion(0, 0)).toBeNull();
  });

  it("calcula la variación relativa con un decimal y su dirección", () => {
    expect(variacion(24, 18)).toEqual({ porcentaje: 33.3, direccion: "sube" });
    expect(variacion(2, 4)).toEqual({ porcentaje: 50, direccion: "baja" });
  });

  it("reporta 0 e 'igual' cuando no hay cambio", () => {
    expect(variacion(5, 5)).toEqual({ porcentaje: 0, direccion: "igual" });
  });

  it("con período anterior en 0 y actual > 0 mantiene la regla histórica de 100%", () => {
    expect(variacion(3, 0)).toEqual({ porcentaje: 100, direccion: "sube" });
  });

  it("baja al 100% cuando el período actual se vacía", () => {
    expect(variacion(0, 4)).toEqual({ porcentaje: 100, direccion: "baja" });
  });

  it("el porcentaje siempre es un valor absoluto (la dirección lleva el signo)", () => {
    expect(variacion(1, 4)?.porcentaje).toBe(75);
  });
});

describe("tonoVariacion", () => {
  it("sin cambio es neutro, invertido o no", () => {
    expect(tonoVariacion("igual", false)).toBe("neutro");
    expect(tonoVariacion("igual", true)).toBe("neutro");
  });

  it("subir es bueno salvo cuando la métrica es 'invertida' (más = peor)", () => {
    expect(tonoVariacion("sube", false)).toBe("bueno");
    expect(tonoVariacion("baja", false)).toBe("malo");
    expect(tonoVariacion("sube", true)).toBe("malo");
    expect(tonoVariacion("baja", true)).toBe("bueno");
  });
});

describe("geometriaAnillo", () => {
  it("el arco es la fracción de la circunferencia y el resto completa el trazo", () => {
    const g = geometriaAnillo(0.25, 40);
    expect(g.circunferencia).toBeCloseTo(2 * Math.PI * 40, 6);
    expect(g.arco).toBeCloseTo(g.circunferencia * 0.25, 6);
    expect(g.arco + g.resto).toBeCloseTo(g.circunferencia, 6);
  });

  it("fracción 0 no dibuja arco y fracción 1 dibuja el anillo completo", () => {
    expect(geometriaAnillo(0, 40).arco).toBe(0);
    const lleno = geometriaAnillo(1, 40);
    expect(lleno.arco).toBeCloseTo(lleno.circunferencia, 6);
    expect(lleno.resto).toBeCloseTo(0, 6);
  });

  it("acota fracciones fuera de rango y valores no finitos", () => {
    expect(geometriaAnillo(-0.5, 40).arco).toBe(0);
    expect(geometriaAnillo(3, 40).resto).toBeCloseTo(0, 6);
    expect(geometriaAnillo(Number.NaN, 40).arco).toBe(0);
  });
});

describe("tonoSeveridad", () => {
  it("escala por la proporción respecto del máximo", () => {
    expect(tonoSeveridad(8, 8)).toBe("critico");
    expect(tonoSeveridad(6, 8)).toBe("critico");
    expect(tonoSeveridad(5, 8)).toBe("serio");
    expect(tonoSeveridad(3, 8)).toBe("atencion");
    expect(tonoSeveridad(1, 8)).toBe("bajo");
  });

  it("valores iguales reciben el mismo tono (el color no depende de la posición)", () => {
    expect(tonoSeveridad(3, 8)).toBe(tonoSeveridad(3, 8));
    expect(tonoSeveridad(4, 4)).toBe("critico");
  });

  it("máximo 0 no rompe (sin datos)", () => {
    expect(tonoSeveridad(0, 0)).toBe("bajo");
  });
});
