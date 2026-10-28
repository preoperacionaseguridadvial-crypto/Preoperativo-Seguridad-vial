import { describe, expect, it } from "vitest";
import { Sede } from "@/generated/prisma/enums";
import {
  fueraDeVentanaAprobacion,
  inicioPlazoEtapa,
  plazoVencido,
  ventanaAprobacion,
  vencePlazo,
} from "@/lib/horarios/plazo-aprobacion";

// Hora de Bogotá (UTC-5) a instante: `bog("06:00")` = 2026-01-15 06:00 en Bogotá.
const bog = (hhmm: string, dia = "2026-01-15") => new Date(`${dia}T${hhmm}:00-05:00`);

const completa = (completedAt: Date | null) => ({
  sede: Sede.BOGOTA,
  completedAt,
  revisadaSupervisorOleariariAt: null,
});

describe("inicio del plazo de la etapa", () => {
  const ENVIADA = bog("06:00");
  const REVISADA = bog("07:00");

  it("Bogotá y legacy sin sede cuentan desde el envío", () => {
    expect(inicioPlazoEtapa(completa(ENVIADA))).toEqual(ENVIADA);
    expect(inicioPlazoEtapa({ ...completa(ENVIADA), sede: null })).toEqual(ENVIADA);
  });

  it("Oleariari etapa 1 cuenta desde el envío", () => {
    const insp = { sede: Sede.OLEARIARI, completedAt: ENVIADA, revisadaSupervisorOleariariAt: null };
    expect(inicioPlazoEtapa(insp)).toEqual(ENVIADA);
  });

  it("Oleariari etapa 2 cuenta desde la revisión del Supervisor Oleariari", () => {
    const insp = { sede: Sede.OLEARIARI, completedAt: ENVIADA, revisadaSupervisorOleariariAt: REVISADA };
    expect(inicioPlazoEtapa(insp)).toEqual(REVISADA);
  });
});

describe("ventana de aprobación de la etapa", () => {
  it("enviada a las 6:00 a. m.: ventana de la mañana, vence a las 8:00", () => {
    const insp = completa(bog("06:00"));
    expect(ventanaAprobacion(insp)).toEqual({ inicio: bog("05:45"), fin: bog("08:00") });
    expect(vencePlazo(insp)).toEqual(bog("08:00"));
  });

  it("enviada a las 7:59 vence a las 8:00 del mismo día", () => {
    expect(vencePlazo(completa(bog("07:59")))).toEqual(bog("08:00"));
  });

  it("enviada a las 8:00 exactas: ya cerró la de la mañana, aplica la de la tarde", () => {
    expect(ventanaAprobacion(completa(bog("08:00")))).toEqual({ inicio: bog("17:45"), fin: bog("20:00") });
  });

  it("enviada a las 5:45 exactas (inicio incluido) está en la ventana de la mañana", () => {
    expect(ventanaAprobacion(completa(bog("05:45")))).toEqual({ inicio: bog("05:45"), fin: bog("08:00") });
  });

  it("enviada a las 10:00: la ventana es la de la tarde", () => {
    expect(ventanaAprobacion(completa(bog("10:00")))).toEqual({ inicio: bog("17:45"), fin: bog("20:00") });
  });

  it("enviada a las 19:59 vence a las 20:00; a las 20:00 pasa a la mañana siguiente", () => {
    expect(vencePlazo(completa(bog("19:59")))).toEqual(bog("20:00"));
    expect(ventanaAprobacion(completa(bog("20:00")))).toEqual({
      inicio: bog("05:45", "2026-01-16"),
      fin: bog("08:00", "2026-01-16"),
    });
  });

  it("enviada a las 21:00: la ventana es la de la mañana siguiente", () => {
    expect(ventanaAprobacion(completa(bog("21:00")))).toEqual({
      inicio: bog("05:45", "2026-01-16"),
      fin: bog("08:00", "2026-01-16"),
    });
  });

  it("enviada a las 23:59 de Bogotá (04:59 UTC del día siguiente): ventana de la mañana siguiente", () => {
    const insp = completa(new Date("2026-01-16T04:59:00Z"));
    expect(ventanaAprobacion(insp)).toEqual({ inicio: bog("05:45", "2026-01-16"), fin: bog("08:00", "2026-01-16") });
  });

  it("enviada a las 3:00 a. m.: la ventana es la de esa misma mañana", () => {
    expect(ventanaAprobacion(completa(bog("03:00")))).toEqual({ inicio: bog("05:45"), fin: bog("08:00") });
  });

  it("Oleariari etapa 2 usa su propia ventana según la revisión", () => {
    const insp = {
      sede: Sede.OLEARIARI,
      completedAt: bog("06:00"),
      revisadaSupervisorOleariariAt: bog("18:30"),
    };
    expect(ventanaAprobacion(insp)).toEqual({ inicio: bog("17:45"), fin: bog("20:00") });
    expect(vencePlazo(insp)).toEqual(bog("20:00"));
  });

  it("sin envío no hay ventana, plazo ni vencimiento", () => {
    const sinEnvio = completa(null);
    expect(ventanaAprobacion(sinEnvio)).toBeNull();
    expect(vencePlazo(sinEnvio)).toBeNull();
    expect(plazoVencido(sinEnvio, bog("23:00", "2026-02-01"))).toBe(false);
    expect(fueraDeVentanaAprobacion(sinEnvio, bog("23:00", "2026-02-01"))).toBe(false);
  });
});

describe("plazo vencido", () => {
  const insp = completa(bog("06:00"));

  it("a las 7:59:59 sigue vigente; a las 8:00 exactas ya venció", () => {
    expect(plazoVencido(insp, new Date(bog("08:00").getTime() - 1000))).toBe(false);
    expect(plazoVencido(insp, bog("08:00"))).toBe(true);
  });

  it("no revive en la ventana siguiente", () => {
    expect(plazoVencido(insp, bog("18:00"))).toBe(true);
    expect(plazoVencido(insp, bog("06:00", "2026-01-16"))).toBe(true);
  });

  it("enviada a las 10:00 no está vencida a las 15:00 (su ventana aún no abre) y vence a las 20:00", () => {
    const tarde = completa(bog("10:00"));
    expect(plazoVencido(tarde, bog("15:00"))).toBe(false);
    expect(plazoVencido(tarde, bog("17:45"))).toBe(false);
    expect(plazoVencido(tarde, bog("20:00"))).toBe(true);
  });

  it("Oleariari etapa 2 tiene su propio plazo aunque el envío sea viejo", () => {
    const etapa2 = { sede: Sede.OLEARIARI, completedAt: bog("06:00"), revisadaSupervisorOleariariAt: bog("17:50") };
    expect(plazoVencido(etapa2, bog("19:00"))).toBe(false);
    expect(plazoVencido(etapa2, bog("20:00"))).toBe(true);
  });
});

describe("fuera de la ventana de aprobación", () => {
  it("enviada a las 10:00: fuera a las 15:00, dentro a las 17:45, fuera a las 20:00", () => {
    const tarde = completa(bog("10:00"));
    expect(fueraDeVentanaAprobacion(tarde, bog("15:00"))).toBe(true);
    expect(fueraDeVentanaAprobacion(tarde, bog("17:44"))).toBe(true);
    expect(fueraDeVentanaAprobacion(tarde, bog("17:45"))).toBe(false);
    expect(fueraDeVentanaAprobacion(tarde, bog("19:59"))).toBe(false);
    expect(fueraDeVentanaAprobacion(tarde, bog("20:00"))).toBe(true);
  });

  it("enviada a las 6:00: dentro hasta las 7:59, fuera desde las 8:00", () => {
    const manana = completa(bog("06:00"));
    expect(fueraDeVentanaAprobacion(manana, bog("06:01"))).toBe(false);
    expect(fueraDeVentanaAprobacion(manana, bog("08:00"))).toBe(true);
  });

  it("enviada a las 21:00: fuera esa noche, dentro a las 5:45 del día siguiente", () => {
    const noche = completa(bog("21:00"));
    expect(fueraDeVentanaAprobacion(noche, bog("22:00"))).toBe(true);
    expect(fueraDeVentanaAprobacion(noche, bog("05:45", "2026-01-16"))).toBe(false);
  });
});
