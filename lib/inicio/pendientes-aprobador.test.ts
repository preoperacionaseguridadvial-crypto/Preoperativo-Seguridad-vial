import { describe, expect, it } from "vitest";
import {
  POR_VENCER_MINUTOS,
  estadoVencimiento,
  resumirPendientes,
  textoPlazoAprobador,
} from "@/lib/inicio/pendientes-aprobador";
import { formatHora } from "@/lib/fechas/formato";

const MIN = 60_000;
const ahora = new Date("2026-10-23T15:00:00Z");

// Plazo de 60 min desde el envío: `minutosDesdeEnvio` min antes de `ahora`.
function pendiente(minutosDesdeEnvio: number, novedades = 0) {
  return {
    sede: null,
    completedAt: new Date(ahora.getTime() - minutosDesdeEnvio * MIN),
    revisadaSupervisorOleariariAt: null,
    _count: { novedades },
  };
}

describe("estadoVencimiento", () => {
  it("vencida cuando pasaron 60 min desde el envío", () => {
    expect(estadoVencimiento(pendiente(60), ahora)).toBe("vencida");
    expect(estadoVencimiento(pendiente(300), ahora)).toBe("vencida");
  });

  it("por vencer cuando faltan POR_VENCER_MINUTOS o menos", () => {
    expect(estadoVencimiento(pendiente(60 - POR_VENCER_MINUTOS), ahora)).toBe("por_vencer");
    expect(estadoVencimiento(pendiente(59), ahora)).toBe("por_vencer");
  });

  it("sin estado cuando aún queda holgura", () => {
    expect(estadoVencimiento(pendiente(60 - POR_VENCER_MINUTOS - 1), ahora)).toBeNull();
    expect(estadoVencimiento(pendiente(0), ahora)).toBeNull();
  });

  it("sin estado si la inspección no tiene fecha de envío", () => {
    expect(estadoVencimiento({ ...pendiente(0), completedAt: null }, ahora)).toBeNull();
  });
});

describe("resumirPendientes", () => {
  it("lista vacía: todo en cero", () => {
    expect(resumirPendientes([], ahora)).toEqual({ total: 0, conNovedades: 0, vencidas: 0 });
  });

  it("cuenta pendientes, con novedades y vencidas", () => {
    const lista = [pendiente(10), pendiente(90, 2), pendiente(70), pendiente(5, 1)];
    expect(resumirPendientes(lista, ahora)).toEqual({ total: 4, conNovedades: 2, vencidas: 2 });
  });

  it("por vencer no cuenta como vencida", () => {
    expect(resumirPendientes([pendiente(55)], ahora).vencidas).toBe(0);
  });
});

describe("textoPlazoAprobador", () => {
  const vence = new Date(ahora.getTime() + 20 * MIN);
  const vencio = new Date(ahora.getTime() - 20 * MIN);

  it("sin fecha de vencimiento no hay texto", () => {
    expect(
      textoPlazoAprobador({ fueraDeHorario: false, vence: null, vencido: false, habilitadoHasta: null, puedeDecidir: true }),
    ).toBeNull();
  });

  it("plazo vigente: texto normal con la hora límite", () => {
    const r = textoPlazoAprobador({ fueraDeHorario: false, vence, vencido: false, habilitadoHasta: null, puedeDecidir: true });
    expect(r).toEqual({ texto: `Plazo hasta las ${formatHora(vence)}`, vencido: false });
  });

  it("plazo vencido: texto crítico", () => {
    const r = textoPlazoAprobador({ fueraDeHorario: false, vence: vencio, vencido: true, habilitadoHasta: null, puedeDecidir: false });
    expect(r).toEqual({ texto: `Plazo vencido a las ${formatHora(vencio)}`, vencido: true });
  });

  it("plazo vencido con habilitación vigente: agrega hasta cuándo", () => {
    const hasta = new Date(ahora.getTime() + 30 * MIN);
    const r = textoPlazoAprobador({ fueraDeHorario: false, vence: vencio, vencido: true, habilitadoHasta: hasta, puedeDecidir: true });
    expect(r).toEqual({
      texto: `Plazo vencido a las ${formatHora(vencio)} · habilitado hasta las ${formatHora(hasta)}`,
      vencido: true,
    });
  });
});
