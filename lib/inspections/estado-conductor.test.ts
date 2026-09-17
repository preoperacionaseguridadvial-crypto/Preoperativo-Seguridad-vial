import { describe, expect, it } from "vitest";
import { requiereAtencionEstadoConductor } from "@/lib/inspections/estado-conductor";

// A6 del design de soporte-moto-carro: la declaración de estado del
// conductor NUNCA bloquea el envío (D8) — esta función solo decide si el
// Supervisor debe ver una advertencia. Es derivada, no un flag guardado.
describe("requiereAtencionEstadoConductor", () => {
  it("no requiere atención cuando las 3 respuestas son las esperadas (sin medicamentos, apto, sin alcohol)", () => {
    expect(
      requiereAtencionEstadoConductor({
        tomaMedicamentos: false,
        condicionesAptas: true,
        consumioAlcohol: false,
      }),
    ).toBe(false);
  });

  it("requiere atención si toma medicamentos/sustancias (SÍ)", () => {
    expect(
      requiereAtencionEstadoConductor({
        tomaMedicamentos: true,
        condicionesAptas: true,
        consumioAlcohol: false,
      }),
    ).toBe(true);
  });

  it("requiere atención si NO está en condiciones físicas y mentales adecuadas", () => {
    expect(
      requiereAtencionEstadoConductor({
        tomaMedicamentos: false,
        condicionesAptas: false,
        consumioAlcohol: false,
      }),
    ).toBe(true);
  });

  it("requiere atención si consumió alcohol/sustancias (SÍ)", () => {
    expect(
      requiereAtencionEstadoConductor({
        tomaMedicamentos: false,
        condicionesAptas: true,
        consumioAlcohol: true,
      }),
    ).toBe(true);
  });

  it("no requiere atención (false, no true) cuando todavía falta responder (null)", () => {
    expect(
      requiereAtencionEstadoConductor({
        tomaMedicamentos: null,
        condicionesAptas: null,
        consumioAlcohol: null,
      }),
    ).toBe(false);
  });
});
