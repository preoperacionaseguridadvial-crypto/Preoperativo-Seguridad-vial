import { describe, expect, it } from "vitest";
import { ampliarLimites, areaDeRecorte } from "@/lib/firma/recorte-firma";

describe("ampliarLimites", () => {
  it("arranca desde el primer punto cuando no hay límites previos", () => {
    expect(ampliarLimites(null, { x: 10, y: 20 })).toEqual({ minX: 10, minY: 20, maxX: 10, maxY: 20 });
  });

  it("amplía los límites para incluir cada punto nuevo", () => {
    let limites = ampliarLimites(null, { x: 50, y: 50 });
    limites = ampliarLimites(limites, { x: 10, y: 80 });
    limites = ampliarLimites(limites, { x: 90, y: 5 });
    expect(limites).toEqual({ minX: 10, minY: 5, maxX: 90, maxY: 80 });
  });
});

describe("areaDeRecorte", () => {
  const lienzo = { ancho: 600, alto: 300 };

  it("recorta al trazo más un margen", () => {
    expect(areaDeRecorte({ minX: 100, minY: 100, maxX: 300, maxY: 150 }, lienzo, 10)).toEqual({
      x: 90,
      y: 90,
      ancho: 220,
      alto: 70,
    });
  });

  it("no se sale del lienzo cuando el trazo toca los bordes", () => {
    expect(areaDeRecorte({ minX: 2, minY: 3, maxX: 598, maxY: 297 }, lienzo, 10)).toEqual({
      x: 0,
      y: 0,
      ancho: 600,
      alto: 300,
    });
  });

  it("devuelve un área mínima de 1x1 para un solo punto", () => {
    const area = areaDeRecorte({ minX: 50, minY: 50, maxX: 50, maxY: 50 }, lienzo, 0);
    expect(area.ancho).toBeGreaterThanOrEqual(1);
    expect(area.alto).toBeGreaterThanOrEqual(1);
  });

  it("devuelve el lienzo completo si no hay límites", () => {
    expect(areaDeRecorte(null, lienzo, 10)).toEqual({ x: 0, y: 0, ancho: 600, alto: 300 });
  });
});
