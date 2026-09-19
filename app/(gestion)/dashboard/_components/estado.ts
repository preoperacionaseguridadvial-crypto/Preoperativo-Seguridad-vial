import { porcentaje, formatoPorcentaje } from "./metricas";

// Lógica pura de la barra de estado y de las "píldoras" de estado de las
// tablas (estado.test.ts). Las etiquetas legibles de cada `InspectionStatus`
// viven en `estadoLegible` (lib/inspections/reportes-queries.ts); acá solo
// se decide el tono, para no importar Prisma en código que se prueba puro.

export type SegmentoEstado = {
  key: "aprobadas" | "rechazadas" | "pendientes" | "otros";
  label: string;
  valor: number;
  /** % del total con un decimal — también es el ancho del segmento. */
  porcentaje: number;
  /** Texto dentro del segmento solo si cabe con holgura; `null` deja la lectura a la leyenda y al tooltip. */
  etiquetaInterna: string | null;
};

// Umbrales de ancho (en % de la barra) para etiquetar dentro del segmento:
// una etiqueta que no cabe no se recorta, se omite.
const ANCHO_MIN_ETIQUETA_COMPLETA = 22;
const ANCHO_MIN_ETIQUETA_NUMERO = 10;

function etiquetaInterna(valor: number, pct: number): string | null {
  if (valor === 0) return null;
  if (pct >= ANCHO_MIN_ETIQUETA_COMPLETA) return `${valor} (${formatoPorcentaje(pct)})`;
  if (pct >= ANCHO_MIN_ETIQUETA_NUMERO) return String(valor);
  return null;
}

/**
 * Reparte el total del período en aprobadas / rechazadas / pendientes más un
 * segmento "otros" (en proceso, enviadas, canceladas, revisadas no aptas…)
 * para que las partes sumen el total que muestran las tarjetas.
 */
export function segmentosEstado(entrada: {
  total: number;
  aprobadas: number;
  rechazadas: number;
  pendientes: number;
}): { total: number; segmentos: SegmentoEstado[] } {
  const { aprobadas, rechazadas, pendientes } = entrada;
  const total = Math.max(entrada.total, aprobadas + rechazadas + pendientes);
  const otros = total - aprobadas - rechazadas - pendientes;

  const base: { key: SegmentoEstado["key"]; label: string; valor: number }[] = [
    { key: "aprobadas", label: "Aprobadas", valor: aprobadas },
    { key: "rechazadas", label: "Rechazadas", valor: rechazadas },
    { key: "pendientes", label: "Pendientes", valor: pendientes },
  ];
  if (otros > 0) base.push({ key: "otros", label: "Otros estados", valor: otros });

  const segmentos = base.map((s) => {
    const pct = porcentaje(s.valor, total);
    return { ...s, porcentaje: pct, etiquetaInterna: etiquetaInterna(s.valor, pct) };
  });
  return { total, segmentos };
}

export type TonoEstado = "ok" | "falla" | "aviso" | "info" | "neutro";

export function tonoEstado(status: string): TonoEstado {
  switch (status) {
    case "APROBADA":
      return "ok";
    case "RECHAZADA":
    case "NO_APTA_PARA_OPERAR":
      return "falla";
    case "PENDIENTE_APROBACION":
      return "aviso";
    case "EN_PROCESO":
    case "ENVIADA":
      return "info";
    default:
      return "neutro";
  }
}

/** Columna "Aprobación": sin revisión del supervisor está pendiente, sea cual sea el estado. */
export function tonoAprobacion(revisada: boolean, status: string): TonoEstado {
  return revisada ? tonoEstado(status) : "aviso";
}
