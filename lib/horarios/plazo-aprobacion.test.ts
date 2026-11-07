import { describe, expect, it } from "vitest";
import {
  enVentanaAprobacion,
  proximaVentanaAprobacion,
  ventanaAprobacionAbierta,
} from "@/lib/horarios/plazo-aprobacion";

// Hora de Bogotá (UTC-5) a instante: `bog("06:00")` = 2026-01-15 06:00 en Bogotá.
const bog = (hhmm: string, dia = "2026-01-15") => new Date(`${dia}T${hhmm}:00-05:00`);

const MANANA = { inicio: bog("05:45"), fin: bog("08:00") };
const TARDE = { inicio: bog("17:45"), fin: bog("20:00") };

describe("ventana de aprobación abierta", () => {
  it("5:45 a. m. exacto (inicio incluido) abre la ventana de la mañana", () => {
    expect(ventanaAprobacionAbierta(bog("05:45"))).toEqual(MANANA);
    expect(enVentanaAprobacion(bog("05:45"))).toBe(true);
  });

  it("5:44 a. m. todavía no está abierta", () => {
    expect(ventanaAprobacionAbierta(bog("05:44"))).toBeNull();
    expect(enVentanaAprobacion(bog("05:44"))).toBe(false);
  });

  it("7:59 a. m. sigue abierta; 8:00 a. m. exacto (fin excluido) ya cerró", () => {
    expect(enVentanaAprobacion(bog("07:59"))).toBe(true);
    expect(ventanaAprobacionAbierta(bog("08:00"))).toBeNull();
    expect(enVentanaAprobacion(bog("08:00"))).toBe(false);
  });

  it("entre las dos ventanas (10:00 a. m., 5:44 p. m.) está cerrada", () => {
    expect(enVentanaAprobacion(bog("10:00"))).toBe(false);
    expect(enVentanaAprobacion(bog("17:44"))).toBe(false);
  });

  it("5:45 p. m. exacto abre la ventana de la tarde; 7:59 p. m. abierta; 8:00 p. m. cerrada", () => {
    expect(ventanaAprobacionAbierta(bog("17:45"))).toEqual(TARDE);
    expect(enVentanaAprobacion(bog("19:59"))).toBe(true);
    expect(enVentanaAprobacion(bog("20:00"))).toBe(false);
  });

  it("de noche y de madrugada está cerrada", () => {
    expect(enVentanaAprobacion(bog("22:00"))).toBe(false);
    expect(enVentanaAprobacion(bog("03:00"))).toBe(false);
  });

  it("usa el día de Bogotá (23:59 de Bogotá = 04:59 UTC del día siguiente)", () => {
    expect(enVentanaAprobacion(new Date("2026-01-16T04:59:00Z"))).toBe(false);
    expect(ventanaAprobacionAbierta(bog("06:00", "2026-01-16"))).toEqual({
      inicio: bog("05:45", "2026-01-16"),
      fin: bog("08:00", "2026-01-16"),
    });
  });
});

describe("regla de producto: cualquier franja abierta, sin vencimiento", () => {
  // Enviada a las 6:20 a. m.: puede decidir a las 6:00 p. m. del mismo día; la ventana de la mañana
  // no la "consume".
  it("enviada a las 6:20 a. m. se puede decidir a las 6:00 p. m. del mismo día", () => {
    expect(enVentanaAprobacion(bog("18:00"))).toBe(true);
  });

  // Enviada a las 6:10 p. m.: se puede decidir a las 6:00 a. m. del día siguiente.
  it("enviada a las 6:10 p. m. se puede decidir a las 6:00 a. m. del día siguiente", () => {
    expect(enVentanaAprobacion(bog("06:00", "2026-01-16"))).toBe(true);
  });

  // Enviada a las 9:00 a. m.: a las 10:00 a. m. está bloqueada, a las 7:00 a. m. siguiente y a las 6:00 p. m. no.
  it("enviada a las 9:00 a. m. se bloquea a las 10:00 a. m. pero abre a las 7:00 a. m. siguiente y a las 6:00 p. m.", () => {
    expect(enVentanaAprobacion(bog("10:00"))).toBe(false);
    expect(enVentanaAprobacion(bog("07:00", "2026-01-16"))).toBe(true);
    expect(enVentanaAprobacion(bog("18:00"))).toBe(true);
  });
});

describe("próxima ventana de aprobación", () => {
  it("de madrugada es la de la mañana de ese día", () => {
    expect(proximaVentanaAprobacion(bog("03:00"))).toEqual(MANANA);
  });

  it("con la ventana de la mañana abierta es la de la tarde", () => {
    expect(proximaVentanaAprobacion(bog("06:00"))).toEqual(TARDE);
  });

  it("después de cerrar la mañana es la de la tarde", () => {
    expect(proximaVentanaAprobacion(bog("08:00"))).toEqual(TARDE);
    expect(proximaVentanaAprobacion(bog("15:00"))).toEqual(TARDE);
  });

  it("en el instante exacto de apertura ya no cuenta como próxima (ya está abierta)", () => {
    expect(proximaVentanaAprobacion(bog("17:45"))).toEqual({
      inicio: bog("05:45", "2026-01-16"),
      fin: bog("08:00", "2026-01-16"),
    });
  });

  it("de noche es la de la mañana del día siguiente", () => {
    expect(proximaVentanaAprobacion(bog("21:00"))).toEqual({
      inicio: bog("05:45", "2026-01-16"),
      fin: bog("08:00", "2026-01-16"),
    });
  });
});
