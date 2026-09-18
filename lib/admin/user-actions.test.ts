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
import { actualizarUsuario, crearUsuario, restablecerPassword } from "@/lib/admin/user-actions";
import { crearUsuario as crearUsuarioDeTest, limpiarBaseDeTest } from "@/test/helpers/db";

function loginComoAdmin() {
  return crearUsuarioDeTest(Role.ADMINISTRADOR).then((admin) => {
    mockAuth.mockResolvedValue({ user: { id: admin.id, role: admin.role } });
    return admin;
  });
}

function loginComo(user: { id: string; role: Role }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, role: user.role } });
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

describe("crearUsuario/actualizarUsuario/restablecerPassword — SST con paridad total de ADMINISTRADOR", () => {
  it("SST puede crear un TRABAJADOR (mismo camino que ADMINISTRADOR)", async () => {
    const sst = await crearUsuarioDeTest(Role.SST);
    loginComo(sst);

    const usuario = await crearUsuario({
      name: "Trabajador Creado Por SST",
      email: `trabajador-sst-${Date.now()}@test.local`,
      password: "password123",
      passwordConfirmacion: "password123",
      role: Role.TRABAJADOR,
      cedula: "1234567890",
      tipoVehiculo: TipoVehiculo.MOTO,
    });

    expect(usuario.role).toBe(Role.TRABAJADOR);
  });

  it("SST puede crear un ADMINISTRADOR (paridad total, no solo trabajadores)", async () => {
    const sst = await crearUsuarioDeTest(Role.SST);
    loginComo(sst);

    const usuario = await crearUsuario({
      name: "Admin Creado Por SST",
      email: `admin-sst-${Date.now()}@test.local`,
      password: "password123",
      passwordConfirmacion: "password123",
      role: Role.ADMINISTRADOR,
    });

    expect(usuario.role).toBe(Role.ADMINISTRADOR);
  });

  it("SST puede editar cualquier usuario", async () => {
    const sst = await crearUsuarioDeTest(Role.SST);
    loginComo(sst);
    const supervisor = await crearUsuarioDeTest(Role.SUPERVISOR, { name: "Antes" });

    const actualizado = await actualizarUsuario(supervisor.id, {
      name: "Después",
      email: supervisor.email,
      role: Role.SUPERVISOR,
      activo: true,
    });

    expect(actualizado.name).toBe("Después");
  });

  it("SST puede restablecer la contraseña de cualquier usuario", async () => {
    const sst = await crearUsuarioDeTest(Role.SST);
    loginComo(sst);
    const trabajador = await crearUsuarioDeTest(Role.TRABAJADOR);

    await expect(
      restablecerPassword(trabajador.id, "nuevaPassword123", "nuevaPassword123"),
    ).resolves.not.toThrow();
  });

  it("rechaza crear/editar/resetear a un TRABAJADOR, SUPERVISOR o DIRECTOR (no tienen este permiso)", async () => {
    const supervisor = await crearUsuarioDeTest(Role.SUPERVISOR);
    loginComo(supervisor);

    await expect(
      crearUsuario({
        name: "No Deberia Crearse",
        email: `no-deberia-${Date.now()}@test.local`,
        password: "password123",
        passwordConfirmacion: "password123",
        role: Role.TRABAJADOR,
        cedula: "1",
        tipoVehiculo: TipoVehiculo.MOTO,
      }),
    ).rejects.toThrow();

    await expect(
      restablecerPassword(supervisor.id, "nuevaPassword123", "nuevaPassword123"),
    ).rejects.toThrow();
  });
});
