import { describe, expect, it } from "vitest";
import {
  HORAS_FRECUENTES,
  ajustarHoras,
  ajustarMinutos,
  duracionTexto,
  formatearFechaLarga,
  formatearHora12,
  formatearRango,
  horaActualRedondeada,
  partesDeHora,
  rangoValido,
  sumarMinutos,
} from "./selector-hora";

describe("sumarMinutos", () => {
  it("suma dentro del día", () => {
    expect(sumarMinutos("17:30", 60)).toBe("18:30");
    expect(sumarMinutos("08:00", 30)).toBe("08:30");
  });
  it("no pasa de 23:55", () => {
    expect(sumarMinutos("23:00", 120)).toBe("23:55");
    expect(sumarMinutos("23:55", 30)).toBe("23:55");
  });
});

describe("horaActualRedondeada", () => {
  it("usa la hora de Bogotá (UTC-5) y redondea hacia abajo", () => {
    expect(horaActualRedondeada(new Date("2026-10-23T22:37:45Z"))).toBe("17:35");
    expect(horaActualRedondeada(new Date("2026-10-23T05:04:00Z"))).toBe("00:00");
  });
  it("no depende de la zona del proceso en el cruce de día", () => {
    expect(horaActualRedondeada(new Date("2026-10-24T03:59:00Z"))).toBe("22:55");
  });
});

describe("formatearHora12", () => {
  it("da formato legible", () => {
    expect(formatearHora12("17:30")).toBe("5:30 p. m.");
    expect(formatearHora12("00:05")).toBe("12:05 a. m.");
    expect(formatearHora12("12:00")).toBe("12:00 p. m.");
  });
});

describe("HORAS_FRECUENTES", () => {
  it("son las ocho horas rápidas en 24 h", () => {
    expect(HORAS_FRECUENTES).toEqual(["06:00", "07:00", "08:00", "09:00", "12:00", "18:00", "19:00", "21:00"]);
  });
});

describe("partesDeHora", () => {
  it("separa horas y minutos", () => {
    expect(partesDeHora("07:05")).toEqual({ horas: 7, minutos: 5 });
  });
  it("tolera vacío o inválido", () => {
    expect(partesDeHora("")).toEqual({ horas: 0, minutos: 0 });
    expect(partesDeHora("xx")).toEqual({ horas: 0, minutos: 0 });
  });
});

describe("ajustarHoras", () => {
  it("suma y resta una hora", () => {
    expect(ajustarHoras("08:30", 1)).toBe("09:30");
    expect(ajustarHoras("08:30", -1)).toBe("07:30");
  });
  it("da la vuelta entre 23 y 0 sin tocar minutos", () => {
    expect(ajustarHoras("23:45", 1)).toBe("00:45");
    expect(ajustarHoras("00:10", -1)).toBe("23:10");
  });
});

describe("ajustarMinutos", () => {
  it("avanza de 5 en 5 sin acarrear a la hora", () => {
    expect(ajustarMinutos("08:30", 1)).toBe("08:35");
    expect(ajustarMinutos("08:30", -1)).toBe("08:25");
  });
  it("da la vuelta entre 55 y 0", () => {
    expect(ajustarMinutos("08:55", 1)).toBe("08:00");
    expect(ajustarMinutos("08:00", -1)).toBe("08:55");
  });
  it("normaliza minutos fuera de la rejilla", () => {
    expect(ajustarMinutos("08:32", 1)).toBe("08:35");
    expect(ajustarMinutos("08:32", -1)).toBe("08:30");
  });
});

describe("duracionTexto", () => {
  it("formatea horas y minutos", () => {
    expect(duracionTexto("17:30", "19:00")).toBe("1 h 30 min");
    expect(duracionTexto("17:00", "19:00")).toBe("2 h");
    expect(duracionTexto("17:00", "17:45")).toBe("45 min");
  });
  it("da guion si falta un extremo o el rango no es válido", () => {
    expect(duracionTexto("", "19:00")).toBe("-");
    expect(duracionTexto("19:00", "19:00")).toBe("-");
    expect(duracionTexto("19:00", "18:00")).toBe("-");
  });
});

describe("rangoValido", () => {
  it("exige ambos extremos y hasta mayor que desde", () => {
    expect(rangoValido("17:00", "18:00")).toBe(true);
    expect(rangoValido("18:00", "18:00")).toBe(false);
    expect(rangoValido("19:00", "18:00")).toBe(false);
    expect(rangoValido("", "18:00")).toBe(false);
    expect(rangoValido("17:00", "")).toBe(false);
  });
});

describe("formatearRango", () => {
  it("une ambas horas en 12 h", () => {
    expect(formatearRango("17:30", "18:30")).toBe("5:30 p. m. – 6:30 p. m.");
  });
  it("dice 'No definido' si falta un extremo", () => {
    expect(formatearRango("17:30", "")).toBe("No definido");
    expect(formatearRango("", "")).toBe("No definido");
  });
});

describe("formatearFechaLarga", () => {
  it("escribe día, mes en español y año", () => {
    expect(formatearFechaLarga("2026-10-24")).toBe("24 de octubre de 2026");
    expect(formatearFechaLarga("2026-01-05")).toBe("5 de enero de 2026");
  });
  it("da guion si es vacía o inválida", () => {
    expect(formatearFechaLarga("")).toBe("-");
    expect(formatearFechaLarga("2026-13-40")).toBe("-");
    expect(formatearFechaLarga("2026-02-30")).toBe("-");
  });
});
