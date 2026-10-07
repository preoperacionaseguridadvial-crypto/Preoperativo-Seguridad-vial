import { describe, expect, it } from "vitest";
import { tiempoTranscurrido } from "@/lib/inspections/tiempo-transcurrido";

const ahora = new Date("2026-10-07T12:00:00Z");
const hace = (ms: number) => new Date(ahora.getTime() - ms);
const MIN = 60_000;

describe("tiempoTranscurrido", () => {
  it("devuelve 'hace un momento' para menos de un minuto", () => {
    expect(tiempoTranscurrido(hace(30_000), ahora)).toBe("hace un momento");
  });

  it("devuelve minutos por debajo de una hora", () => {
    expect(tiempoTranscurrido(hace(1 * MIN), ahora)).toBe("hace 1 min");
    expect(tiempoTranscurrido(hace(59 * MIN), ahora)).toBe("hace 59 min");
  });

  it("devuelve horas por debajo de un día", () => {
    expect(tiempoTranscurrido(hace(60 * MIN), ahora)).toBe("hace 1 h");
    expect(tiempoTranscurrido(hace(23 * 60 * MIN), ahora)).toBe("hace 23 h");
  });

  it("devuelve días a partir de 24 horas, en singular y plural", () => {
    expect(tiempoTranscurrido(hace(24 * 60 * MIN), ahora)).toBe("hace 1 día");
    expect(tiempoTranscurrido(hace(3 * 24 * 60 * MIN), ahora)).toBe("hace 3 días");
  });

  it("trata una fecha futura (reloj desfasado) como 'hace un momento'", () => {
    expect(tiempoTranscurrido(new Date(ahora.getTime() + 5 * MIN), ahora)).toBe(
      "hace un momento",
    );
  });

  it("devuelve null cuando no hay fecha", () => {
    expect(tiempoTranscurrido(null, ahora)).toBeNull();
  });
});
