import { describe, expect, it } from "vitest";
import { iniciadaEnLaVentana } from "@/lib/horarios/habilitaciones";
import { ventanaActual } from "@/lib/horarios/ventanas";

// Turno 1: 05:45–06:30 Bogotá = 10:45–11:30 UTC.
const ventana = ventanaActual(new Date("2026-10-20T11:00:00Z"));

describe("iniciadaEnLaVentana", () => {
  it("es true si empezó dentro de la misma ventana", () => {
    expect(iniciadaEnLaVentana(ventana, new Date("2026-10-20T10:50:00Z"))).toBe(true);
  });

  it("incluye el instante exacto de apertura", () => {
    expect(iniciadaEnLaVentana(ventana, new Date("2026-10-20T10:45:00Z"))).toBe(true);
  });

  it("es false si empezó antes de la apertura de la ventana actual", () => {
    expect(iniciadaEnLaVentana(ventana, new Date("2026-10-20T10:44:59Z"))).toBe(false);
  });

  it("es false si empezó en una ventana anterior (otro turno o día)", () => {
    expect(iniciadaEnLaVentana(ventana, new Date("2026-10-19T22:50:00Z"))).toBe(false);
  });

  it("es false si no hay ventana abierta", () => {
    expect(iniciadaEnLaVentana(null, new Date("2026-10-20T11:00:00Z"))).toBe(false);
  });
});
