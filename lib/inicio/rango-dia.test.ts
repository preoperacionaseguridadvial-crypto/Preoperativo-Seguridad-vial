import { describe, expect, it } from "vitest";
import { rangoDiaBogota } from "@/lib/inicio/rango-dia";

describe("rangoDiaBogota", () => {
  it("el día de Bogotá (UTC-5) empieza a las 05:00 UTC y dura 24 h", () => {
    const { desde, hasta } = rangoDiaBogota(new Date("2026-10-07T15:00:00Z"));
    expect(desde.toISOString()).toBe("2026-10-07T05:00:00.000Z");
    expect(hasta.toISOString()).toBe("2026-10-08T04:59:59.999Z");
  });

  it("a las 22:00 en Bogotá (03:00 UTC del día siguiente) sigue siendo el mismo día local", () => {
    const { desde } = rangoDiaBogota(new Date("2026-10-08T03:00:00Z"));
    expect(desde.toISOString()).toBe("2026-10-07T05:00:00.000Z");
  });

  it("justo después de la medianoche local empieza el día nuevo", () => {
    const { desde } = rangoDiaBogota(new Date("2026-10-08T05:00:00Z"));
    expect(desde.toISOString()).toBe("2026-10-08T05:00:00.000Z");
  });

  it("antes de las 05:00 UTC todavía es el día local anterior", () => {
    const { desde } = rangoDiaBogota(new Date("2026-10-08T04:59:00Z"));
    expect(desde.toISOString()).toBe("2026-10-07T05:00:00.000Z");
  });
});
