// Textos y destinos del banner de alertas del dashboard (alertas.test.ts).
// Solo alertas con dato real detrás — el sistema no tiene horario de
// trabajador, así que no hay "fuera de horario" (ver cabecera de
// lib/inspections/reportes-queries.ts).

const RUTA_CONSULTA = "/consulta-inspecciones";

/**
 * "1 inspección rechazada y 2 pendientes de aprobación requieren tu
 * atención". `null` cuando no hay nada que atender.
 */
export function textoBanner(rechazadas: number, pendientes: number): string | null {
  if (rechazadas === 0 && pendientes === 0) return null;

  const soloUnTipo = rechazadas === 0 || pendientes === 0;
  const partes: string[] = [];
  if (rechazadas > 0) {
    partes.push(rechazadas === 1 ? "1 inspección rechazada" : `${rechazadas} inspecciones rechazadas`);
  }
  if (pendientes > 0) {
    if (soloUnTipo) {
      partes.push(pendientes === 1 ? "1 inspección pendiente de aprobación" : `${pendientes} inspecciones pendientes de aprobación`);
    } else {
      partes.push(pendientes === 1 ? "1 pendiente de aprobación" : `${pendientes} pendientes de aprobación`);
    }
  }

  const verbo = rechazadas + pendientes === 1 ? "requiere" : "requieren";
  return `${partes.join(" y ")} ${verbo} tu atención`;
}

/** Listado filtrado cuando la alerta es de un solo tipo; listado completo cuando hay ambos. */
export function hrefBanner(rechazadas: number, pendientes: number): string {
  if (rechazadas > 0 && pendientes === 0) return `${RUTA_CONSULTA}?estado=RECHAZADA`;
  if (pendientes > 0 && rechazadas === 0) return `${RUTA_CONSULTA}?estado=PENDIENTE_APROBACION`;
  return RUTA_CONSULTA;
}

export type AlertaAdicional = { texto: string; href?: string };

const MAX_ALERTAS_VEHICULO = 3;
const MIN_NOVEDADES_VEHICULO = 2;
const MIN_FALLAS_ITEM = 3;

export function alertasAdicionales(entrada: {
  vehiculos: { placa: string; novedades: number }[];
  topFalla: { nombre: string; cantidad: number } | undefined;
}): AlertaAdicional[] {
  const alertas: AlertaAdicional[] = [...entrada.vehiculos]
    .filter((v) => v.novedades >= MIN_NOVEDADES_VEHICULO)
    .sort((a, b) => b.novedades - a.novedades)
    .slice(0, MAX_ALERTAS_VEHICULO)
    .map((v) => ({
      texto: `Vehículo ${v.placa} con ${v.novedades} novedades en el período`,
      href: `${RUTA_CONSULTA}?placa=${encodeURIComponent(v.placa)}`,
    }));

  const { topFalla } = entrada;
  if (topFalla && topFalla.cantidad >= MIN_FALLAS_ITEM) {
    alertas.push({ texto: `“${topFalla.nombre}” presenta ${topFalla.cantidad} fallas en el período` });
  }
  return alertas;
}
