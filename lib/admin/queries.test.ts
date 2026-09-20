import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { getUsuarios } from "@/lib/admin/queries";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

// Corren contra Postgres real (test/setup.ts + test/helpers/db.ts): lo que se
// protege es cómo Prisma traduce el filtro `q` (relación 1:1 con Vehicle,
// `mode: "insensitive"`), no una regla de negocio mockeable.

beforeEach(async () => {
  await limpiarBaseDeTest();
});

afterAll(async () => {
  await limpiarBaseDeTest();
  await prisma.$disconnect();
});

// Placas que no pueden colisionar con el nombre/email/cédula por defecto de
// los usuarios de prueba (los emails llevan un UUID hex; "QRS" y "ZZZ" no son
// caracteres hex).
async function trabajadorConPlaca(placa: string, name: string) {
  const vehiculo = await crearVehiculo({ placa });
  return crearUsuario(Role.TRABAJADOR, { name, vehicleId: vehiculo.id });
}

describe("getUsuarios — búsqueda por placa del vehículo", () => {
  it("encuentra al trabajador cuyo vehículo tiene esa placa y trae el vehículo en el resultado", async () => {
    const buscado = await trabajadorConPlaca("QRS789", "Ana Buscada");
    await trabajadorConPlaca("QRT111", "Beto Otro");

    const resultado = await getUsuarios({ q: "QRS789" });

    expect(resultado.map((u) => u.id)).toEqual([buscado.id]);
    expect(resultado[0].vehicle).toMatchObject({ placa: "QRS789" });
  });

  it("ignora mayúsculas y minúsculas", async () => {
    const buscado = await trabajadorConPlaca("QRS789", "Ana Buscada");

    const enMinuscula = await getUsuarios({ q: "qrs789" });
    const mixto = await getUsuarios({ q: "qRs789" });

    expect(enMinuscula.map((u) => u.id)).toEqual([buscado.id]);
    expect(mixto.map((u) => u.id)).toEqual([buscado.id]);
  });

  it("acepta una placa parcial (contains)", async () => {
    const a = await trabajadorConPlaca("QRS789", "Ana Uno");
    const b = await trabajadorConPlaca("QRS790", "Beto Dos");
    await trabajadorConPlaca("ZZZ001", "Carla Fuera");

    const resultado = await getUsuarios({ q: "QRS7" });

    expect(resultado.map((u) => u.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("devuelve una lista vacía si ninguna placa coincide", async () => {
    await trabajadorConPlaca("QRS789", "Ana Buscada");

    const resultado = await getUsuarios({ q: "ZZZ999" });

    expect(resultado).toEqual([]);
  });

  it("los usuarios sin vehículo no coinciden por placa ni rompen la búsqueda, y en el listado completo llevan vehicle null", async () => {
    const sinVehiculo = await crearUsuario(Role.TRABAJADOR, { name: "Legacy Sin Vehiculo" });
    await crearUsuario(Role.SUPERVISOR, { name: "Supervisor Sin Vehiculo" });
    const conVehiculo = await trabajadorConPlaca("QRS789", "Ana Buscada");

    const porPlaca = await getUsuarios({ q: "QRS789" });
    const todos = await getUsuarios();

    expect(porPlaca.map((u) => u.id)).toEqual([conVehiculo.id]);
    expect(todos).toHaveLength(3);
    expect(todos.find((u) => u.id === sinVehiculo.id)?.vehicle).toBeNull();
  });

  it("sigue encontrando por nombre y se combina con los demás filtros", async () => {
    const activo = await trabajadorConPlaca("QRS789", "Ana Activa");
    const inactivo = await trabajadorConPlaca("QRS790", "Ana Inactiva");
    await prisma.user.update({ where: { id: inactivo.id }, data: { activo: false } });

    const porNombre = await getUsuarios({ q: "ana act" });
    const placaYActivo = await getUsuarios({ q: "QRS", activo: true });
    const placaYRol = await getUsuarios({ q: "QRS", role: Role.SUPERVISOR });

    expect(porNombre.map((u) => u.id)).toEqual([activo.id]);
    expect(placaYActivo.map((u) => u.id)).toEqual([activo.id]);
    expect(placaYRol).toEqual([]);
  });
});
