import { Role, Sede } from "@/generated/prisma/enums";
import { etiquetaRol } from "@/lib/auth/etiquetas-rol";
import type { PayloadPush } from "@/lib/notificaciones/push";

// Quién recibe cada aviso de una inspección y qué dice. Puro y sin servidor:
// los destinatarios reales se buscan en notificar-inspeccion.ts a partir de este
// plan. La regla de oro es la de la bandeja: solo se avisa a un aprobador cuando
// la inspección YA aparece en su cola (ver whereColaPendientes en
// lib/inspections/cola-aprobacion.ts).

export type EventoInspeccion =
  /** El recorredor envió la inspección. */
  | "ENVIADA"
  /** El Supervisor Oleariari aprobó la primera etapa (aún falta su firma). */
  | "REVISADA_SUPERVISOR_OLEARIARI"
  /** El Supervisor Oleariari firmó: la inspección entra a la cola del Director. */
  | "PENDIENTE_DIRECTOR"
  | "APROBADA"
  | "RECHAZADA";

export type Audiencia = "APROBADOR" | "TRABAJADOR" | "SST";

export type PlanAudiencia = { audiencia: Audiencia; roles: Role[] };

export type DatosMensaje = {
  inspectionId: string;
  placa: string;
  /** Nombre del recorredor. */
  trabajador: string;
  /** Se envió marcada como NO apta para operar. */
  noApta?: boolean;
  /** Cargo de quien decidió (p. ej. "Director de Operaciones"). */
  decididoPor?: string;
  observacion?: string | null;
};

const MAX_OBSERVACION = 120;

const SST: PlanAudiencia = { audiencia: "SST", roles: [Role.SST] };

/** Audiencias y roles de cada evento. `TRABAJADOR` no lleva roles: es el dueño de la inspección. */
export function planDeEvento(evento: EventoInspeccion, sede: Sede | null): PlanAudiencia[] {
  switch (evento) {
    case "ENVIADA":
      return [
        {
          audiencia: "APROBADOR",
          // Bogotá y legacy (sin sede): una sola etapa, el Director. Oleariari: primero su supervisor.
          roles: [sede === Sede.OLEARIARI ? Role.SUPERVISOR_OLEARIARI : Role.SUPERVISOR],
        },
        SST,
      ];
    case "REVISADA_SUPERVISOR_OLEARIARI":
      return [SST];
    case "PENDIENTE_DIRECTOR":
      return [{ audiencia: "APROBADOR", roles: [Role.SUPERVISOR] }];
    case "APROBADA":
    case "RECHAZADA":
      return [{ audiencia: "TRABAJADOR", roles: [] }, SST];
  }
}

function urlPara(audiencia: Audiencia, id: string): string {
  switch (audiencia) {
    case "APROBADOR":
      return `/aprobaciones/${id}`;
    case "TRABAJADOR":
      return `/inspecciones/${id}/enviada`;
    case "SST":
      return `/consulta-inspecciones/${id}`;
  }
}

function recortar(texto: string): string {
  const limpio = texto.trim();
  return limpio.length > MAX_OBSERVACION ? `${limpio.slice(0, MAX_OBSERVACION).trimEnd()}…` : limpio;
}

export function construirMensaje(evento: EventoInspeccion, audiencia: Audiencia, d: DatosMensaje): PayloadPush {
  const base = { url: urlPara(audiencia, d.inspectionId), tag: `inspeccion-${d.inspectionId}` };
  const quien = `${d.placa} · ${d.trabajador}`;
  const por = d.decididoPor ? ` por ${d.decididoPor}` : "";
  const motivo = d.observacion?.trim() ? ` Motivo: ${recortar(d.observacion)}` : "";

  switch (evento) {
    case "ENVIADA":
      return {
        ...base,
        titulo: audiencia === "APROBADOR" ? "Nueva inspección por revisar" : "Inspección enviada",
        cuerpo: `${quien}${d.noApta ? " · NO apto para operar" : ""}`,
      };
    case "REVISADA_SUPERVISOR_OLEARIARI":
      return {
        ...base,
        titulo: `Revisada por ${etiquetaRol(Role.SUPERVISOR_OLEARIARI)}`,
        cuerpo: `${quien}: aprobada en la primera etapa.`,
      };
    case "PENDIENTE_DIRECTOR":
      return {
        ...base,
        titulo: "Inspección lista para su decisión",
        cuerpo: `${quien}: ya fue revisada por el ${etiquetaRol(Role.SUPERVISOR_OLEARIARI)}.`,
      };
    case "APROBADA":
      return audiencia === "TRABAJADOR"
        ? { ...base, titulo: "Su inspección fue aprobada", cuerpo: `${d.placa}: aprobada${por}.` }
        : { ...base, titulo: "Inspección aprobada", cuerpo: `${quien}: aprobada${por}.` };
    case "RECHAZADA":
      return audiencia === "TRABAJADOR"
        ? { ...base, titulo: "Su inspección fue rechazada", cuerpo: `${d.placa}: rechazada${por}.${motivo}` }
        : { ...base, titulo: "Inspección rechazada", cuerpo: `${quien}: rechazada${por}.${motivo}` };
  }
}
