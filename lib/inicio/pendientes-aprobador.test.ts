import { describe, expect, it } from "vitest";
import {
  POR_VENCER_MINUTOS,
  estadoVencimiento,
  resumirPendientes,
  textoPlazoAprobador,
} from "@/lib/inicio/pendientes-aprobador";
import type { EstadoPlazoAprobador } from "@/lib/horarios/estado-plazo-aprobador";
import { formatHora } from "@/lib/fechas/formato";

const MIN = 60_000;
// Hora de Bogotá (UTC-5) a instante.
const bog = (hhmm: string, dia = "2026-10-23") => new Date(`${dia}T${hhmm}:00-05:00`);

// Enviada en la ventana de la mañana: vence a las 8:00 a. m.
function pendiente(hhmmEnvio: string, novedades = 0) {
  return {
    sede: null,
    completedAt: bog(hhmmEnvio),
    revisadaSupervisorOleariariAt: null,
    _count: { novedades },
  };
}

describe("estadoVencimiento", () => {
  it("vencida desde que cierra su ventana (8:00 a. m.)", () => {
    expect(estadoVencimiento(pendiente("06:00"), bog("08:00"))).toBe("vencida");
    expect(estadoVencimiento(pendiente("06:00"), bog("12:00"))).toBe("vencida");
  });

  it("por vencer cuando faltan POR_VENCER_MINUTOS o menos con la ventana abierta", () => {
    const limite = new Date(bog("08:00").getTime() - POR_VENCER_MINUTOS * MIN);
    expect(estadoVencimiento(pendiente("06:00"), limite)).toBe("por_vencer");
    expect(estadoVencimiento(pendiente("06:00"), bog("07:59"))).toBe("por_vencer");
  });

  it("sin estado cuando aún queda holgura", () => {
    const antes = new Date(bog("08:00").getTime() - (POR_VENCER_MINUTOS + 1) * MIN);
    expect(estadoVencimiento(pendiente("06:00"), antes)).toBeNull();
    expect(estadoVencimiento(pendiente("06:00"), bog("06:00"))).toBeNull();
  });

  it("sin estado mientras su ventana aún no abre", () => {
    expect(estadoVencimiento(pendiente("10:00"), bog("15:00"))).toBeNull();
    expect(estadoVencimiento(pendiente("10:00"), bog("17:30"))).toBeNull();
  });

  it("sin estado si la inspección no tiene fecha de envío", () => {
    expect(estadoVencimiento({ ...pendiente("06:00"), completedAt: null }, bog("06:00"))).toBeNull();
  });
});

describe("resumirPendientes", () => {
  it("lista vacía: todo en cero", () => {
    expect(resumirPendientes([], bog("09:00"))).toEqual({ total: 0, conNovedades: 0, vencidas: 0 });
  });

  it("cuenta pendientes, con novedades y vencidas", () => {
    const lista = [pendiente("06:00"), pendiente("06:30", 2), pendiente("09:00"), pendiente("18:00", 1)];
    // A las 8:30: las dos de la mañana ya vencieron; la de las 9:00 y la de las 18:00 esperan su ventana.
    expect(resumirPendientes(lista, bog("08:30"))).toEqual({ total: 4, conNovedades: 2, vencidas: 2 });
  });

  it("por vencer no cuenta como vencida", () => {
    expect(resumirPendientes([pendiente("06:00")], bog("07:55")).vencidas).toBe(0);
  });
});

describe("textoPlazoAprobador", () => {
  const abre = bog("17:45");
  const vence = bog("20:00");
  const estado = (over: Partial<EstadoPlazoAprobador>): EstadoPlazoAprobador => ({
    fueraDeHorario: false,
    abre,
    vence,
    vencido: false,
    fueraDeVentana: false,
    habilitadoHasta: null,
    puedeDecidir: true,
    ...over,
  });

  it("sin fecha de vencimiento no hay texto", () => {
    expect(textoPlazoAprobador(estado({ abre: null, vence: null }))).toBeNull();
  });

  it("ventana abierta: texto normal con la hora límite", () => {
    expect(textoPlazoAprobador(estado({}))).toEqual({ texto: `Plazo hasta las ${formatHora(vence)}`, vencido: false });
  });

  it("ventana aún sin abrir: indica desde cuándo se puede decidir", () => {
    const r = textoPlazoAprobador(estado({ fueraDeVentana: true, puedeDecidir: false }));
    expect(r).toEqual({ texto: `Se puede decidir desde las ${formatHora(abre)}`, vencido: false });
  });

  it("ventana aún sin abrir con habilitación vigente: agrega hasta cuándo", () => {
    const hasta = bog("16:00");
    const r = textoPlazoAprobador(estado({ fueraDeVentana: true, habilitadoHasta: hasta }));
    expect(r).toEqual({
      texto: `Se puede decidir desde las ${formatHora(abre)} · habilitado hasta las ${formatHora(hasta)}`,
      vencido: false,
    });
  });

  it("plazo vencido: texto crítico", () => {
    const r = textoPlazoAprobador(estado({ vencido: true, fueraDeVentana: true, puedeDecidir: false }));
    expect(r).toEqual({ texto: `Plazo vencido a las ${formatHora(vence)}`, vencido: true });
  });

  it("plazo vencido con habilitación vigente: agrega hasta cuándo", () => {
    const hasta = bog("21:00");
    const r = textoPlazoAprobador(estado({ vencido: true, fueraDeVentana: true, habilitadoHasta: hasta }));
    expect(r).toEqual({
      texto: `Plazo vencido a las ${formatHora(vence)} · habilitado hasta las ${formatHora(hasta)}`,
      vencido: true,
    });
  });
});
