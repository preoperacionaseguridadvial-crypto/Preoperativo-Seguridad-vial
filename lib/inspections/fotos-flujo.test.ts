import { describe, expect, it } from "vitest";
import {
  esFotoLlantaDeVehiculo,
  etiquetaFotoLlanta,
  fotoDespuesDelItem,
  llantasDeVehiculo,
} from "@/lib/inspections/fotos-flujo";

describe("fotoDespuesDelItem", () => {
  it("MOTO: la foto de las llantas va justo después del ítem Llantas", () => {
    expect(fotoDespuesDelItem("MOTO", "Llantas")).toBe("llantas");
  });

  it("un vehículo legacy sin tipo se trata como MOTO", () => {
    expect(fotoDespuesDelItem(null, "Llantas")).toBe("llantas");
  });

  it("CARRO: la foto de las llantas va después de 'Llantas, incluye repuesto'", () => {
    expect(fotoDespuesDelItem("CARRO", "Llantas, incluye repuesto")).toBe("llantas");
  });

  it("cada tipo de vehículo solo reconoce el nombre de su propio ítem", () => {
    expect(fotoDespuesDelItem("CARRO", "Llantas")).toBeNull();
    expect(fotoDespuesDelItem("MOTO", "Llantas, incluye repuesto")).toBeNull();
  });

  it("otros ítems no la piden", () => {
    expect(fotoDespuesDelItem("MOTO", "Nivel de aceite")).toBeNull();
    expect(fotoDespuesDelItem("MOTO", "Casco")).toBeNull();
    expect(fotoDespuesDelItem("CARRO", "Luces")).toBeNull();
  });
});

describe("llantasDeVehiculo", () => {
  it("MOTO pide 2 fotos: delantera y trasera", () => {
    expect(llantasDeVehiculo("MOTO")).toEqual(["LLANTA_DELANTERA", "LLANTA_TRASERA"]);
  });

  it("un vehículo legacy sin tipo se trata como MOTO", () => {
    expect(llantasDeVehiculo(null)).toEqual(["LLANTA_DELANTERA", "LLANTA_TRASERA"]);
    expect(llantasDeVehiculo(undefined)).toEqual(["LLANTA_DELANTERA", "LLANTA_TRASERA"]);
  });

  it("CARRO pide 4 fotos, en orden de posición", () => {
    expect(llantasDeVehiculo("CARRO")).toEqual([
      "LLANTA_DELANTERA_IZQUIERDA",
      "LLANTA_DELANTERA_DERECHA",
      "LLANTA_TRASERA_IZQUIERDA",
      "LLANTA_TRASERA_DERECHA",
    ]);
  });
});

describe("esFotoLlantaDeVehiculo", () => {
  it("MOTO acepta solo sus 2 tipos", () => {
    expect(esFotoLlantaDeVehiculo("MOTO", "LLANTA_DELANTERA")).toBe(true);
    expect(esFotoLlantaDeVehiculo("MOTO", "LLANTA_TRASERA")).toBe(true);
    expect(esFotoLlantaDeVehiculo("MOTO", "LLANTA_DELANTERA_IZQUIERDA")).toBe(false);
  });

  it("CARRO acepta solo sus 4 tipos", () => {
    expect(esFotoLlantaDeVehiculo("CARRO", "LLANTA_TRASERA_DERECHA")).toBe(true);
    expect(esFotoLlantaDeVehiculo("CARRO", "LLANTA_DELANTERA")).toBe(false);
  });

  it("la foto legado LLANTAS ya no es válida para nadie", () => {
    expect(esFotoLlantaDeVehiculo("MOTO", "LLANTAS")).toBe(false);
    expect(esFotoLlantaDeVehiculo("CARRO", "LLANTAS")).toBe(false);
    expect(esFotoLlantaDeVehiculo(null, "LLANTAS")).toBe(false);
  });
});

describe("etiquetaFotoLlanta", () => {
  it("rotula cada posición", () => {
    expect(etiquetaFotoLlanta("LLANTA_DELANTERA")).toBe("Llanta delantera");
    expect(etiquetaFotoLlanta("LLANTA_TRASERA")).toBe("Llanta trasera");
    expect(etiquetaFotoLlanta("LLANTA_DELANTERA_IZQUIERDA")).toBe("Llanta delantera izquierda");
    expect(etiquetaFotoLlanta("LLANTA_DELANTERA_DERECHA")).toBe("Llanta delantera derecha");
    expect(etiquetaFotoLlanta("LLANTA_TRASERA_IZQUIERDA")).toBe("Llanta trasera izquierda");
    expect(etiquetaFotoLlanta("LLANTA_TRASERA_DERECHA")).toBe("Llanta trasera derecha");
  });
});
