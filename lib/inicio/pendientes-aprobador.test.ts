import { describe, expect, it } from "vitest";
import { resumirPendientes, textoPlazoAprobador } from "@/lib/inicio/pendientes-aprobador";
import type { EstadoPlazoAprobador } from "@/lib/horarios/estado-plazo-aprobador";
import { formatHora } from "@/lib/fechas/formato";

// Hora de Bogotá (UTC-5) a instante.
const bog = (hhmm: string, dia = "2026-10-23") => new Date(`${dia}T${hhmm}:00-05:00`);

const pendiente = (novedades = 0) => ({ _count: { novedades } });

describe("resumirPendientes", () => {
  it("lista vacía: todo en cero", () => {
    expect(resumirPendientes([])).toEqual({ total: 0, conNovedades: 0 });
  });

  it("cuenta pendientes y con novedades", () => {
    expect(resumirPendientes([pendiente(), pendiente(2), pendiente(), pendiente(1)])).toEqual({
      total: 4,
      conNovedades: 2,
    });
  });
});

describe("textoPlazoAprobador", () => {
  const estado = (over: Partial<EstadoPlazoAprobador>): EstadoPlazoAprobador => ({
    fueraDeHorario: false,
    cierra: null,
    abre: null,
    fueraDeVentana: false,
    habilitadoHasta: null,
    puedeDecidir: true,
    ...over,
  });

  it("ventana abierta: indica hasta qué hora", () => {
    const cierra = bog("20:00");
    expect(textoPlazoAprobador(estado({ cierra }))).toBe(`Ventana de aprobación abierta hasta las ${formatHora(cierra)}`);
  });

  it("fuera de ventana: indica desde cuándo se puede decidir", () => {
    const abre = bog("17:45");
    expect(textoPlazoAprobador(estado({ abre, fueraDeVentana: true, puedeDecidir: false }))).toBe(
      `Se puede decidir desde las ${formatHora(abre)}`,
    );
  });

  it("fuera de ventana con habilitación vigente: agrega hasta cuándo", () => {
    const abre = bog("17:45");
    const hasta = bog("16:00");
    expect(textoPlazoAprobador(estado({ abre, fueraDeVentana: true, habilitadoHasta: hasta }))).toBe(
      `Se puede decidir desde las ${formatHora(abre)} · habilitado hasta las ${formatHora(hasta)}`,
    );
  });
});
