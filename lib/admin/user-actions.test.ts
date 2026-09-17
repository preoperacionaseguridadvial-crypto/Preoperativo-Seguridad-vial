import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mismo patrón que lib/inspections/actions.test.ts: se mockea la sesión de
// NextAuth (lo único que `requireRole` necesita), el resto corre contra
// Postgres real (test/setup.ts + test/helpers/db.ts).
const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: () => mockAuth(),
}));

import { prisma } from "@/lib/prisma";
import { Role, TipoVehiculo } from "@/generated/prisma/client";
import { actualizarUsuario, crearUsuario } from "@/lib/admin/user-actions";
import { crearUsuario as crearUsuarioDeTest, limpiarBaseDeTest } from "@/test/helpers/db";

function loginComoAdmin() {
  return crearUsuarioDeTest(Role.ADMINISTRADOR).then((admin) => {
    mockAuth.mockResolvedValue({ user: { id: admin.id, role: admin.role } });
    return admin;
  });
}

beforeEach(async () => {
  await limpiarBaseDeTest();
  mockAuth.mockReset();
});

afterAll(async () => {
  await limpiarBaseDeTest();
  await prisma.$disconnect();
});

describe("crearUsuario — soporte-moto-carro (Slice 1)", () => {
  it("rechaza crear un TRABAJADOR sin cédula", async () => {
    await loginComoAdmin();

    await expect(
      crearUsuario({
        name: "Trabajador Sin Cedula",
        email: `trabajador-${Date.now()}@test.local`,
        password: "password123",
        passwordConfirmacion: "password123",
        role: Role.TRABAJADOR,
        tipoVehiculo: TipoVehiculo.MOTO,
      }),
    ).rejects.toThrow(/cédula/i);
  });

  it("rechaza crear un TRABAJADOR sin tipoVehiculo", async () => {
    await loginComoAdmin();

    await expect(
      crearUsuario({
        name: "Trabajador Sin Tipo",
        email: `trabajador-${Date.now()}@test.local`,
        password: "password123",
        passwordConfirmacion: "password123",
        role: Role.TRABAJADOR,
        cedula: "1234567890",
      }),
    ).rejects.toThrow(/tipo de vehículo/i);
  });

  it("crea un TRABAJADOR con cédula, tipoVehiculo y puestoAsignado", async () => {
    await loginComoAdmin();

    const usuario = await crearUsuario({
      name: "Trabajador Completo",
      email: `trabajador-${Date.now()}@test.local`,
      password: "password123",
      passwordConfirmacion: "password123",
      role: Role.TRABAJADOR,
      cedula: "1234567890",
      tipoVehiculo: TipoVehiculo.CARRO,
      puestoAsignado: "Conductor de reparto",
    });

    expect(usuario.tipoVehiculo).toBe(TipoVehiculo.CARRO);
    expect(usuario.puestoAsignado).toBe("Conductor de reparto");
    expect(usuario.cedula).toBe("1234567890");
  });

  it("no exige cédula ni tipoVehiculo para roles distintos de TRABAJADOR", async () => {
    await loginComoAdmin();

    const usuario = await crearUsuario({
      name: "Supervisor Sin Extras",
      email: `supervisor-${Date.now()}@test.local`,
      password: "password123",
      passwordConfirmacion: "password123",
      role: Role.SUPERVISOR,
    });

    expect(usuario.role).toBe(Role.SUPERVISOR);
    expect(usuario.tipoVehiculo).toBeNull();
  });
});

describe("actualizarUsuario — soporte-moto-carro (Slice 1)", () => {
  it("rechaza editar a TRABAJADOR sin tipoVehiculo", async () => {
    await loginComoAdmin();
    const legacy = await crearUsuarioDeTest(Role.TRABAJADOR, { name: "Legacy" });

    await expect(
      actualizarUsuario(legacy.id, {
        name: legacy.name,
        email: legacy.email,
        role: Role.TRABAJADOR,
        activo: true,
        cedula: "9999",
      }),
    ).rejects.toThrow(/tipo de vehículo/i);
  });

  it("permite editar un TRABAJADOR completando tipoVehiculo y puestoAsignado", async () => {
    await loginComoAdmin();
    const legacy = await crearUsuarioDeTest(Role.TRABAJADOR, { name: "Legacy" });

    const actualizado = await actualizarUsuario(legacy.id, {
      name: legacy.name,
      email: legacy.email,
      role: Role.TRABAJADOR,
      activo: true,
      cedula: "9999",
      tipoVehiculo: TipoVehiculo.MOTO,
      puestoAsignado: "Mensajero",
    });

    expect(actualizado.tipoVehiculo).toBe(TipoVehiculo.MOTO);
    expect(actualizado.puestoAsignado).toBe("Mensajero");
  });
});
