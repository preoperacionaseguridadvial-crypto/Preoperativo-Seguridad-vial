import { describe, expect, it } from "vitest";
import {
  MENSAJE_ENVIADA_FUERA_DE_HORARIO,
  estadoPlazoParaAprobador,
} from "@/lib/horarios/estado-plazo-aprobador";

// Hora de Bogotá (UTC-5) a instante.
const bog = (hhmm: string, dia = "2026-01-15") => new Date(`${dia}T${hhmm}:00-05:00`);

const base = { enviadaFueraDeHorario: false };

describe("estadoPlazoParaAprobador", () => {
  it("dentro de una ventana: expone cuándo cierra, no requiere habilitación y puede decidir", () => {
    const estado = estadoPlazoParaAprobador({ inspection: base, ahora: bog("06:10"), habilitacionHasta: null });
    expect(estado).toEqual({
      fueraDeHorario: false,
      cierra: bog("08:00"),
      abre: null,
      fueraDeVentana: false,
      habilitadoHasta: null,
      puedeDecidir: true,
    });
  });

  it("enviada en la mañana, a las 6:00 p. m. del mismo día puede decidir (otra ventana abierta)", () => {
    const estado = estadoPlazoParaAprobador({ inspection: base, ahora: bog("18:00"), habilitacionHasta: null });
    expect(estado.cierra).toEqual(bog("20:00"));
    expect(estado.puedeDecidir).toBe(true);
  });

  it("fuera de toda ventana sin habilitación: no puede decidir y expone cuándo abre la próxima", () => {
    const estado = estadoPlazoParaAprobador({ inspection: base, ahora: bog("10:00"), habilitacionHasta: null });
    expect(estado.fueraDeVentana).toBe(true);
    expect(estado.abre).toEqual(bog("17:45"));
    expect(estado.cierra).toBeNull();
    expect(estado.habilitadoHasta).toBeNull();
    expect(estado.puedeDecidir).toBe(false);
  });

  it("a las 8:00 a. m. exactas ya está fuera de ventana", () => {
    const estado = estadoPlazoParaAprobador({ inspection: base, ahora: bog("08:00"), habilitacionHasta: null });
    expect(estado.fueraDeVentana).toBe(true);
    expect(estado.puedeDecidir).toBe(false);
  });

  it("a las 5:45 a. m. exactas ya está dentro de la ventana", () => {
    const estado = estadoPlazoParaAprobador({ inspection: base, ahora: bog("05:45"), habilitacionHasta: null });
    expect(estado.fueraDeVentana).toBe(false);
    expect(estado.puedeDecidir).toBe(true);
  });

  it("fuera de ventana con habilitación vigente: puede decidir y expone hasta cuándo", () => {
    const hasta = bog("12:00");
    const estado = estadoPlazoParaAprobador({ inspection: base, ahora: bog("10:00"), habilitacionHasta: hasta });
    expect(estado.habilitadoHasta).toEqual(hasta);
    expect(estado.puedeDecidir).toBe(true);
  });

  it("habilitación ya terminada (hasta <= ahora) no cuenta", () => {
    const ahora = bog("10:00");
    const estado = estadoPlazoParaAprobador({ inspection: base, ahora, habilitacionHasta: ahora });
    expect(estado.habilitadoHasta).toBeNull();
    expect(estado.puedeDecidir).toBe(false);
  });

  it("dentro de la ventana ignora la habilitación (no hay nada que habilitar)", () => {
    const estado = estadoPlazoParaAprobador({
      inspection: base,
      ahora: bog("06:10"),
      habilitacionHasta: bog("12:00"),
    });
    expect(estado.habilitadoHasta).toBeNull();
    expect(estado.puedeDecidir).toBe(true);
  });

  it("propaga la marca de envío fuera de horario", () => {
    const estado = estadoPlazoParaAprobador({
      inspection: { enviadaFueraDeHorario: true },
      ahora: bog("06:10"),
      habilitacionHasta: null,
    });
    expect(estado.fueraDeHorario).toBe(true);
  });

  it("el texto de la alerta menciona el horario de aprobación", () => {
    expect(MENSAJE_ENVIADA_FUERA_DE_HORARIO).toBe(
      "Enviada fuera de horario, pendiente de revisión. Solo puede aprobar o rechazar entre las 5:45 y las 8:00 a. m. o entre las 5:45 y las 8:00 p. m.",
    );
  });
});
