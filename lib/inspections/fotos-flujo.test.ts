import { describe, expect, it } from "vitest";
import { fotoDespuesDelItem } from "@/lib/inspections/fotos-flujo";

describe("fotoDespuesDelItem", () => {
  it("MOTO: la foto de las llantas va justo después del ítem Llantas", () => {
    expect(fotoDespuesDelItem("MOTO", "Llantas")).toBe("llantas");
  });

  it("un vehículo legacy sin tipo se trata como MOTO", () => {
    expect(fotoDespuesDelItem(null, "Llantas")).toBe("llantas");
  });

  it("CARRO nunca pide la foto de las llantas", () => {
    expect(fotoDespuesDelItem("CARRO", "Llantas")).toBeNull();
    expect(fotoDespuesDelItem("CARRO", "Llantas, incluye repuesto")).toBeNull();
  });

  it("otros ítems de MOTO no la piden", () => {
    expect(fotoDespuesDelItem("MOTO", "Nivel de aceite")).toBeNull();
    expect(fotoDespuesDelItem("MOTO", "Casco")).toBeNull();
  });
});
