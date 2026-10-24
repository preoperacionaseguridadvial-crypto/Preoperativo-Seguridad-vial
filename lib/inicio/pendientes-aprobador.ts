import { PLAZO_APROBACION_MINUTOS, plazoVencido, vencePlazo, type DatosPlazo } from "@/lib/horarios/plazo-aprobacion";
import type { EstadoPlazoAprobador } from "@/lib/horarios/estado-plazo-aprobador";
import { formatHora } from "@/lib/fechas/formato";

// Presentación del inicio de los aprobadores: contadores del encabezado de
// "Pendientes por revisar", chip de vencimiento y texto del plazo. Puro y sin
// dependencias de servidor; la regla real del plazo sigue en plazo-aprobacion.

/** Faltando este tiempo (o menos) para el vencimiento, la inspección está "por vencer". */
export const POR_VENCER_MINUTOS = 15;

type ParaResumen = DatosPlazo & { _count: { novedades: number } };

export type ResumenPendientes = { total: number; conNovedades: number; vencidas: number };

export function estadoVencimiento(inspection: DatosPlazo, ahora: Date): "vencida" | "por_vencer" | null {
  const vence = vencePlazo(inspection);
  if (vence === null) return null;
  if (plazoVencido(inspection, ahora)) return "vencida";
  const restanteMs = vence.getTime() - ahora.getTime();
  return restanteMs <= Math.min(POR_VENCER_MINUTOS, PLAZO_APROBACION_MINUTOS) * 60_000 ? "por_vencer" : null;
}

export function resumirPendientes(pendientes: ParaResumen[], ahora: Date): ResumenPendientes {
  return {
    total: pendientes.length,
    conNovedades: pendientes.filter((p) => p._count.novedades > 0).length,
    vencidas: pendientes.filter((p) => plazoVencido(p, ahora)).length,
  };
}

/** Línea del plazo de una pendiente; `vencido` pide pintarla en rojo. `null` si no hay plazo. */
export function textoPlazoAprobador(plazo: EstadoPlazoAprobador): { texto: string; vencido: boolean } | null {
  if (plazo.vence === null) return null;
  if (!plazo.vencido) return { texto: `Plazo hasta las ${formatHora(plazo.vence)}`, vencido: false };
  const base = `Plazo vencido a las ${formatHora(plazo.vence)}`;
  return {
    texto: plazo.habilitadoHasta ? `${base} · habilitado hasta las ${formatHora(plazo.habilitadoHasta)}` : base,
    vencido: true,
  };
}
