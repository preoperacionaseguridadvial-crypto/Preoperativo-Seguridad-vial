import { describe, expect, it } from "vitest";
import { DIAS_POR_VENCER, estadoVencimiento } from "@/lib/admin/vencimientos";

const AHORA = new Date("2026-09-18T12:00:00.000Z");
const enDias = (dias: number) => new Date(AHORA.getTime() + dias * 24 * 60 * 60 * 1000);

describe("estadoVencimiento", () => {
  it("SIN_FECHA cuando no hay fecha cargada", () => {
    expect(estadoVencimiento(null, AHORA)).toBe("SIN_FECHA");
    expect(estadoVencimiento(undefined, AHORA)).toBe("SIN_FECHA");
  });

  // Mismo criterio que `getDashboardMetrics` (fecha < ahora = vencida).
  it("VENCIDO cuando la fecha ya pasó", () => {
    expect(estadoVencimiento(enDias(-1), AHORA)).toBe("VENCIDO");
    expect(estadoVencimiento(new Date(AHORA.getTime() - 1), AHORA)).toBe("VENCIDO");
  });

  it("POR_VENCER dentro de la ventana de aviso (incluido el límite)", () => {
    expect(estadoVencimiento(AHORA, AHORA)).toBe("POR_VENCER");
    expect(estadoVencimiento(enDias(DIAS_POR_VENCER), AHORA)).toBe("POR_VENCER");
  });

  it("VIGENTE cuando falta más que la ventana de aviso", () => {
    expect(estadoVencimiento(enDias(DIAS_POR_VENCER + 1), AHORA)).toBe("VIGENTE");
  });
});
