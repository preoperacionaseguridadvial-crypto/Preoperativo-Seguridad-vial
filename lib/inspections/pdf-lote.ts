import type { InspectionStatus, Role } from "@/generated/prisma/client";
import { claveDiaBogota } from "@/lib/fechas/formato";
import { puedeDescargarPdf } from "./pdf-acceso";

// Lógica pura de la descarga de PDFs (individual y en lote). Sin Prisma ni
// react-pdf para poder probarse en entorno node.

/** Tope de PDFs por ZIP: cada render es secuencial y pesa CPU en el servidor. */
export const MAX_PDFS_POR_LOTE = 300;

type ValoresFiltros = {
  conductor: string;
  placa: string;
  estado: string;
  fechaDesde: string;
  fechaHasta: string;
};

/** Query string con los filtros activos (los mismos params que la página). */
export function queryStringFiltros(valores: ValoresFiltros): string {
  const params = new URLSearchParams();
  for (const clave of ["conductor", "placa", "estado", "fechaDesde", "fechaHasta"] as const) {
    if (valores[clave]) params.set(clave, valores[clave]);
  }
  return params.toString();
}

export function contarDescargables(rol: Role, inspecciones: { status: string }[]): number {
  return inspecciones.filter((i) => puedeDescargarPdf(rol, i.status as InspectionStatus)).length;
}

/** Nombre del PDF FO-SVS-23 (único por el id), compartido por el endpoint individual y el lote. */
export function nombreArchivoPdf(inspeccion: { placa: string; startedAt: Date; id: string }): string {
  const fecha = claveDiaBogota(inspeccion.startedAt).replaceAll("-", "");
  const placa = inspeccion.placa.replace(/[^a-zA-Z0-9]/g, "");
  return `FO-SVS-23_${placa}_${fecha}_${inspeccion.id}.pdf`;
}

export function nombreArchivoZip(
  rango: { fechaDesde: string; fechaHasta: string },
  hoy: Date,
): string {
  const { fechaDesde, fechaHasta } = rango;
  if (fechaDesde && fechaHasta) return `inspecciones_${fechaDesde}_${fechaHasta}.zip`;
  if (fechaDesde) return `inspecciones_desde_${fechaDesde}.zip`;
  if (fechaHasta) return `inspecciones_hasta_${fechaHasta}.zip`;
  return `inspecciones_${claveDiaBogota(hoy)}.zip`;
}
