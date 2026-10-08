import { afterEach, describe, expect, it } from "vitest";
import {
  claveDiaBogota,
  finDiaBogotaDeFecha,
  formatFecha,
  formatFechaCorta,
  formatFechaHora,
  formatFechaHoraMedia,
  formatFechaLarga,
  formatFechaSoloDia,
  formatFechaSoloDiaCompacta,
  formatHora,
  inicioDiaBogotaDeFecha,
  rangoDiaBogota,
} from "@/lib/fechas/formato";

// El formato debe depender SOLO del instante, nunca de la zona horaria del
// servidor: se prueba en varias zonas cambiando `process.env.TZ` en caliente.
const ZONAS = ["UTC", "Asia/Tokyo", "America/Los_Angeles", "America/Bogota"];
const TZ_ORIGINAL = process.env.TZ;

// ICU puede usar espacios finos (U+202F / U+00A0) en "p. m.": se normalizan.
const n = (s: string) => s.replace(/[\u202f\u00a0]/g, " ");

// 00:30 UTC del 8 oct = 19:30 del 7 oct en Bogotá (UTC-5).
const INSTANTE = new Date("2026-10-08T00:30:00Z");

afterEach(() => {
  if (TZ_ORIGINAL === undefined) delete process.env.TZ;
  else process.env.TZ = TZ_ORIGINAL;
});

describe.each(ZONAS)("formateo en hora de Colombia (TZ del proceso = %s)", (zona) => {
  const usar = () => {
    process.env.TZ = zona;
  };

  it("formatFechaHora muestra 7 oct 2026 19:30 de Bogotá", () => {
    usar();
    expect(n(formatFechaHora(INSTANTE))).toBe("7/10/26, 7:30 p. m.");
  });

  it("formatHora muestra la hora de Bogotá", () => {
    usar();
    expect(n(formatHora(INSTANTE))).toBe("7:30 p. m.");
  });

  it("formatFecha y formatFechaCorta muestran el día de Bogotá, no el de UTC", () => {
    usar();
    expect(formatFecha(INSTANTE)).toBe("7/10/2026");
    expect(formatFechaCorta(INSTANTE)).toBe("7/10/26");
  });

  it("formatFechaLarga y formatFechaHoraMedia usan Bogotá", () => {
    usar();
    expect(formatFechaLarga(INSTANTE)).toBe("miércoles, 7 de octubre de 2026");
    expect(n(formatFechaHoraMedia(INSTANTE))).toBe("7/10/2026, 7:30 p. m.");
  });

  it("la madrugada de Bogotá (05:10 UTC) es 12:10 a. m. del mismo día", () => {
    usar();
    expect(n(formatFechaHora(new Date("2026-10-08T05:10:00Z")))).toBe("8/10/26, 12:10 a. m.");
  });

  it("claveDiaBogota devuelve el día calendario de Bogotá", () => {
    usar();
    expect(claveDiaBogota(INSTANTE)).toBe("2026-10-07");
    expect(claveDiaBogota(new Date("2026-10-08T05:00:00Z"))).toBe("2026-10-08");
    expect(claveDiaBogota(new Date("2026-10-08T04:59:59Z"))).toBe("2026-10-07");
  });

  it("un día calendario (medianoche UTC) se sigue mostrando como ese día, no el anterior", () => {
    usar();
    const vencimiento = new Date("2026-10-04T00:00:00Z");
    expect(formatFechaSoloDia(vencimiento)).toBe("4/10/2026");
    expect(formatFechaSoloDiaCompacta(vencimiento)).toBe("4 oct 2026");
  });
});

describe("valores vacíos", () => {
  it("devuelven un guion largo", () => {
    expect(formatFechaHora(null)).toBe("—");
    expect(formatHora(undefined)).toBe("—");
    expect(formatFecha(null)).toBe("—");
    expect(formatFechaSoloDia(null)).toBe("—");
  });
});

describe("límites del día de Bogotá", () => {
  it("las 19:30 de Bogotá siguen siendo 'hoy' (aunque en UTC ya sea mañana)", () => {
    const { desde, hasta } = rangoDiaBogota(INSTANTE);
    expect(desde.toISOString()).toBe("2026-10-07T05:00:00.000Z");
    expect(hasta.toISOString()).toBe("2026-10-08T04:59:59.999Z");
    expect(INSTANTE >= desde && INSTANTE <= hasta).toBe(true);
  });

  it("inicio y fin del día de Bogotá de un día calendario (medianoche UTC)", () => {
    const dia = new Date("2026-09-10T00:00:00Z");
    expect(inicioDiaBogotaDeFecha(dia).toISOString()).toBe("2026-09-10T05:00:00.000Z");
    expect(finDiaBogotaDeFecha(dia).toISOString()).toBe("2026-09-11T04:59:59.999Z");
  });

  it("no depende de la zona horaria del proceso", () => {
    process.env.TZ = "Asia/Tokyo";
    expect(rangoDiaBogota(INSTANTE).desde.toISOString()).toBe("2026-10-07T05:00:00.000Z");
  });
});
