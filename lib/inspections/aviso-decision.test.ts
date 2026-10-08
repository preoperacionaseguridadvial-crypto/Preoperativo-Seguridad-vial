import { describe, expect, it } from "vitest";
import { avisoDecisionFirmada, urlListaTrasFirma } from "@/lib/inspections/aviso-decision";

describe("urlListaTrasFirma", () => {
  it("vuelve a la lista con la decisión y la placa", () => {
    expect(urlListaTrasFirma("APROBADA", "PLS546S")).toBe("/aprobaciones?decision=aprobada&placa=PLS546S");
    expect(urlListaTrasFirma("RECHAZADA", "KSR25F")).toBe("/aprobaciones?decision=rechazada&placa=KSR25F");
  });

  it("vuelve a la lista sin aviso si el estado no es una decisión", () => {
    expect(urlListaTrasFirma("PENDIENTE_APROBACION", "PLS546S")).toBe("/aprobaciones");
  });
});

describe("avisoDecisionFirmada", () => {
  it("arma el aviso de una aprobación", () => {
    expect(avisoDecisionFirmada({ decision: "aprobada", placa: "PLS546S" })).toEqual({
      tono: "ok",
      texto: "Inspección PLS546S aprobada y firmada.",
    });
  });

  it("arma el aviso de un rechazo", () => {
    expect(avisoDecisionFirmada({ decision: "rechazada", placa: "KSR25F" })).toEqual({
      tono: "rechazo",
      texto: "Inspección KSR25F rechazada y firmada.",
    });
  });

  it("omite la placa si no viene o no parece una placa", () => {
    expect(avisoDecisionFirmada({ decision: "aprobada" })?.texto).toBe("Inspección aprobada y firmada.");
    expect(avisoDecisionFirmada({ decision: "aprobada", placa: "<script>" })?.texto).toBe(
      "Inspección aprobada y firmada.",
    );
  });

  it("no muestra aviso con una decisión desconocida o ausente", () => {
    expect(avisoDecisionFirmada({ decision: "borrada", placa: "PLS546S" })).toBeNull();
    expect(avisoDecisionFirmada({})).toBeNull();
  });
});
