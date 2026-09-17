import "server-only";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";

// Queries de lectura del panel de administración — sin mutaciones acá, ver
// lib/admin/user-actions.ts y lib/admin/vehicle-actions.ts.

export type FiltrosUsuarios = {
  q?: string;
  role?: Role;
  activo?: boolean;
};

/**
 * `q` busca por nombre, email o cédula (contains, insensible a mayúsculas)
 * — mismo criterio de búsqueda parcial ya usado en los filtros de
 * consulta-inspecciones/dashboard.
 */
export function getUsuarios(filtros?: FiltrosUsuarios) {
  const where: NonNullable<Parameters<typeof prisma.user.findMany>[0]>["where"] = {};
  if (filtros?.q) {
    where.OR = [
      { name: { contains: filtros.q, mode: "insensitive" } },
      { email: { contains: filtros.q, mode: "insensitive" } },
      { cedula: { contains: filtros.q, mode: "insensitive" } },
    ];
  }
  if (filtros?.role) {
    where.role = filtros.role;
  }
  if (filtros?.activo !== undefined) {
    where.activo = filtros.activo;
  }
  return prisma.user.findMany({ where, orderBy: [{ role: "asc" }, { name: "asc" }] });
}

export function getUsuarioPorId(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export function getVehiculos() {
  return prisma.vehicle.findMany({ orderBy: { placa: "asc" } });
}

export function getVehiculoPorId(id: string) {
  return prisma.vehicle.findUnique({ where: { id } });
}
