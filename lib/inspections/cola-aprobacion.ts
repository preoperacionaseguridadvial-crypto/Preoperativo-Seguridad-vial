import { InspectionStatus, Role, Sede, TipoFirma } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { etiquetaRol } from "@/lib/auth/etiquetas-rol";

// Flujo de aprobación en dos etapas (feature roles-olariari). Sin dependencias
// de servidor ni Next: las colas, el turno de cada aprobador y los textos de
// "a quién espera" salen de acá, para que la lista, el inicio, las server
// actions y las pantallas de lectura nunca discrepen.
//
// - Bogotá (y una inspección legacy sin sede): una sola etapa, el Director de
//   Operaciones (rol SUPERVISOR).
// - Olariari: primero el Supervisor Olariari; si aprueba, pasa a la cola del
//   Director sin cambiar el `status`; si rechaza, la inspección se cierra.

const ESTADOS_REVISABLES: InspectionStatus[] = [
  InspectionStatus.PENDIENTE_APROBACION,
  InspectionStatus.NO_APTA_PARA_OPERAR,
];

export type RolAprobador = typeof Role.SUPERVISOR | typeof Role.SUPERVISOR_OLARIARI;
export type EtapaAprobacion = "OLARIARI" | "DIRECTOR";

export function esRolAprobador(role: Role): role is RolAprobador {
  return role === Role.SUPERVISOR || role === Role.SUPERVISOR_OLARIARI;
}

/** Campos de la inspección que deciden en qué etapa está. */
export type DatosEtapa = {
  status: InspectionStatus;
  sede: Sede | null;
  reviewedAt: Date | null;
  revisadaSupervisorOlariariAt: Date | null;
  supervisorId?: string | null;
  supervisorOlariariId?: string | null;
};

/**
 * `where` de Prisma con la cola de pendientes de cada aprobador. Es la misma
 * regla que `etapaParaRol`, expresada como consulta.
 */
export function whereColaPendientes(role: RolAprobador): Prisma.InspectionWhereInput {
  const base = { reviewedAt: null, status: { in: ESTADOS_REVISABLES } } satisfies Prisma.InspectionWhereInput;
  if (role === Role.SUPERVISOR_OLARIARI) {
    return { ...base, sede: Sede.OLARIARI, revisadaSupervisorOlariariAt: null };
  }
  return {
    ...base,
    OR: [
      { sede: Sede.BOGOTA },
      { sede: null },
      { sede: Sede.OLARIARI, revisadaSupervisorOlariariAt: { not: null } },
    ],
  };
}

/** Etapa que está esperando la inspección, o `null` si no es revisable (ya decidida, en proceso...). */
export function etapaPendiente(inspection: DatosEtapa): EtapaAprobacion | null {
  if (!ESTADOS_REVISABLES.includes(inspection.status) || inspection.reviewedAt !== null) {
    return null;
  }
  if (inspection.sede === Sede.OLARIARI && inspection.revisadaSupervisorOlariariAt === null) {
    return "OLARIARI";
  }
  return "DIRECTOR";
}

/** Etapa en la que `role` puede decidir esta inspección; `null` si no le toca. */
export function etapaParaRol(role: Role, inspection: DatosEtapa): EtapaAprobacion | null {
  const etapa = etapaPendiente(inspection);
  if (etapa === "OLARIARI" && role === Role.SUPERVISOR_OLARIARI) return "OLARIARI";
  if (etapa === "DIRECTOR" && role === Role.SUPERVISOR) return "DIRECTOR";
  return null;
}

/** Rol que debe aprobar ahora, o `null` si no espera aprobación. */
export function esperandoA(inspection: DatosEtapa): RolAprobador | null {
  const etapa = etapaPendiente(inspection);
  if (etapa === null) return null;
  return etapa === "OLARIARI" ? Role.SUPERVISOR_OLARIARI : Role.SUPERVISOR;
}

/** "Esperando aprobación del Supervisor Olariari" / "...del Director de Operaciones". */
export function textoEsperandoAprobacion(inspection: DatosEtapa): string | null {
  const rol = esperandoA(inspection);
  return rol === null ? null : `Esperando aprobación del ${etiquetaRol(rol)}`;
}

/**
 * Estado de la primera etapa de una inspección de Olariari, para la consulta.
 * `null` para Bogotá/legacy (flujo de una sola etapa) o si no hay nada que decir.
 */
export function estadoEtapaOlariari(inspection: DatosEtapa): string | null {
  if (inspection.sede !== Sede.OLARIARI) return null;
  const supOlariari = etiquetaRol(Role.SUPERVISOR_OLARIARI);
  const director = etiquetaRol(Role.SUPERVISOR);

  if (inspection.revisadaSupervisorOlariariAt === null) {
    return ESTADOS_REVISABLES.includes(inspection.status) ? `Pendiente ${supOlariari}` : null;
  }
  if (inspection.reviewedAt === null) {
    return `Aprobada por ${supOlariari} · pendiente ${director}`;
  }
  // Decidida. Si el Director no intervino, la rechazó el Supervisor Olariari.
  if (inspection.status === InspectionStatus.RECHAZADA && !inspection.supervisorId) {
    return `Rechazada por ${supOlariari}`;
  }
  if (inspection.status === InspectionStatus.APROBADA) {
    return `Aprobada por ${supOlariari} y ${director}`;
  }
  if (inspection.status === InspectionStatus.RECHAZADA) {
    return `Aprobada por ${supOlariari} · rechazada por ${director}`;
  }
  return null;
}

/**
 * Firma que le falta a `userId` en esta inspección: cada aprobador firma SU
 * decisión (el Supervisor Olariari la de la primera etapa; el Director la
 * definitiva) y solo si ya decidió y todavía no firmó. `null` si no le falta
 * ninguna. `firmasExistentes` son los tipos ya registrados.
 */
export function tipoFirmaPendiente(
  role: Role,
  userId: string,
  inspection: Pick<
    DatosEtapa,
    "reviewedAt" | "revisadaSupervisorOlariariAt" | "supervisorId" | "supervisorOlariariId"
  >,
  firmasExistentes: readonly TipoFirma[],
): TipoFirma | null {
  if (
    role === Role.SUPERVISOR_OLARIARI &&
    inspection.revisadaSupervisorOlariariAt !== null &&
    inspection.supervisorOlariariId === userId &&
    !firmasExistentes.includes(TipoFirma.SUPERVISOR_OLARIARI)
  ) {
    return TipoFirma.SUPERVISOR_OLARIARI;
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
