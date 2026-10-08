import type { Role } from "@/generated/prisma/client";

// Pantalla de inicio por rol: etiquetas y atajos. Todo puro (sin Prisma ni
// Next) para poder testearlo; los atajos se validan en test contra el mapa de
// rutas del proxy (lib/auth/route-roles.ts) para que ningún rol vea un link
// que luego lo rebote al inicio.

/** Primera palabra del nombre (para "Hola, Jorge"); vacío si no hay nombre. */
export function primerNombre(nombre: string | null | undefined): string {
  return nombre?.trim().split(/\s+/)[0] ?? "";
}

/**
 * Fecha de hoy en español de Colombia, en la zona horaria de Bogotá (UTC-5,
 * sin horario de verano): la gente la lee en hora local, no en UTC.
 */
export function fechaLegible(fecha: Date): string {
  const texto = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "full",
    timeZone: "America/Bogota",
  }).format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export type IconoAtajo = "inspeccion" | "aprobaciones" | "consulta" | "dashboard" | "usuarios" | "configuracion";

export type Atajo = {
  href: string;
  titulo: string;
  descripcion: string;
  icono: IconoAtajo;
};

const ATAJOS = {
  inspecciones: {
    href: "/inspecciones",
    titulo: "Inspecciones",
    descripcion: "Tu inspección preoperacional",
    icono: "inspeccion",
  },
  aprobaciones: {
    href: "/aprobaciones",
    titulo: "Aprobaciones",
    descripcion: "Revisar inspecciones pendientes",
    icono: "aprobaciones",
  },
  consulta: {
    href: "/consulta-inspecciones",
    titulo: "Consulta",
    descripcion: "Buscar todas las inspecciones",
    icono: "consulta",
  },
  dashboard: {
    href: "/dashboard",
    titulo: "Dashboard",
    descripcion: "Indicadores y reportes",
    icono: "dashboard",
  },
  usuarios: {
    href: "/admin/usuarios",
    titulo: "Usuarios",
    descripcion: "Recorredores y vehículos",
    icono: "usuarios",
  },
  administracion: {
    href: "/admin/usuarios",
    titulo: "Administración",
    descripcion: "Usuarios, vehículos y configuración",
    icono: "usuarios",
  },
  configuracion: {
    href: "/admin/configuracion",
    titulo: "Configuración",
    descripcion: "Parámetros del formato",
    icono: "configuracion",
  },
} satisfies Record<string, Atajo>;

const ATAJOS_POR_ROL: Record<Role, Atajo[]> = {
  TRABAJADOR: [ATAJOS.inspecciones],
  SUPERVISOR: [ATAJOS.aprobaciones, ATAJOS.consulta],
  SUPERVISOR_OLARIARI: [ATAJOS.aprobaciones, ATAJOS.consulta],
  DIRECTOR: [ATAJOS.dashboard, ATAJOS.consulta],
  SST: [ATAJOS.dashboard, ATAJOS.consulta, ATAJOS.administracion],
  ADMINISTRADOR: [ATAJOS.usuarios, ATAJOS.configuracion, ATAJOS.dashboard, ATAJOS.consulta],
};

export function atajosPorRol(role: Role): Atajo[] {
  return ATAJOS_POR_ROL[role];
}
