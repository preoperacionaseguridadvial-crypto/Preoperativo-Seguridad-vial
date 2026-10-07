import { describe, expect, it } from "vitest";
import { VENTANA_REUSO_INSPECCION_HORAS, esReutilizable } from "@/lib/inspections/reuso-inspeccion";

const ahora = new Date("2026-10-07T15:00:00Z");
const hace = (horas: number) => new Date(ahora.getTime() - horas * 60 * 60 * 1000);

describe("esReutilizable", () => {
  it("una inspección iniciada dentro de la ventana se reutiliza", () => {
    expect(esReutilizable(hace(1), ahora)).toBe(true);
    expect(esReutilizable(hace(VENTANA_REUSO_INSPECCION_HORAS), ahora)).toBe(true);
  });

  it("una más vieja que la ventana se considera abandonada", () => {
    expect(esReutilizable(hace(VENTANA_REUSO_INSPECCION_HORAS + 1), ahora)).toBe(false);
  });
});
