import type { EstadoPlazoAprobador } from "@/lib/horarios/estado-plazo-aprobador";
import { formatHora } from "@/lib/fechas/formato";

// Presentación del inicio de los aprobadores: contadores del encabezado de
// "Pendientes por revisar" y texto del horario de decisión. Puro y sin
// dependencias de servidor; la regla real del horario está en plazo-aprobacion.

export type ResumenPendientes = { total: number; conNovedades: number };

export function resumirPendientes(pendientes: { _count: { novedades: number } }[]): ResumenPendientes {
  return {
    total: pendientes.length,
    conNovedades: pendientes.filter((p) => p._count.novedades > 0).length,
  };
}

/** Línea del horario de decisión de una pendiente: hasta cuándo está abierta la ventana o cuándo abre la próxima. */
export function textoPlazoAprobador(plazo: EstadoPlazoAprobador): string {
  if (plazo.cierra) return `Ventana de aprobación abierta hasta las ${formatHora(plazo.cierra)}`;
  const habilitado = plazo.habilitadoHasta ? ` · habilitado hasta las ${formatHora(plazo.habilitadoHasta)}` : "";
  return `Se puede decidir desde las ${plazo.abre ? formatHora(plazo.abre) : ""}${habilitado}`;
}
