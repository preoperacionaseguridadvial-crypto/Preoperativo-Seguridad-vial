import "server-only";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";

// Queries de lectura del panel de administración — sin mutaciones acá, ver
// lib/admin/user-actions.ts (usuarios y el vehículo de cada trabajador).

export type FiltrosUsuarios = {
  q?: string;
  role?: Role;
  activo?: boolean;
};

/**
 * `q` busca por nombre, email, cédula o placa del vehículo (contains,
 * insensible a mayúsculas) — mismo criterio de búsqueda parcial ya usado en
 * los filtros de consulta-inspecciones/dashboard. Incluye el vehículo de cada
 * trabajador (1:1) para mostrar su placa en la lista.
 */
export function getUsuarios(filtros?: FiltrosUsuarios) {
  const where: NonNullable<Parameters<typeof prisma.user.findMany>[0]>["where"] = {};
  if (filtros?.q) {
    where.OR = [
      { name: { contains: filtros.q, mode: "insensitive" } },
      { email: { contains: filtros.q, mode: "insensitive" } },
      { cedula: { contains: filtros.q, mode: "insensitive" } },
      { vehicle: { placa: { contains: filtros.q, mode: "insensitive" } } },
    ];
  }
  if (filtros?.role) {
    where.role = filtros.role;
  }
  if (filtros?.activo !== undefined) {
    where.activo = filtros.activo;
  }
  return prisma.user.findMany({
    where,
    include: { vehicle: { select: { id: true, placa: true } } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}

/** Usuario con su vehículo (1:1) — base de la edición y de la hoja de vida. */
export function getUsuarioPorId(id: string) {
  return prisma.user.findUnique({ where: { id }, include: { vehicle: true } });
}
