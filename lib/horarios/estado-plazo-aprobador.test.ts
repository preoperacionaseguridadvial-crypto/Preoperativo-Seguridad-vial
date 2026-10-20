import { describe, expect, it } from "vitest";
import { Sede } from "@/generated/prisma/enums";
import {
  MENSAJE_ENVIADA_FUERA_DE_HORARIO,
  estadoPlazoParaAprobador,
} from "@/lib/horarios/estado-plazo-aprobador";

const MIN = 60_000;
const ENVIADA = new Date("2026-01-15T11:00:00Z");
const despues = (base: Date, minutos: number) => new Date(base.getTime() + minutos * MIN);

const base = {
  sede: Sede.BOGOTA,
  completedAt: ENVIADA,
  revisadaSupervisorOleariariAt: null,
  enviadaFueraDeHorario: false,
};

describe("estadoPlazoParaAprobador", () => {
  it("dentro del plazo: expone cuándo vence y no está vencido", () => {
    const estado = estadoPlazoParaAprobador({
      inspection: base,
      ahora: despues(ENVIADA, 10),
      habilitacionHasta: null,
    });
    expect(estado).toEqual({
      fueraDeHorario: false,
      vence: despues(ENVIADA, 60),
      vencido: false,
      habilitadoHasta: null,
      puedeDecidir: true,
    });
  });

  it("vencido sin habilitación: no puede decidir", () => {
    const estado = estadoPlazoParaAprobador({
      inspection: base,
      ahora: despues(ENVIADA, 60),
      habilitacionHasta: null,
    });
    expect(estado.vencido).toBe(true);
    expect(estado.habilitadoHasta).toBeNull();
    expect(estado.puedeDecidir).toBe(false);
  });

  it("vencido con habilitación vigente: puede decidir y expone hasta cuándo", () => {
    const hasta = despues(ENVIADA, 120);
    const estado = estadoPlazoParaAprobador({
      inspection: base,
      ahora: despues(ENVIADA, 90),
      habilitacionHasta: hasta,
    });
    expect(estado.vencido).toBe(true);
    expect(estado.habilitadoHasta).toEqual(hasta);
    expect(estado.puedeDecidir).toBe(true);
  });

  it("habilitación ya terminada (hasta <= ahora) no cuenta", () => {
    const ahora = despues(ENVIADA, 90);
    const estado = estadoPlazoParaAprobador({ inspection: base, ahora, habilitacionHasta: ahora });
    expect(estado.habilitadoHasta).toBeNull();
    expect(estado.puedeDecidir).toBe(false);
  });

  it("dentro del plazo ignora la habilitación (no hay nada que habilitar)", () => {
    const estado = estadoPlazoParaAprobador({
      inspection: base,
      ahora: despues(ENVIADA, 10),
      habilitacionHasta: despues(ENVIADA, 200),
    });
    expect(estado.habilitadoHasta).toBeNull();
    expect(estado.puedeDecidir).toBe(true);
  });

  it("Oleariari etapa 2: el plazo corre desde la revisión del Supervisor Oleariari", () => {
    const revisada = despues(ENVIADA, 50);
    const estado = estadoPlazoParaAprobador({
      inspection: { ...base, sede: Sede.OLEARIARI, revisadaSupervisorOleariariAt: revisada },
      ahora: despues(ENVIADA, 100),
      habilitacionHasta: null,
    });
    expect(estado.vence).toEqual(despues(revisada, 60));
    expect(estado.vencido).toBe(false);
  });

  it("propaga la marca de envío fuera de horario", () => {
    const estado = estadoPlazoParaAprobador({
      inspection: { ...base, enviadaFueraDeHorario: true },
      ahora: despues(ENVIADA, 1),
      habilitacionHasta: null,
    });
    expect(estado.fueraDeHorario).toBe(true);
  });

  it("sin envío (completedAt nulo) no hay plazo ni vencimiento", () => {
    const estado = estadoPlazoParaAprobador({
      inspection: { ...base, completedAt: null },
      ahora: despues(ENVIADA, 500),
      habilitacionHasta: null,
    });
    expect(estado.vence).toBeNull();
    expect(estado.vencido).toBe(false);
    expect(estado.puedeDecidir).toBe(true);
  });

  it("el texto de la alerta es el definido por el dueño", () => {
    expect(MENSAJE_ENVIADA_FUERA_DE_HORARIO).toBe(
      "Enviada fuera de horario, pendiente de revisión. Tiene 60 minutos para aprobar o rechazar.",
    );
  });
});
