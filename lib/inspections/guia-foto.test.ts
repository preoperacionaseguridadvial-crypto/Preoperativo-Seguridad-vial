import { describe, expect, it } from "vitest";
import { guiaDeFoto } from "@/lib/inspections/guia-foto";

describe("guiaDeFoto", () => {
  it("lateral de moto", () => {
    const g = guiaDeFoto("lateral", "MOTO");
    expect(g.src).toBe("/fotos-guia/lateral-moto.webp");
    expect(g.instruccion).toContain("2–3 metros");
  });
  it("lateral de carro", () => {
    expect(guiaDeFoto("lateral", "CARRO").src).toBe("/fotos-guia/lateral-carro.svg");
  });
  it("placa de moto y de carro", () => {
    expect(guiaDeFoto("placa", "MOTO").src).toBe("/fotos-guia/placa-moto.webp");
    const g = guiaDeFoto("placa", "CARRO");
    expect(g.src).toBe("/fotos-guia/placa-carro.svg");
    expect(g.instruccion).toContain("placa trasera");
  });
  it("vehículo legacy sin tipo se trata como moto", () => {
    expect(guiaDeFoto("lateral", null).src).toBe("/fotos-guia/lateral-moto.webp");
    expect(guiaDeFoto("placa", undefined).src).toBe("/fotos-guia/placa-moto.webp");
  });
});
