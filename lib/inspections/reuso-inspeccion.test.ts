import { describe, expect, it } from "vitest";
import { esReutilizable } from "@/lib/inspections/reuso-inspeccion";

// Bogotá es UTC-5: turno 1 = 10:45-11:30 UTC, turno 2 = 22:45-23:30 UTC.
describe("esReutilizable", () => {
  it("dentro de una ventana, una iniciada en esa misma ventana se reutiliza", () => {
    const ahora = new Date("2026-10-20T11:20:00Z");
    expect(esReutilizable(new Date("2026-10-20T11:00:00Z"), ahora)).toBe(true);
    expect(esReutilizable(new Date("2026-10-20T10:45:00Z"), ahora)).toBe(true);
  });

  it("una iniciada en el turno anterior se considera abandonada", () => {
    const ahora = new Date("2026-10-20T23:00:00Z");
    expect(esReutilizable(new Date("2026-10-20T11:00:00Z"), ahora)).toBe(false);
    expect(esReutilizable(new Date("2026-10-20T22:44:59Z"), ahora)).toBe(false);
  });

  it("una de ayer se considera abandonada en el turno 1 de hoy", () => {
    const ahora = new Date("2026-10-20T11:00:00Z");
    expect(esReutilizable(new Date("2026-10-19T23:00:00Z"), ahora)).toBe(false);
  });

  it("fuera de ventana, la del turno que acaba de cerrar sigue siendo reutilizable", () => {
    const ahora = new Date("2026-10-20T11:40:00Z");
    expect(esReutilizable(new Date("2026-10-20T11:20:00Z"), ahora)).toBe(true);
    expect(esReutilizable(new Date("2026-10-19T23:00:00Z"), ahora)).toBe(false);
  });
});
