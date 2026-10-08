import { describe, expect, it } from "vitest";
import { avisoDecisionFirmada, urlInicioTrasFirma } from "@/lib/inspections/aviso-decision";

describe("urlInicioTrasFirma", () => {
  it("vuelve al inicio con la decisión y la placa", () => {
    expect(urlInicioTrasFirma("APROBADA", "PLS546S")).toBe("/?decision=aprobada&placa=PLS546S");
    expect(urlInicioTrasFirma("RECHAZADA", "KSR25F")).toBe("/?decision=rechazada&placa=KSR25F");
  });

  it("vuelve al inicio sin aviso si el estado no es una decisión", () => {
    expect(urlInicioTrasFirma("PENDIENTE_APROBACION", "PLS546S")).toBe("/");
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
