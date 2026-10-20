import { describe, expect, it } from "vitest";
import { Sede } from "@/generated/prisma/enums";
import {
  PLAZO_APROBACION_MINUTOS,
  inicioPlazoEtapa,
  plazoVencido,
  vencePlazo,
} from "@/lib/horarios/plazo-aprobacion";

const ENVIADA = new Date("2026-01-15T11:00:00Z");
const MIN = 60_000;
const despues = (base: Date, minutos: number) => new Date(base.getTime() + minutos * MIN);

const bogota = { sede: Sede.BOGOTA, completedAt: ENVIADA, revisadaSupervisorOleariariAt: null };
const oleariariEtapa1 = { sede: Sede.OLEARIARI, completedAt: ENVIADA, revisadaSupervisorOleariariAt: null };
const REVISADA = despues(ENVIADA, 50);
const oleariariEtapa2 = { sede: Sede.OLEARIARI, completedAt: ENVIADA, revisadaSupervisorOleariariAt: REVISADA };

describe("plazo de aprobación", () => {
  it("el plazo es de 60 minutos", () => {
    expect(PLAZO_APROBACION_MINUTOS).toBe(60);
  });

  it("Bogotá y legacy sin sede cuentan desde el envío", () => {
    expect(inicioPlazoEtapa(bogota)).toEqual(ENVIADA);
    expect(inicioPlazoEtapa({ ...bogota, sede: null })).toEqual(ENVIADA);
  });

  it("Oleariari etapa 1 cuenta desde el envío", () => {
    expect(inicioPlazoEtapa(oleariariEtapa1)).toEqual(ENVIADA);
  });

  it("Oleariari etapa 2 cuenta desde la revisión del Supervisor Oleariari", () => {
    expect(inicioPlazoEtapa(oleariariEtapa2)).toEqual(REVISADA);
    expect(vencePlazo(oleariariEtapa2)).toEqual(despues(REVISADA, 60));
  });

  it("sin envío no hay plazo", () => {
    const sinEnvio = { ...bogota, completedAt: null };
    expect(inicioPlazoEtapa(sinEnvio)).toBeNull();
    expect(vencePlazo(sinEnvio)).toBeNull();
    expect(plazoVencido(sinEnvio, despues(ENVIADA, 999))).toBe(false);
  });

  it("a los 59:59 sigue vigente; a los 60:00 exactos ya venció", () => {
    expect(plazoVencido(bogota, new Date(despues(ENVIADA, 60).getTime() - 1000))).toBe(false);
    expect(plazoVencido(bogota, despues(ENVIADA, 60))).toBe(true);
    expect(plazoVencido(bogota, despues(ENVIADA, 61))).toBe(true);
  });

  it("la etapa 2 tiene su propio plazo aunque el envío sea viejo", () => {
    expect(plazoVencido(oleariariEtapa2, despues(ENVIADA, 100))).toBe(false);
    expect(plazoVencido(oleariariEtapa2, despues(REVISADA, 60))).toBe(true);
  });
});
