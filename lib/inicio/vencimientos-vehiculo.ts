import { estadoVencimiento, type EstadoVencimiento } from "@/lib/admin/vencimientos";
import { formatFechaSoloDiaCompacta } from "@/lib/fechas/formato";

// Alertas de SOAT / tecnomecánica de un vehículo para el inicio por rol.
// Reusa `estadoVencimiento` (mismo umbral de "por vencer" que la hoja de
// vida y el dashboard); acá solo se arma el texto y el orden.

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export type AlertaDocumento = {
  documento: "SOAT" | "Tecnomecánica";
  estado: "VENCIDO" | "POR_VENCER";
  fecha: Date;
  texto: string;
};

export type FechasVehiculo = {
  fechaVencimientoSoat: Date | null;
  fechaVencimientoTecnicomecanica: Date | null;
};

function diaUtc(fecha: Date) {
  return Math.floor(fecha.getTime() / MS_POR_DIA);
}

function alertaDe(
  documento: AlertaDocumento["documento"],
  fecha: Date | null,
  ahora: Date,
): AlertaDocumento | null {
  const estado = estadoVencimiento(fecha, ahora);
  if (!fecha || (estado !== "VENCIDO" && estado !== "POR_VENCER")) return null;
  if (estado === "VENCIDO") {
    const vencido = documento === "SOAT" ? "vencido" : "vencida";
    return { documento, estado, fecha, texto: `${documento} ${vencido} el ${formatFechaSoloDiaCompacta(fecha)}` };
  }
  const dias = diaUtc(fecha) - diaUtc(ahora);
  const cuando = dias <= 0 ? "hoy" : `en ${dias} ${dias === 1 ? "día" : "días"}`;
  return { documento, estado, fecha, texto: `${documento} vence ${cuando}` };
}

export function alertasDocumentosVehiculo(vehiculo: FechasVehiculo, ahora: Date = new Date()): AlertaDocumento[] {
  const alertas = [
    alertaDe("SOAT", vehiculo.fechaVencimientoSoat, ahora),
    alertaDe("Tecnomecánica", vehiculo.fechaVencimientoTecnicomecanica, ahora),
  ].filter((alerta): alerta is AlertaDocumento => alerta !== null);
  // Vencidos primero; Array.sort es estable, así que SOAT queda antes que tecnomecánica.
  return alertas.sort((a, b) => Number(b.estado === "VENCIDO") - Number(a.estado === "VENCIDO"));
}

export type ChipDocumento = {
  documento: AlertaDocumento["documento"];
  estado: EstadoVencimiento;
  texto: string;
  tono: "ok" | "warn" | "crit" | "neutral";
};

const TONO_POR_ESTADO: Record<EstadoVencimiento, ChipDocumento["tono"]> = {
  VIGENTE: "ok",
  POR_VENCER: "warn",
  VENCIDO: "crit",
  SIN_FECHA: "neutral",
};

/** Un chip por documento (SOAT y tecnomecánica), con o sin alerta, para la tarjeta del vehículo. */
export function chipsDocumentosVehiculo(vehiculo: FechasVehiculo, ahora: Date = new Date()): ChipDocumento[] {
  const documentos: [AlertaDocumento["documento"], Date | null][] = [
    ["SOAT", vehiculo.fechaVencimientoSoat],
    ["Tecnomecánica", vehiculo.fechaVencimientoTecnicomecanica],
  ];
  return documentos.map(([documento, fecha]) => {
    const estado = estadoVencimiento(fecha, ahora);
    const alerta = alertaDe(documento, fecha, ahora);
    const texto = alerta?.texto ?? (estado === "SIN_FECHA" ? `${documento} sin fecha` : `${documento} vigente`);
    return { documento, estado, texto, tono: TONO_POR_ESTADO[estado] };
  });
}
