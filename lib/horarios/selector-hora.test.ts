import { describe, expect, it } from "vitest";
import {
  aHHMM,
  aPartes,
  formatearHora12,
  horaActualRedondeada,
  sumarMinutos,
} from "./selector-hora";

describe("aPartes", () => {
  it("convierte medianoche y mediodía", () => {
    expect(aPartes("00:00")).toEqual({ hora12: 12, minuto: 0, periodo: "AM" });
    expect(aPartes("12:00")).toEqual({ hora12: 12, minuto: 0, periodo: "PM" });
  });
  it("convierte horas de la mañana y la tarde", () => {
    expect(aPartes("05:30")).toEqual({ hora12: 5, minuto: 30, periodo: "AM" });
    expect(aPartes("17:30")).toEqual({ hora12: 5, minuto: 30, periodo: "PM" });
    expect(aPartes("23:55")).toEqual({ hora12: 11, minuto: 55, periodo: "PM" });
    expect(aPartes("13:00")).toEqual({ hora12: 1, minuto: 0, periodo: "PM" });
  });
  it("redondea los minutos hacia abajo a múltiplos de 5", () => {
    expect(aPartes("08:59").minuto).toBe(55);
    expect(aPartes("08:07").minuto).toBe(5);
  });
});

describe("aHHMM", () => {
  it("convierte 12 a. m. y 12 p. m.", () => {
    expect(aHHMM({ hora12: 12, minuto: 0, periodo: "AM" })).toBe("00:00");
    expect(aHHMM({ hora12: 12, minuto: 5, periodo: "PM" })).toBe("12:05");
  });
  it("convierte horas normales con cero a la izquierda", () => {
    expect(aHHMM({ hora12: 5, minuto: 5, periodo: "AM" })).toBe("05:05");
    expect(aHHMM({ hora12: 5, minuto: 30, periodo: "PM" })).toBe("17:30");
    expect(aHHMM({ hora12: 11, minuto: 55, periodo: "PM" })).toBe("23:55");
  });
  it("es inversa de aPartes para minutos múltiplos de 5", () => {
    for (let m = 0; m < 24 * 60; m += 5) {
      const hhmm = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      expect(aHHMM(aPartes(hhmm))).toBe(hhmm);
    }
  });
});

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
