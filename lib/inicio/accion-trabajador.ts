import { InspectionStatus, Role, type Sede } from "@/generated/prisma/enums";
import { etiquetaRol } from "@/lib/auth/etiquetas-rol";
import { esperandoA, textoEsperandoAprobacion } from "@/lib/inspections/cola-aprobacion";
import { esReutilizable } from "@/lib/inspections/reuso-inspeccion";
import { tiempoTranscurrido } from "@/lib/inspections/tiempo-transcurrido";

// Acción principal de la pantalla de inicio del TRABAJADOR, derivada de su
// última inspección no cancelada. Tiene que coincidir con lo que realmente
// hace el flujo (app/(worker)/inspecciones, `iniciarInspeccion`): una
// EN_PROCESO se reutiliza solo dentro de VENTANA_REUSO_INSPECCION_HORAS; más
// vieja se descarta y se abre una nueva, así que ahí no se promete "continuar".
//
// Regla de negocio (confirmada por el usuario, 2026-10-07): una vez ENVIADA,
// el trabajador puede iniciar una inspección nueva, sin importar si el
// Supervisor ya la aprobó, la rechazó o todavía no la revisó — la ventana de
// reuso aplica SOLO a una EN_PROCESO. Por eso todo estado ya enviado ofrece
// "Hacer una nueva inspección" (iniciarInspeccion nunca bloqueó esto).

export type InspeccionResumen = {
  id: string;
  status: InspectionStatus;
  startedAt: Date;
  completedAt: Date | null;
  reviewedAt: Date | null;
  observacionesSupervisor: string | null;
  // Flujo de dos etapas (roles-olariari): de la sede y de la primera etapa
  // sale a quién espera la inspección. Opcionales: sin ellos se asume una sola
  // etapa (Director de Operaciones).
  sede?: Sede | null;
  revisadaSupervisorOlariariAt?: Date | null;
};

/** Estado de aprobación de una inspección ya enviada y todavía sin decidir. */
function datosEspera(ultima: InspeccionResumen) {
  return {
    status: InspectionStatus.PENDIENTE_APROBACION,
    sede: ultima.sede ?? null,
    reviewedAt: null,
    revisadaSupervisorOlariariAt: ultima.revisadaSupervisorOlariariAt ?? null,
  };
}

export type TonoEstado = "ok" | "warn" | "crit" | "info" | "neutral";

export type AccionTrabajador = {
  estado: "INICIAR" | "CONTINUAR" | "ESPERANDO" | "APROBADA" | "RECHAZADA" | "NO_APTA";
  titulo: string;
  detalle: string | null;
  boton: { texto: string; href: string } | null;
  tono: TonoEstado;
};

const BOTON_INICIAR = { texto: "Iniciar inspección", href: "/inspecciones" };
const BOTON_NUEVA = { texto: "Hacer una nueva inspección", href: "/inspecciones" };

const ACCION_INICIAR: AccionTrabajador = {
  estado: "INICIAR",
  titulo: "Inspección preoperacional",
  detalle: "Todavía no has hecho la de hoy.",
  boton: BOTON_INICIAR,
  tono: "info",
};

export function accionPrincipalTrabajador(
  ultima: InspeccionResumen | null,
  ahora: Date = new Date(),
): AccionTrabajador {
  if (!ultima || !esReutilizable(ultima.startedAt, ahora)) {
    return ACCION_INICIAR;
  }

  switch (ultima.status) {
    case "EN_PROCESO":
      return {
        estado: "CONTINUAR",
        titulo: "Inspección en proceso",
        detalle: `Iniciada ${tiempoTranscurrido(ultima.startedAt, ahora)}`,
        boton: { texto: "Continuar inspección", href: `/inspecciones/${ultima.id}` },
        tono: "info",
      };
    case "ENVIADA":
    case "PENDIENTE_APROBACION": {
      const espera = tiempoTranscurrido(ultima.completedAt, ahora);
      const enviada = espera ? `Enviada ${espera}` : null;
      const primeraEtapaLista = Boolean(ultima.revisadaSupervisorOlariariAt);
      return {
        estado: "ESPERANDO",
        titulo: textoEsperandoAprobacion(datosEspera(ultima)) ?? "Esperando aprobación",
        detalle: primeraEtapaLista
          ? [`Ya la aprobó el ${etiquetaRol(Role.SUPERVISOR_OLARIARI)}`, enviada].filter(Boolean).join(" · ")
          : enviada,
        boton: BOTON_NUEVA,
        tono: "warn",
      };
    }
    case "APROBADA":
      return {
        estado: "APROBADA",
        titulo: "Aprobada",
        detalle: tiempoTranscurrido(ultima.reviewedAt ?? ultima.completedAt ?? ultima.startedAt, ahora),
        boton: BOTON_NUEVA,
        tono: "ok",
      };
    case "RECHAZADA":
      return {
        estado: "RECHAZADA",
        titulo: "Rechazada",
        detalle: ultima.observacionesSupervisor?.trim() || "No se dejaron observaciones.",
        boton: BOTON_NUEVA,
        tono: "crit",
      };
    case "NO_APTA_PARA_OPERAR":
      return {
        estado: "NO_APTA",
        titulo: "No apta para operar",
        detalle: `Tu vehículo no debe operar hasta que lo revise el ${etiquetaRol(esperandoA(datosEspera(ultima)) ?? Role.SUPERVISOR)}.`,
        boton: BOTON_NUEVA,
        tono: "crit",
      };
    default:
      // CANCELADA no debería llegar (la query la excluye): se trata como "sin inspección".
      return ACCION_INICIAR;
  }
}

export function tonoEstadoInspeccion(status: InspectionStatus): TonoEstado {
  switch (status) {
    case "APROBADA":
      return "ok";
    case "RECHAZADA":
    case "NO_APTA_PARA_OPERAR":
      return "crit";
    case "ENVIADA":
    case "PENDIENTE_APROBACION":
      return "warn";
    case "EN_PROCESO":
      return "info";
    default:
      return "neutral";
  }
}

/** Clases de chip/tarjeta por tono (tokens status-* de globals.css). */
export const CLASES_TONO: Record<TonoEstado, string> = {
  ok: "bg-status-ok-soft text-status-ok-ink",
  warn: "bg-status-warn-soft text-status-warn-ink",
  crit: "bg-status-crit-soft text-status-crit-ink",
  info: "bg-status-info-soft text-status-info-ink",
  neutral: "bg-status-neutral-soft text-status-neutral-ink",
};
