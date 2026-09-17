import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";

/**
 * Limpia todas las tablas relevantes entre tests, respetando FKs (hijos
 * antes que padres). Se usa `beforeEach` en cada archivo de test de
 * integración para que cada test arranque desde una base vacía y no dependa
 * del orden de ejecución.
 */
export async function limpiarBaseDeTest() {
  await prisma.photo.deleteMany({});
  await prisma.novedad.deleteMany({});
  await prisma.inspectionItemResponse.deleteMany({});
  await prisma.firma.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.inspection.deleteMany({});
  await prisma.checklistItem.deleteMany({});
  await prisma.checklistCategory.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.user.deleteMany({});
}

export async function crearUsuario(role: Role, overrides: Partial<{ email: string; name: string }> = {}) {
  return prisma.user.create({
    data: {
      email: overrides.email ?? `${role.toLowerCase()}-${randomUUID()}@test.local`,
      name: overrides.name ?? `Usuario ${role}`,
      role,
      passwordHash: "no-se-usa-en-tests",
    },
  });
}

export async function crearVehiculo(overrides: Partial<{ placa: string; activo: boolean }> = {}) {
  return prisma.vehicle.create({
    data: {
      placa: overrides.placa ?? `TEST-${randomUUID().slice(0, 8)}`,
      tipo: "Motocicleta",
      activo: overrides.activo ?? true,
    },
  });
}

/** Crea una categoría con un único ítem de checklist — catálogo mínimo para tests. */
export async function crearCatalogoMinimo() {
  const categoria = await prisma.checklistCategory.create({
    data: { nombre: `Categoria-${randomUUID()}`, orden: 1 },
  });
  const item = await prisma.checklistItem.create({
    data: { categoryId: categoria.id, nombre: "Item de prueba", orden: 1 },
  });
  return { categoria, item };
}
