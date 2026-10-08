// `enums` y no `client`: lo importan Client Components y `client` arrastraría
// el cliente de Prisma (pg) al bundle del navegador.
import { Role, Sede } from "@/generated/prisma/enums";

// Única fuente de verdad de los nombres que se muestran para roles y sedes.
// Los códigos internos del enum (SST, SUPERVISOR, TRABAJADOR...) NO cambian:
// son valores de base de datos y de permisos; acá solo se decide cómo se
// llaman en pantalla (cargos reales de ESS). Puro y sin dependencias de
// servidor para poder usarlo desde componentes de cliente y tests.

/** Nombre visible de la sede Oleariari. Un solo lugar por si cambia la grafía. */
export const NOMBRE_SEDE_OLEARIARI = "Oleariari";

const ETIQUETA_ROL: Record<Role, string> = {
  TRABAJADOR: "Recorredor",
  SUPERVISOR: "Director de Operaciones",
  DIRECTOR: "Director",
  SST: "Administrador SST",
  ADMINISTRADOR: "Administrador",
  SUPERVISOR_OLEARIARI: `Supervisor ${NOMBRE_SEDE_OLEARIARI}`,
};

const ETIQUETA_SEDE: Record<Sede, string> = {
  BOGOTA: "Bogotá",
  OLEARIARI: NOMBRE_SEDE_OLEARIARI,
};

/** Roles en el orden en que se ofrecen en los formularios de usuarios. */
export const ROLES_ASIGNABLES: readonly Role[] = [
  Role.TRABAJADOR,
  Role.SUPERVISOR_OLEARIARI,
  Role.SUPERVISOR,
  Role.DIRECTOR,
  Role.SST,
  Role.ADMINISTRADOR,
];

/** Sedes con su etiqueta, para los <select>. */
export const SEDES: readonly { value: Sede; label: string }[] = [
  { value: Sede.BOGOTA, label: ETIQUETA_SEDE.BOGOTA },
  { value: Sede.OLEARIARI, label: ETIQUETA_SEDE.OLEARIARI },
];

export function etiquetaRol(role: Role): string {
  return ETIQUETA_ROL[role];
}

export function etiquetaSede(sede: Sede): string {
  return ETIQUETA_SEDE[sede];
}

/**
 * Rol tal como lo ve una persona: el Recorredor lleva su sede ("Recorredor
 * Bogotá"); sin sede conocida (usuario legacy) es solo "Recorredor". Los demás
 * roles ignoran la sede.
 */
export function etiquetaUsuario(role: Role, sede?: Sede | null): string {
  if (role === Role.TRABAJADOR && sede) {
    return `${ETIQUETA_ROL[role]} ${ETIQUETA_SEDE[sede]}`;
  }
  return ETIQUETA_ROL[role];
}
