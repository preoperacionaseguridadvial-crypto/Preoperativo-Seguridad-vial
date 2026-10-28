import { plazoVencido, ventanaAprobacion, type DatosPlazo } from "@/lib/horarios/plazo-aprobacion";
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
  const ventana = ventanaAprobacion(inspection);
  if (ventana === null) return null;
  if (plazoVencido(inspection, ahora)) return "vencida";
  // Antes de que abra su ventana no hay nada por vencer.
  if (ahora < ventana.inicio) return null;
  return ventana.fin.getTime() - ahora.getTime() <= POR_VENCER_MINUTOS * 60_000 ? "por_vencer" : null;
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
  const habilitado = plazo.habilitadoHasta ? ` · habilitado hasta las ${formatHora(plazo.habilitadoHasta)}` : "";
  if (plazo.vencido) return { texto: `Plazo vencido a las ${formatHora(plazo.vence)}${habilitado}`, vencido: true };
  // Su ventana aún no abre: se puede decidir desde que abra (o ya, con habilitación).
  if (plazo.fueraDeVentana && plazo.abre) {
    return { texto: `Se puede decidir desde las ${formatHora(plazo.abre)}${habilitado}`, vencido: false };
  }
  return { texto: `Plazo hasta las ${formatHora(plazo.vence)}`, vencido: false };
}
