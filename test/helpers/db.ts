import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Role, TipoVehiculo, TipoRespuestaItem } from "@/generated/prisma/client";

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

export async function crearUsuario(
  role: Role,
  overrides: Partial<{
    email: string;
    name: string;
    cedula: string;
    tipoVehiculo: TipoVehiculo | null;
  }> = {},
) {
  return prisma.user.create({
    data: {
      email: overrides.email ?? `${role.toLowerCase()}-${randomUUID()}@test.local`,
      name: overrides.name ?? `Usuario ${role}`,
      role,
      passwordHash: "no-se-usa-en-tests",
      cedula: overrides.cedula,
      // Fase soporte-moto-carro: default MOTO (el sistema era moto-only),
      // overridable para tests de CARRO — ver Testing Strategy en el
      // design del cambio. `overrides.tipoVehiculo === null` permite
      // simular explícitamente un usuario legacy sin tipo asignado.
      tipoVehiculo: "tipoVehiculo" in overrides ? overrides.tipoVehiculo : TipoVehiculo.MOTO,
    },
  });
}

export async function crearVehiculo(
  overrides: Partial<{ placa: string; activo: boolean; tipoVehiculo: TipoVehiculo | null }> = {},
) {
  return prisma.vehicle.create({
    data: {
      placa: overrides.placa ?? `TEST-${randomUUID().slice(0, 8)}`,
      tipo: "Motocicleta",
      activo: overrides.activo ?? true,
      // Fase soporte-moto-carro: default MOTO, overridable a CARRO — ver
      // Testing Strategy en el design del cambio. Mantiene sin cambios a
      // todos los `crearVehiculo()` existentes (llaman sin args).
      tipoVehiculo: "tipoVehiculo" in overrides ? overrides.tipoVehiculo : TipoVehiculo.MOTO,
    },
  });
}

/** Crea una categoría con un único ítem de checklist — catálogo mínimo para tests.
 * `tipoVehiculo`/`tipoRespuesta` quedan en sus defaults (null = aplica a ambos
 * tipos, BINARIO) para que todos los tests existentes que llaman esta función
 * sin argumentos sigan compilando y pasando sin cambios (Testing Strategy del
 * design de soporte-moto-carro). */
export async function crearCatalogoMinimo(
  overrides: Partial<{
    nombreCategoria: string;
    tipoVehiculo: TipoVehiculo | null;
    tipoRespuesta: TipoRespuestaItem;
  }> = {},
) {
  const categoria = await prisma.checklistCategory.create({
    data: { nombre: overrides.nombreCategoria ?? `Categoria-${randomUUID()}`, orden: 1 },
  });
  const item = await prisma.checklistItem.create({
    data: {
      categoryId: categoria.id,
      nombre: "Item de prueba",
      orden: 1,
      tipoVehiculo: overrides.tipoVehiculo ?? null,
      tipoRespuesta: overrides.tipoRespuesta ?? TipoRespuestaItem.BINARIO,
    },
  });
  return { categoria, item };
}

/** Agrega un ítem adicional a una categoría existente — usado para armar
 * catálogos con varios ítems (compartidos + específicos de MOTO/CARRO) en
 * los tests de `getChecklistCatalog`. */
export async function crearChecklistItem(
  categoryId: string,
  overrides: Partial<{
    nombre: string;
    orden: number;
    tipoVehiculo: TipoVehiculo | null;
    tipoRespuesta: TipoRespuestaItem;
  }> = {},
) {
  return prisma.checklistItem.create({
    data: {
      categoryId,
      nombre: overrides.nombre ?? `Item-${randomUUID()}`,
      orden: overrides.orden ?? 1,
      tipoVehiculo: overrides.tipoVehiculo ?? null,
      tipoRespuesta: overrides.tipoRespuesta ?? TipoRespuestaItem.BINARIO,
    },
  });
}
