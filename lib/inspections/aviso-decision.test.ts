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

  it("la aprobación de la primera etapa avisa que se envió al Director (el estado no cambia)", () => {
    expect(urlInicioTrasFirma("PENDIENTE_APROBACION", "KSR25F", true)).toBe("/?decision=enviada&placa=KSR25F");
    expect(urlInicioTrasFirma("NO_APTA_PARA_OPERAR", "KSR25F", true)).toBe("/?decision=enviada&placa=KSR25F");
  });

  it("el rechazo de la primera etapa sigue siendo un rechazo", () => {
    expect(urlInicioTrasFirma("RECHAZADA", "KSR25F", true)).toBe("/?decision=rechazada&placa=KSR25F");
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

  it("arma el aviso de una aprobación de la primera etapa enviada al Director", () => {
    expect(avisoDecisionFirmada({ decision: "enviada", placa: "KSR25F" })).toEqual({
      tono: "ok",
      texto: "Inspección KSR25F aprobada y enviada al Director de Operaciones.",
    });
    expect(avisoDecisionFirmada({ decision: "enviada" })?.texto).toBe(
      "Inspección aprobada y enviada al Director de Operaciones.",
    );
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
