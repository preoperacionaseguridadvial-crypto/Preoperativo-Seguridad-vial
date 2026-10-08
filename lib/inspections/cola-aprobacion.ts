import { InspectionStatus, Role, Sede, TipoFirma } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { etiquetaRol } from "@/lib/auth/etiquetas-rol";

// Flujo de aprobación en dos etapas (feature roles-oleariari). Sin dependencias
// de servidor ni Next: las colas, el turno de cada aprobador y los textos de
// "a quién espera" salen de acá, para que la lista, el inicio, las server
// actions y las pantallas de lectura nunca discrepen.
//
// - Bogotá (y una inspección legacy sin sede): una sola etapa, el Director de
//   Operaciones (rol SUPERVISOR).
// - Oleariari: primero el Supervisor Oleariari; si aprueba, pasa a la cola del
//   Director sin cambiar el `status`; si rechaza, la inspección se cierra.

const ESTADOS_REVISABLES: InspectionStatus[] = [
  InspectionStatus.PENDIENTE_APROBACION,
  InspectionStatus.NO_APTA_PARA_OPERAR,
];

export type RolAprobador = typeof Role.SUPERVISOR | typeof Role.SUPERVISOR_OLEARIARI;
export type EtapaAprobacion = "OLEARIARI" | "DIRECTOR";

export function esRolAprobador(role: Role): role is RolAprobador {
  return role === Role.SUPERVISOR || role === Role.SUPERVISOR_OLEARIARI;
}

/** Campos de la inspección que deciden en qué etapa está. */
export type DatosEtapa = {
  status: InspectionStatus;
  sede: Sede | null;
  reviewedAt: Date | null;
  revisadaSupervisorOleariariAt: Date | null;
  supervisorId?: string | null;
  supervisorOleariariId?: string | null;
};

/**
 * `where` de Prisma con la cola de pendientes de cada aprobador. Es la misma
 * regla que `etapaParaRol`, expresada como consulta.
 */
export function whereColaPendientes(role: RolAprobador): Prisma.InspectionWhereInput {
  const base = { reviewedAt: null, status: { in: ESTADOS_REVISABLES } } satisfies Prisma.InspectionWhereInput;
  if (role === Role.SUPERVISOR_OLEARIARI) {
    return { ...base, sede: Sede.OLEARIARI, revisadaSupervisorOleariariAt: null };
  }
  return {
    ...base,
    OR: [
      { sede: Sede.BOGOTA },
      { sede: null },
      { sede: Sede.OLEARIARI, revisadaSupervisorOleariariAt: { not: null } },
    ],
  };
}

/** Etapa que está esperando la inspección, o `null` si no es revisable (ya decidida, en proceso...). */
export function etapaPendiente(inspection: DatosEtapa): EtapaAprobacion | null {
  if (!ESTADOS_REVISABLES.includes(inspection.status) || inspection.reviewedAt !== null) {
    return null;
  }
  if (inspection.sede === Sede.OLEARIARI && inspection.revisadaSupervisorOleariariAt === null) {
    return "OLEARIARI";
  }
  return "DIRECTOR";
}

/** Etapa en la que `role` puede decidir esta inspección; `null` si no le toca. */
export function etapaParaRol(role: Role, inspection: DatosEtapa): EtapaAprobacion | null {
  const etapa = etapaPendiente(inspection);
  if (etapa === "OLEARIARI" && role === Role.SUPERVISOR_OLEARIARI) return "OLEARIARI";
  if (etapa === "DIRECTOR" && role === Role.SUPERVISOR) return "DIRECTOR";
  return null;
}

/** Rol que debe aprobar ahora, o `null` si no espera aprobación. */
export function esperandoA(inspection: DatosEtapa): RolAprobador | null {
  const etapa = etapaPendiente(inspection);
  if (etapa === null) return null;
  return etapa === "OLEARIARI" ? Role.SUPERVISOR_OLEARIARI : Role.SUPERVISOR;
}

/** "Esperando aprobación del Supervisor Oleariari" / "...del Director de Operaciones". */
export function textoEsperandoAprobacion(inspection: DatosEtapa): string | null {
  const rol = esperandoA(inspection);
  return rol === null ? null : `Esperando aprobación del ${etiquetaRol(rol)}`;
}

/**
 * Estado de la primera etapa de una inspección de Oleariari, para la consulta.
 * `null` para Bogotá/legacy (flujo de una sola etapa) o si no hay nada que decir.
 */
export function estadoEtapaOleariari(inspection: DatosEtapa): string | null {
  if (inspection.sede !== Sede.OLEARIARI) return null;
  const supOleariari = etiquetaRol(Role.SUPERVISOR_OLEARIARI);
  const director = etiquetaRol(Role.SUPERVISOR);

  if (inspection.revisadaSupervisorOleariariAt === null) {
    return ESTADOS_REVISABLES.includes(inspection.status) ? `Pendiente ${supOleariari}` : null;
  }
  if (inspection.reviewedAt === null) {
    return `Aprobada por ${supOleariari} · pendiente ${director}`;
  }
  // Decidida. Si el Director no intervino, la rechazó el Supervisor Oleariari.
  if (inspection.status === InspectionStatus.RECHAZADA && !inspection.supervisorId) {
    return `Rechazada por ${supOleariari}`;
  }
  if (inspection.status === InspectionStatus.APROBADA) {
    return `Aprobada por ${supOleariari} y ${director}`;
  }
  if (inspection.status === InspectionStatus.RECHAZADA) {
    return `Aprobada por ${supOleariari} · rechazada por ${director}`;
  }
  return null;
}

/**
 * Firma que le falta a `userId` en esta inspección: cada aprobador firma SU
 * decisión (el Supervisor Oleariari la de la primera etapa; el Director la
 * definitiva) y solo si ya decidió y todavía no firmó. `null` si no le falta
 * ninguna. `firmasExistentes` son los tipos ya registrados.
 */
export function tipoFirmaPendiente(
  role: Role,
  userId: string,
  inspection: Pick<
    DatosEtapa,
    "reviewedAt" | "revisadaSupervisorOleariariAt" | "supervisorId" | "supervisorOleariariId"
  >,
  firmasExistentes: readonly TipoFirma[],
): TipoFirma | null {
  if (
    role === Role.SUPERVISOR_OLEARIARI &&
    inspection.revisadaSupervisorOleariariAt !== null &&
    inspection.supervisorOleariariId === userId &&
    !firmasExistentes.includes(TipoFirma.SUPERVISOR_OLEARIARI)
  ) {
    return TipoFirma.SUPERVISOR_OLEARIARI;
  }
  if (
    role === Role.SUPERVISOR &&
    inspection.reviewedAt !== null &&
    inspection.supervisorId === userId &&
    !firmasExistentes.includes(TipoFirma.SUPERVISOR)
  ) {
    return TipoFirma.SUPERVISOR;
  }
  return null;
}
