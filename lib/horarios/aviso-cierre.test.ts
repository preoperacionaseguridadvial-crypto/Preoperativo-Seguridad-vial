import { describe, expect, it } from "vitest";
import { cierreDelAviso } from "@/lib/horarios/aviso-cierre";

// Bogotá es UTC-5: 05:45 locales = 10:45 UTC; 06:30 = 11:30 UTC.
describe("cierreDelAviso", () => {
  it("sin habilitación y empezada en la ventana abierta, avisa cuando esa ventana cierra", () => {
    const resultado = cierreDelAviso({
      startedAt: new Date("2026-10-20T10:50:00Z"),
      ahora: new Date("2026-10-20T11:00:00Z"),
      habilitacionHasta: null,
    });
    expect(resultado.cierre).toEqual(new Date("2026-10-20T11:30:00Z"));
    expect(resultado.hora).toEqual(new Date("2026-10-20T11:30:00Z"));
  });

  it("con habilitación vigente, avisa cuando la habilitación termina", () => {
    const resultado = cierreDelAviso({
      startedAt: new Date("2026-10-20T14:00:00Z"),
      ahora: new Date("2026-10-20T14:10:00Z"),
      habilitacionHasta: new Date("2026-10-20T15:00:00Z"),
    });
    expect(resultado.cierre).toEqual(new Date("2026-10-20T15:00:00Z"));
    expect(resultado.hora).toEqual(new Date("2026-10-20T15:00:00Z"));
  });

  it("la habilitación manda aunque la ventana siga abierta", () => {
    const resultado = cierreDelAviso({
      startedAt: new Date("2026-10-20T10:50:00Z"),
      ahora: new Date("2026-10-20T11:00:00Z"),
      habilitacionHasta: new Date("2026-10-20T12:00:00Z"),
    });
    expect(resultado.cierre).toEqual(new Date("2026-10-20T12:00:00Z"));
  });

  it("ya fuera de horario, avisa de inmediato y cita la hora de la ventana en que empezó", () => {
    const ahora = new Date("2026-10-20T11:45:00Z");
    const resultado = cierreDelAviso({
      startedAt: new Date("2026-10-20T11:00:00Z"),
      ahora,
      habilitacionHasta: null,
    });
    expect(resultado.cierre).toEqual(ahora);
    expect(resultado.hora).toEqual(new Date("2026-10-20T11:30:00Z"));
  });

  it("empezada en otro turno, avisa de inmediato con la hora de cierre de su turno", () => {
    const ahora = new Date("2026-10-20T23:00:00Z"); // 18:00, turno 2 abierto
    const resultado = cierreDelAviso({
      startedAt: new Date("2026-10-20T11:00:00Z"), // turno 1
      ahora,
      habilitacionHasta: null,
    });
    expect(resultado.cierre).toEqual(ahora);
    expect(resultado.hora).toEqual(new Date("2026-10-20T11:30:00Z"));
  });

  it("empezada fuera de toda ventana (ya habilitada y vencida), usa ahora como hora", () => {
    const ahora = new Date("2026-10-20T15:00:00Z");
    const resultado = cierreDelAviso({
      startedAt: new Date("2026-10-20T14:00:00Z"),
      ahora,
      habilitacionHasta: null,
    });
    expect(resultado.cierre).toEqual(ahora);
    expect(resultado.hora).toEqual(ahora);
  });
});
