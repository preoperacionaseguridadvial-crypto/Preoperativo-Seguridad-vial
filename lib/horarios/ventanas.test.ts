import { describe, expect, it } from "vitest";
import { estaEnVentana, inicioUltimaVentana, ventanaActual } from "@/lib/horarios/ventanas";

// Bogotá es UTC-5: las 05:45 locales son las 10:45 UTC.
describe("ventanaActual", () => {
  it("a las 05:45 de Bogotá abre el turno 1, que cierra a las 06:30", () => {
    const ventana = ventanaActual(new Date("2026-10-20T10:45:00Z"));
    expect(ventana).toEqual({
      turno: 1,
      inicio: new Date("2026-10-20T10:45:00Z"),
      fin: new Date("2026-10-20T11:30:00Z"),
    });
  });

  it("a las 06:29:59 de Bogotá sigue en el turno 1", () => {
    expect(ventanaActual(new Date("2026-10-20T11:29:59Z"))?.turno).toBe(1);
  });

  it("a las 06:30 en punto la ventana ya cerró", () => {
    expect(ventanaActual(new Date("2026-10-20T11:30:00Z"))).toBeNull();
  });

  it("a las 05:44 de Bogotá todavía no abrió", () => {
    expect(ventanaActual(new Date("2026-10-20T10:44:59Z"))).toBeNull();
  });

  it("a las 17:45 de Bogotá abre el turno 2, que cierra a las 18:30", () => {
    const ventana = ventanaActual(new Date("2026-10-20T22:45:00Z"));
    expect(ventana).toEqual({
      turno: 2,
      inicio: new Date("2026-10-20T22:45:00Z"),
      fin: new Date("2026-10-20T23:30:00Z"),
    });
  });

  it("a las 18:30 de Bogotá el turno 2 ya cerró", () => {
    expect(ventanaActual(new Date("2026-10-20T23:30:00Z"))).toBeNull();
  });

  it("al mediodía no hay ventana", () => {
    expect(ventanaActual(new Date("2026-10-20T17:00:00Z"))).toBeNull();
  });
});

describe("estaEnVentana", () => {
  it("es true dentro de una ventana y false fuera", () => {
    expect(estaEnVentana(new Date("2026-10-20T11:00:00Z"))).toBe(true);
    expect(estaEnVentana(new Date("2026-10-20T12:00:00Z"))).toBe(false);
  });
});

describe("inicioUltimaVentana", () => {
  it("dentro del turno 1 es el inicio de ese turno", () => {
    expect(inicioUltimaVentana(new Date("2026-10-20T11:00:00Z"))).toEqual(new Date("2026-10-20T10:45:00Z"));
  });

  it("entre los dos turnos es el inicio del turno 1 de hoy", () => {
    expect(inicioUltimaVentana(new Date("2026-10-20T17:00:00Z"))).toEqual(new Date("2026-10-20T10:45:00Z"));
  });

  it("dentro del turno 2 y después de él es el inicio del turno 2 de hoy", () => {
    expect(inicioUltimaVentana(new Date("2026-10-20T23:00:00Z"))).toEqual(new Date("2026-10-20T22:45:00Z"));
    expect(inicioUltimaVentana(new Date("2026-10-21T02:00:00Z"))).toEqual(new Date("2026-10-20T22:45:00Z"));
  });

  it("antes de las 05:45 es el turno 2 de ayer", () => {
    expect(inicioUltimaVentana(new Date("2026-10-20T10:44:59Z"))).toEqual(new Date("2026-10-19T22:45:00Z"));
  });

  it("en el instante exacto de apertura ya cuenta esa ventana", () => {
    expect(inicioUltimaVentana(new Date("2026-10-20T10:45:00Z"))).toEqual(new Date("2026-10-20T10:45:00Z"));
    expect(inicioUltimaVentana(new Date("2026-10-20T22:45:00Z"))).toEqual(new Date("2026-10-20T22:45:00Z"));
  });
});
