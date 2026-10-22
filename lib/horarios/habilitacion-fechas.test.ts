import { describe, expect, it } from "vitest";
import { estadoHabilitacion, instanteBogota } from "@/lib/horarios/habilitacion-fechas";

describe("instanteBogota", () => {
  it("convierte fecha y hora locales de Bogotá (UTC-5) a un instante UTC", () => {
    expect(instanteBogota("2026-10-21", "05:45")?.toISOString()).toBe("2026-10-21T10:45:00.000Z");
  });

  it("cruza al día siguiente en UTC por la tarde", () => {
    expect(instanteBogota("2026-10-21", "19:30")?.toISOString()).toBe("2026-10-22T00:30:00.000Z");
  });

  it("acepta medianoche", () => {
    expect(instanteBogota("2026-10-21", "00:00")?.toISOString()).toBe("2026-10-21T05:00:00.000Z");
  });

  it.each([
    ["", "05:45"],
    ["2026-10-21", ""],
    ["21/10/2026", "05:45"],
    ["2026-13-01", "05:45"],
    ["2026-02-30", "05:45"],
    ["2026-10-21", "24:00"],
    ["2026-10-21", "5:45"],
    ["2026-10-21", "05:60"],
  ])("devuelve null para entrada inválida (%s, %s)", (fecha, hora) => {
    expect(instanteBogota(fecha, hora)).toBeNull();
  });
});

describe("estadoHabilitacion", () => {
  const desde = new Date("2026-10-21T10:00:00Z");
  const hasta = new Date("2026-10-21T11:00:00Z");

  it("es PROGRAMADA antes de `desde`", () => {
    expect(estadoHabilitacion({ desde, hasta }, new Date("2026-10-21T09:59:59Z"))).toBe("PROGRAMADA");
  });

  it("es VIGENTE desde `desde` (incluido) hasta antes de `hasta`", () => {
    expect(estadoHabilitacion({ desde, hasta }, desde)).toBe("VIGENTE");
    expect(estadoHabilitacion({ desde, hasta }, new Date("2026-10-21T10:59:59Z"))).toBe("VIGENTE");
  });

  it("es FINALIZADA en `hasta` (excluido) y después", () => {
    expect(estadoHabilitacion({ desde, hasta }, hasta)).toBe("FINALIZADA");
    expect(estadoHabilitacion({ desde, hasta }, new Date("2026-10-22T00:00:00Z"))).toBe("FINALIZADA");
  });
});
