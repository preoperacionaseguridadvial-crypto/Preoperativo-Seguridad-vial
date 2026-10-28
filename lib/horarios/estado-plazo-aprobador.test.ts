import { describe, expect, it } from "vitest";
import { Sede } from "@/generated/prisma/enums";
import {
  MENSAJE_ENVIADA_FUERA_DE_HORARIO,
  estadoPlazoParaAprobador,
} from "@/lib/horarios/estado-plazo-aprobador";

// Hora de Bogotá (UTC-5) a instante.
const bog = (hhmm: string, dia = "2026-01-15") => new Date(`${dia}T${hhmm}:00-05:00`);

const ENVIADA = bog("06:00");

const base = {
  sede: Sede.BOGOTA,
  completedAt: ENVIADA,
  revisadaSupervisorOleariariAt: null,
  enviadaFueraDeHorario: false,
};

describe("estadoPlazoParaAprobador", () => {
  it("dentro de la ventana: expone cuándo abrió y vence, y puede decidir", () => {
    const estado = estadoPlazoParaAprobador({
      inspection: base,
      ahora: bog("06:10"),
      habilitacionHasta: null,
    });
    expect(estado).toEqual({
      fueraDeHorario: false,
      abre: bog("05:45"),
      vence: bog("08:00"),
      vencido: false,
      fueraDeVentana: false,
      habilitadoHasta: null,
      puedeDecidir: true,
    });
  });

  it("vencido sin habilitación: no puede decidir", () => {
    const estado = estadoPlazoParaAprobador({
      inspection: base,
      ahora: bog("08:00"),
      habilitacionHasta: null,
    });
    expect(estado.vencido).toBe(true);
    expect(estado.fueraDeVentana).toBe(true);
    expect(estado.habilitadoHasta).toBeNull();
    expect(estado.puedeDecidir).toBe(false);
  });

  it("vencido con habilitación vigente: puede decidir y expone hasta cuándo", () => {
    const hasta = bog("21:00");
    const estado = estadoPlazoParaAprobador({
      inspection: base,
      ahora: bog("10:00"),
      habilitacionHasta: hasta,
    });
    expect(estado.vencido).toBe(true);
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

  it("ventana aún sin abrir (enviada a las 10:00, son las 15:00): no vencido pero no puede decidir", () => {
    const estado = estadoPlazoParaAprobador({
      inspection: { ...base, completedAt: bog("10:00") },
      ahora: bog("15:00"),
      habilitacionHasta: null,
    });
    expect(estado.abre).toEqual(bog("17:45"));
    expect(estado.vence).toEqual(bog("20:00"));
    expect(estado.vencido).toBe(false);
    expect(estado.fueraDeVentana).toBe(true);
    expect(estado.puedeDecidir).toBe(false);
  });

  it("ventana aún sin abrir con habilitación vigente: puede decidir y expone la habilitación", () => {
    const hasta = bog("16:00");
    const estado = estadoPlazoParaAprobador({
      inspection: { ...base, completedAt: bog("10:00") },
      ahora: bog("15:00"),
      habilitacionHasta: hasta,
    });
    expect(estado.vencido).toBe(false);
    expect(estado.habilitadoHasta).toEqual(hasta);
    expect(estado.puedeDecidir).toBe(true);
  });

  it("a las 17:45 de esa ventana ya puede decidir sin habilitación", () => {
    const estado = estadoPlazoParaAprobador({
      inspection: { ...base, completedAt: bog("10:00") },
      ahora: bog("17:45"),
      habilitacionHasta: null,
    });
    expect(estado.fueraDeVentana).toBe(false);
    expect(estado.puedeDecidir).toBe(true);
  });

  it("Oleariari etapa 2: la ventana depende de la revisión del Supervisor Oleariari", () => {
    const estado = estadoPlazoParaAprobador({
      inspection: { ...base, sede: Sede.OLEARIARI, revisadaSupervisorOleariariAt: bog("07:00") },
      ahora: bog("07:30"),
      habilitacionHasta: null,
    });
    expect(estado.vence).toEqual(bog("08:00"));
    expect(estado.vencido).toBe(false);
  });

  it("propaga la marca de envío fuera de horario", () => {
    const estado = estadoPlazoParaAprobador({
      inspection: { ...base, enviadaFueraDeHorario: true },
      ahora: bog("06:10"),
      habilitacionHasta: null,
    });
    expect(estado.fueraDeHorario).toBe(true);
  });

  it("sin envío (completedAt nulo) no hay plazo ni vencimiento", () => {
    const estado = estadoPlazoParaAprobador({
      inspection: { ...base, completedAt: null },
      ahora: bog("22:00"),
      habilitacionHasta: null,
    });
    expect(estado.vence).toBeNull();
    expect(estado.abre).toBeNull();
    expect(estado.vencido).toBe(false);
    expect(estado.fueraDeVentana).toBe(false);
    expect(estado.puedeDecidir).toBe(true);
  });

  it("el texto de la alerta menciona el horario de aprobación", () => {
    expect(MENSAJE_ENVIADA_FUERA_DE_HORARIO).toBe(
      "Enviada fuera de horario, pendiente de revisión. Solo puede aprobar o rechazar entre las 5:45 y las 8:00 a. m. o entre las 5:45 y las 8:00 p. m.",
    );
  });
});
