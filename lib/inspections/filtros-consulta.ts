// Lógica pura de la consulta de inspecciones (filtros de la URL, conteos de
// las tarjetas y etiquetas de estado). Sin Prisma para poder probarse en
// entorno node (filtros-consulta.test.ts).

export const ESTADOS_FILTRO = [
  "EN_PROCESO",
  "ENVIADA",
  "PENDIENTE_APROBACION",
  "APROBADA",
  "RECHAZADA",
  "NO_APTA_PARA_OPERAR",
  "CANCELADA",
] as const;

export type EstadoFiltro = (typeof ESTADOS_FILTRO)[number];

export type ParamsConsulta = {
  conductor?: string;
  placa?: string;
  estado?: string;
  fechaDesde?: string;
  fechaHasta?: string;
};

function limpiar(valor: string | undefined): string | undefined {
  const t = valor?.trim();
  return t ? t : undefined;
}

/** "YYYY-MM-DD" real -> medianoche UTC; cualquier otra cosa -> undefined. */
function parsearDia(valor: string | undefined): Date | undefined {
  const t = limpiar(valor);
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return undefined;
  const fecha = new Date(`${t}T00:00:00.000Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== t) return undefined;
  return fecha;
}

export function parsearFiltrosConsulta(params: ParamsConsulta) {
  const estadoLimpio = limpiar(params.estado);
  const estado = (ESTADOS_FILTRO as readonly string[]).includes(estadoLimpio ?? "")
    ? (estadoLimpio as EstadoFiltro)
    : undefined;
  const fechaDesde = parsearDia(params.fechaDesde);
  const fechaHasta = parsearDia(params.fechaHasta);
  const conductor = limpiar(params.conductor);
  const placa = limpiar(params.placa);

  return {
    filtros: { conductor, placa, estado, fechaDesde, fechaHasta },
    hayFiltrosActivos: Boolean(conductor || placa || estado || fechaDesde || fechaHasta),
    valoresFormulario: {
      conductor: conductor ?? "",
      placa: placa ?? "",
      estado: estado ?? "",
      fechaDesde: fechaDesde ? limpiar(params.fechaDesde)! : "",
      fechaHasta: fechaHasta ? limpiar(params.fechaHasta)! : "",
    },
  };
}

export function contarPorEstado(inspecciones: { status: string }[]) {
  const cuenta = (s: string) => inspecciones.filter((i) => i.status === s).length;
  return {
    total: inspecciones.length,
    aprobadas: cuenta("APROBADA"),
    pendientes: cuenta("PENDIENTE_APROBACION"),
    canceladas: cuenta("CANCELADA"),
  };
}

export function etiquetaConteo(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

export function etiquetaEstado(status: string): string {
  switch (status) {
    case "APROBADA":
      return "Aprobada";
    case "RECHAZADA":
      return "Rechazada";
    case "NO_APTA_PARA_OPERAR":
      return "No apta";
    case "PENDIENTE_APROBACION":
      return "Pendiente";
    case "ENVIADA":
      return "Enviada";
    case "EN_PROCESO":
      return "En proceso";
    case "CANCELADA":
      return "Cancelada";
    default:
      return status;
  }
}
