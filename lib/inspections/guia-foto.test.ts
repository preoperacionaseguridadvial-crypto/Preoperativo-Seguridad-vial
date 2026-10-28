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
  it("llantas de moto: reutiliza la foto de referencia de llantas de moto, con instrucción por llanta", () => {
    const delantera = guiaDeFoto("llanta_delantera", "MOTO");
    expect(delantera.src).toBe("/checklist/llantas.jpg");
    expect(delantera.instruccion).toMatch(/delantera/i);
    expect(guiaDeFoto("llanta_trasera", null).src).toBe("/checklist/llantas.jpg");
    expect(guiaDeFoto("llanta_trasera", "MOTO").instruccion).toMatch(/trasera/i);
  });
  it("llantas de carro: reutiliza la foto de referencia de llantas del carro, con instrucción por posición", () => {
    const g = guiaDeFoto("llanta_delantera_izquierda", "CARRO");
    expect(g.src).toBe("/checklist/llantas-repuesto.webp");
    expect(g.instruccion).toMatch(/delantera izquierda/i);
    expect(guiaDeFoto("llanta_trasera_derecha", "CARRO").instruccion).toMatch(/trasera derecha/i);
  });
  it("vehículo legacy sin tipo se trata como moto", () => {
    expect(guiaDeFoto("lateral", null).src).toBe("/fotos-guia/lateral-moto.webp");
    expect(guiaDeFoto("placa", undefined).src).toBe("/fotos-guia/placa-moto.webp");
  });
});
