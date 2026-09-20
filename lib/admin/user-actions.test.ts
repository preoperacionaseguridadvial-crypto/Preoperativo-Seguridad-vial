import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mismo patrón que lib/inspections/actions.test.ts: se mockea la sesión de
// NextAuth (lo único que `requireRole` necesita), el resto corre contra
// Postgres real (test/setup.ts + test/helpers/db.ts).
const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: () => mockAuth(),
}));

// La foto del vehículo se sube a S3/MinIO: acá se mockea el cliente de
// storage para verificar cuántas veces se sube/borra sin depender de MinIO.
const mockUploadObject = vi.fn();
const mockDeleteObject = vi.fn();
vi.mock("@/lib/storage/s3", () => ({
  uploadObject: (...args: unknown[]) => mockUploadObject(...args),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}));

import { prisma } from "@/lib/prisma";
import { Role, TipoVehiculo } from "@/generated/prisma/client";
import { MAX_FOTO_BYTES, type DatosVehiculo } from "@/lib/admin/hoja-de-vida";
import {
  actualizarUsuario,
  crearUsuario,
  crearUsuarioDesdeFormulario,
  restablecerPassword,
} from "@/lib/admin/user-actions";
import {
  crearUsuario as crearUsuarioDeTest,
  crearVehiculo as crearVehiculoDeTest,
  limpiarBaseDeTest,
} from "@/test/helpers/db";

function loginComoAdmin() {
  return crearUsuarioDeTest(Role.ADMINISTRADOR).then((admin) => {
    mockAuth.mockResolvedValue({ user: { id: admin.id, role: admin.role } });
    return admin;
  });
}

function loginComo(user: { id: string; role: Role }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, role: user.role } });
}

function crearFotoFalsa(nombre = "foto.jpg", tipo = "image/jpeg"): File {
  return new File([Buffer.from("contenido-de-prueba")], nombre, { type: tipo });
}

/** Hoja de vida completa y válida de un vehículo (foto incluida). */
function datosVehiculo(overrides: Partial<DatosVehiculo> = {}): DatosVehiculo {
  return {
    placa: "ABC123",
    foto: crearFotoFalsa(),
    marca: "Yamaha",
    modelo: "FZ",
    color: "Negro",
    fechaVencimientoSoat: new Date("2027-01-01"),
    fechaVencimientoTecnicomecanica: new Date("2027-03-01"),
    ...overrides,
  };
}

let contadorEmail = 0;
const emailUnico = () => `usuario-${Date.now()}-${contadorEmail++}@test.local`;

/** Payload válido de alta de un TRABAJADOR con su vehículo. */
function altaTrabajador(overrides: Partial<Parameters<typeof crearUsuario>[0]> = {}) {
  return {
    name: "Trabajador Con Vehículo",
    email: emailUnico(),
    password: "password123",
    passwordConfirmacion: "password123",
    role: Role.TRABAJADOR,
    cedula: "1234567890",
    tipoVehiculo: TipoVehiculo.MOTO,
    vehiculo: datosVehiculo(),
    ...overrides,
  };
}

beforeEach(async () => {
  await limpiarBaseDeTest();
  mockAuth.mockReset();
  mockUploadObject.mockReset();
  mockUploadObject.mockResolvedValue("vehiculos/fake-key.jpg");
  mockDeleteObject.mockReset();
  mockDeleteObject.mockResolvedValue(undefined);
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

  it("crea un TRABAJADOR con cédula, tipoVehiculo, vehículo y puestoAsignado", async () => {
    await loginComoAdmin();

    const usuario = await crearUsuario(
      altaTrabajador({
        name: "Trabajador Completo",
        tipoVehiculo: TipoVehiculo.CARRO,
        vehiculo: datosVehiculo({ placa: "CAR123" }),
        puestoAsignado: "Conductor de reparto",
      }),
    );

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

    const usuario = await crearUsuario(
      altaTrabajador({
        name: "Trabajador Creado Por SST",
        vehiculo: datosVehiculo({ placa: "SST123" }),
      }),
    );

    expect(usuario.role).toBe(Role.TRABAJADOR);
    expect(usuario.vehiculo?.placa).toBe("SST123");
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

function formularioDeUsuario(campos: Record<string, string | File>) {
  const formData = new FormData();
  for (const [clave, valor] of Object.entries(campos)) {
    formData.set(clave, valor);
  }
  return formData;
}

const CAMPOS_VEHICULO = {
  placa: " frm123 ",
  foto: crearFotoFalsa(),
  marca: "Chevrolet",
  modelo: "Spark",
  color: "Rojo",
  fechaVencimientoSoat: "2027-01-15",
};

const CAMPOS_SUPERVISOR = {
  name: "  Supervisor Nuevo  ",
  email: "Supervisor.Nuevo@Test.Local",
  password: "clave-secreta-123",
  passwordConfirmacion: "clave-secreta-123",
  role: Role.SUPERVISOR,
};

describe("crearUsuarioDesdeFormulario — estado para la pantalla de éxito", () => {
  it("devuelve ok con nombre, email, contraseña y rol normalizados y crea el usuario", async () => {
    await loginComoAdmin();

    const estado = await crearUsuarioDesdeFormulario(null, formularioDeUsuario(CAMPOS_SUPERVISOR));

    expect(estado).toEqual({
      ok: true,
      name: "Supervisor Nuevo",
      email: "supervisor.nuevo@test.local",
      password: "clave-secreta-123",
      role: Role.SUPERVISOR,
      placa: null,
    });
    const creado = await prisma.user.findUnique({ where: { email: "supervisor.nuevo@test.local" } });
    expect(creado?.role).toBe(Role.SUPERVISOR);
  });

  // Número de motor, número de chasis, vencimiento de tarjeta de tránsito y
  // vencimiento del pase se eliminaron por completo del sistema (decisión del
  // usuario, 2026-09-18): ya no existen ni como campo ni como columna.
  it("crea un TRABAJADOR con su vehículo desde el formulario (foto y checkbox incluidos)", async () => {
    await loginComoAdmin();

    const estado = await crearUsuarioDesdeFormulario(
      null,
      formularioDeUsuario({
        ...CAMPOS_SUPERVISOR,
        email: "trabajador.form@test.local",
        role: Role.TRABAJADOR,
        cedula: "1234567890",
        tipoVehiculo: TipoVehiculo.CARRO,
        ...CAMPOS_VEHICULO,
      }),
    );

    expect(estado).toMatchObject({ ok: true, placa: "FRM123" });
    const creado = await prisma.user.findUniqueOrThrow({
      where: { email: "trabajador.form@test.local" },
      include: { vehicle: true },
    });
    expect(creado.vehicle).toMatchObject({
      placa: "FRM123",
      marca: "Chevrolet",
      tipoVehiculo: TipoVehiculo.CARRO,
      tipo: "Automóvil",
    });
    expect(creado.vehicle?.fotoS3Key).toMatch(/^vehiculos\/FRM123\/.+\.jpg$/);
    expect(creado.vehicle?.fechaVencimientoSoat?.toISOString().slice(0, 10)).toBe("2027-01-15");
    expect(creado.tipoVehiculo).toBe(TipoVehiculo.CARRO);
    expect(creado.vehicle).not.toHaveProperty("numeroMotor");
    expect(creado.vehicle).not.toHaveProperty("numeroChasis");
    expect(creado.vehicle).not.toHaveProperty("fechaVencimientoTarjetaTransito");
    expect(creado).not.toHaveProperty("fechaVencimientoPase");
    // Sin el checkbox en el FormData el navegador no envía `conductorActivo`.
    expect(creado.conductorActivo).toBe(false);
  });

  it("no guarda la contraseña (ni en texto plano) en el audit log", async () => {
    await loginComoAdmin();

    await crearUsuarioDesdeFormulario(null, formularioDeUsuario(CAMPOS_SUPERVISOR));

    const registros = await prisma.auditLog.findMany({ where: { action: "CREAR_USUARIO" } });
    expect(registros).toHaveLength(1);
    expect(JSON.stringify(registros[0])).not.toContain("clave-secreta-123");
  });

  it("devuelve el error de email duplicado sin lanzar", async () => {
    await loginComoAdmin();
    await crearUsuarioDeTest(Role.TRABAJADOR, { email: "duplicado@test.local" });

    const estado = await crearUsuarioDesdeFormulario(
      null,
      formularioDeUsuario({ ...CAMPOS_SUPERVISOR, email: "duplicado@test.local" }),
    );

    expect(estado).toMatchObject({ ok: false, error: "Ya existe un usuario con ese email." });
  });

  it("devuelve error cuando las contraseñas no coinciden y conserva solo los campos no sensibles", async () => {
    await loginComoAdmin();

    const estado = await crearUsuarioDesdeFormulario(
      null,
      formularioDeUsuario({ ...CAMPOS_SUPERVISOR, passwordConfirmacion: "otra-clave-999" }),
    );

    expect(estado).toMatchObject({ ok: false, error: "Las contraseñas no coinciden." });
    if (estado.ok) throw new Error("se esperaba un estado de error");
    expect(estado.valores.name).toBe("  Supervisor Nuevo  ");
    expect(estado.valores.role).toBe(Role.SUPERVISOR);
    expect(JSON.stringify(estado)).not.toContain("clave-secreta-123");
    expect(JSON.stringify(estado)).not.toContain("otra-clave-999");
  });

  it("devuelve error al crear un TRABAJADOR sin cédula y no crea nada", async () => {
    await loginComoAdmin();

    const estado = await crearUsuarioDesdeFormulario(
      null,
      formularioDeUsuario({
        ...CAMPOS_SUPERVISOR,
        email: "sin.cedula@test.local",
        role: Role.TRABAJADOR,
        tipoVehiculo: TipoVehiculo.MOTO,
      }),
    );

    expect(estado).toMatchObject({ ok: false, error: expect.stringMatching(/cédula/i) });
    expect(await prisma.user.findUnique({ where: { email: "sin.cedula@test.local" } })).toBeNull();
  });

  it("devuelve error (sin crear nada) cuando el rol de la sesión no tiene permiso", async () => {
    const trabajador = await crearUsuarioDeTest(Role.TRABAJADOR);
    loginComo(trabajador);

    const estado = await crearUsuarioDesdeFormulario(null, formularioDeUsuario(CAMPOS_SUPERVISOR));

    expect(estado).toMatchObject({ ok: false });
    expect(
      await prisma.user.findUnique({ where: { email: "supervisor.nuevo@test.local" } }),
    ).toBeNull();
  });
});

// Hardening (#5): al formulario solo llegan los errores de dominio pensados
// para el usuario (validaciones, duplicados, permisos); cualquier otra falla
// (Prisma, S3, bugs) devuelve un mensaje genérico y se registra en el servidor
// sin filtrar el texto crudo (tablas, columnas, buckets) a la pantalla.
describe("crearUsuarioDesdeFormulario — errores de dominio vs. inesperados", () => {
  const MENSAJE_GENERICO = "No se pudo crear el usuario. Intenta de nuevo o contacta a soporte.";

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("un error de dominio conserva su mensaje y no se registra como fallo del servidor", async () => {
    await loginComoAdmin();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await crearUsuarioDeTest(Role.TRABAJADOR, { email: "duplicado@test.local" });

    const duplicado = await crearUsuarioDesdeFormulario(
      null,
      formularioDeUsuario({ ...CAMPOS_SUPERVISOR, email: "duplicado@test.local" }),
    );
    const validacion = await crearUsuarioDesdeFormulario(
      null,
      formularioDeUsuario({ ...CAMPOS_SUPERVISOR, passwordConfirmacion: "otra" }),
    );
    const hojaDeVida = await crearUsuarioDesdeFormulario(
      null,
      formularioDeUsuario({
        ...CAMPOS_SUPERVISOR,
        email: "sin.marca@test.local",
        role: Role.TRABAJADOR,
        cedula: "123",
        tipoVehiculo: TipoVehiculo.MOTO,
        ...CAMPOS_VEHICULO,
        marca: "",
      }),
    );

    expect(duplicado).toMatchObject({ ok: false, error: "Ya existe un usuario con ese email." });
    expect(validacion).toMatchObject({ ok: false, error: "Las contraseñas no coinciden." });
    expect(hojaDeVida).toMatchObject({ ok: false, error: "La marca es obligatoria." });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("un error inesperado de Prisma devuelve el mensaje genérico, no filtra el texto crudo y se registra con console.error", async () => {
    await loginComoAdmin();
    const errorCrudo = new Error(
      'Invalid `prisma.user.create()` invocation: column "passwordHash" of relation "User" does not exist (table public.User)',
    );
    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(errorCrudo);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const estado = await crearUsuarioDesdeFormulario(null, formularioDeUsuario(CAMPOS_SUPERVISOR));

    expect(estado).toMatchObject({ ok: false, error: MENSAJE_GENERICO });
    expect(JSON.stringify(estado)).not.toMatch(/prisma|passwordHash|relation|table/i);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    // Se registra el error original (para diagnosticar) pero nada del formulario.
    const argumentosLog = consoleErrorSpy.mock.calls[0];
    expect(argumentosLog).toContain(errorCrudo);
    const otrosArgumentos = JSON.stringify(argumentosLog.filter((argumento) => argumento !== errorCrudo));
    expect(otrosArgumentos).not.toContain("clave-secreta-123");
    expect(otrosArgumentos).not.toContain("supervisor.nuevo@test.local");
    expect(otrosArgumentos).not.toContain("Supervisor Nuevo");
  });

  it("un fallo inesperado de S3 al subir la foto también devuelve el mensaje genérico", async () => {
    await loginComoAdmin();
    mockUploadObject.mockRejectedValueOnce(new Error("AccessDenied: bucket preoperacional-prod, key vehiculos/FRM123"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const estado = await crearUsuarioDesdeFormulario(
      null,
      formularioDeUsuario({
        ...CAMPOS_SUPERVISOR,
        email: "trabajador.s3@test.local",
        role: Role.TRABAJADOR,
        cedula: "1234567890",
        tipoVehiculo: TipoVehiculo.MOTO,
        ...CAMPOS_VEHICULO,
      }),
    );

    expect(estado).toMatchObject({ ok: false, error: MENSAJE_GENERICO });
    expect(JSON.stringify(estado)).not.toMatch(/AccessDenied|bucket/i);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it("ante un error inesperado repuebla los campos no sensibles y nunca las contraseñas", async () => {
    await loginComoAdmin();
    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const estado = await crearUsuarioDesdeFormulario(null, formularioDeUsuario(CAMPOS_SUPERVISOR));

    if (estado.ok) throw new Error("se esperaba un estado de error");
    expect(estado.valores.name).toBe("  Supervisor Nuevo  ");
    expect(estado.valores.email).toBe("Supervisor.Nuevo@Test.Local");
    expect(estado.valores.role).toBe(Role.SUPERVISOR);
    expect(JSON.stringify(estado)).not.toContain("clave-secreta-123");
  });
});

// Modelo 1:1 (decisión del usuario, 2026-09-18): cada TRABAJADOR tiene UN
// vehículo que se crea junto con el usuario, con la hoja de vida completa y
// la foto obligatoria. Aquí viven, portados desde el ex
// lib/admin/vehicle-actions.test.ts, los casos de hoja de vida, MIME de foto,
// sanitización de key, placa duplicada y limpieza de S3.
describe("crearUsuario — TRABAJADOR con su vehículo (1:1)", () => {
  it("crea usuario y vehículo vinculados, y sube la foto a S3", async () => {
    await loginComoAdmin();

    const usuario = await crearUsuario(altaTrabajador({ vehiculo: datosVehiculo({ placa: "  abc123 " }) }));

    const vehiculo = await prisma.vehicle.findUniqueOrThrow({ where: { placa: "ABC123" } });
    expect(usuario.vehicleId).toBe(vehiculo.id);
    expect(usuario.vehiculo?.id).toBe(vehiculo.id);
    expect(vehiculo).toMatchObject({
      tipoVehiculo: TipoVehiculo.MOTO,
      tipo: "Motocicleta",
      activo: true,
      marca: "Yamaha",
      modelo: "FZ",
      color: "Negro",
    });
    expect(vehiculo).not.toHaveProperty("numeroMotor");
    expect(vehiculo).not.toHaveProperty("numeroChasis");
    expect(vehiculo).not.toHaveProperty("fechaVencimientoTarjetaTransito");
    expect(vehiculo.fotoS3Key).toMatch(/^vehiculos\/ABC123\/.+\.jpg$/);
    expect(vehiculo.fechaVencimientoSoat?.toISOString().slice(0, 10)).toBe("2027-01-01");
    expect(vehiculo.fechaVencimientoTecnicomecanica?.toISOString().slice(0, 10)).toBe("2027-03-01");
    expect(mockUploadObject).toHaveBeenCalledTimes(1);
  });

  it("rechaza un TRABAJADOR sin placa (ni siquiera sube la foto)", async () => {
    await loginComoAdmin();

    await expect(crearUsuario(altaTrabajador({ vehiculo: datosVehiculo({ placa: "   " }) }))).rejects.toThrow(
      "La placa es obligatoria para un trabajador.",
    );
    await expect(crearUsuario(altaTrabajador({ vehiculo: undefined }))).rejects.toThrow(
      "La placa es obligatoria para un trabajador.",
    );
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it("rechaza un TRABAJADOR sin foto y no crea usuario ni vehículo", async () => {
    await loginComoAdmin();
    const email = emailUnico();

    await expect(
      crearUsuario(altaTrabajador({ email, vehiculo: datosVehiculo({ foto: undefined }) })),
    ).rejects.toThrow(/foto/i);
    expect(mockUploadObject).not.toHaveBeenCalled();
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    expect(await prisma.vehicle.count()).toBe(0);
  });

  it.each([
    ["marca", /marca/i],
    ["modelo", /modelo/i],
    ["color", /color/i],
  ] as const)("rechaza un TRABAJADOR sin %s y no crea nada", async (campo, mensaje) => {
    await loginComoAdmin();
    const email = emailUnico();

    await expect(
      crearUsuario(altaTrabajador({ email, vehiculo: datosVehiculo({ [campo]: "" }) })),
    ).rejects.toThrow(mensaje);
    expect(mockUploadObject).not.toHaveBeenCalled();
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    expect(await prisma.vehicle.count()).toBe(0);
  });

  it("rechaza una foto que no es imagen (sin subirla ni crear nada)", async () => {
    await loginComoAdmin();
    const documento = crearFotoFalsa("documento.pdf", "application/pdf");

    await expect(
      crearUsuario(altaTrabajador({ vehiculo: datosVehiculo({ foto: documento }) })),
    ).rejects.toThrow(/imagen/i);
    expect(mockUploadObject).not.toHaveBeenCalled();
    expect(await prisma.vehicle.count()).toBe(0);
  });

  it("rechaza una foto que supera el tamaño máximo", async () => {
    await loginComoAdmin();
    const enorme = new File([new Uint8Array(MAX_FOTO_BYTES + 1)], "grande.jpg", { type: "image/jpeg" });

    await expect(
      crearUsuario(altaTrabajador({ vehiculo: datosVehiculo({ foto: enorme }) })),
    ).rejects.toThrow(/no puede superar/i);
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it("con placa duplicada devuelve un error claro, borra la foto y no deja usuario huérfano", async () => {
    await loginComoAdmin();
    await crearVehiculoDeTest({ placa: "DUP123" });
    const email = emailUnico();

    await expect(
      crearUsuario(altaTrabajador({ email, vehiculo: datosVehiculo({ placa: "dup123" }) })),
    ).rejects.toThrow("Ya existe un vehículo con esa placa.");

    expect(mockDeleteObject).toHaveBeenCalledTimes(1);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    expect(await prisma.vehicle.count()).toBe(1);
  });

  it("con email duplicado devuelve un error claro, borra la foto y no deja vehículo huérfano", async () => {
    await loginComoAdmin();
    const existente = await crearUsuarioDeTest(Role.SUPERVISOR, { email: "dup@test.local" });

    await expect(
      crearUsuario(altaTrabajador({ email: existente.email, vehiculo: datosVehiculo({ placa: "NUEVA1" }) })),
    ).rejects.toThrow("Ya existe un usuario con ese email.");

    expect(mockDeleteObject).toHaveBeenCalledTimes(1);
    expect(await prisma.vehicle.findUnique({ where: { placa: "NUEVA1" } })).toBeNull();
  });

  it("sanea la placa usada en la key de S3 (no permite escapar el prefijo vehiculos/<placa>/)", async () => {
    await loginComoAdmin();

    const usuario = await crearUsuario(altaTrabajador({ vehiculo: datosVehiculo({ placa: "../../etc" }) }));

    const key = usuario.vehiculo?.fotoS3Key ?? "";
    expect(key).not.toContain("..");
    expect(key.startsWith("vehiculos/")).toBe(true);
  });

  it("deriva la extensión de la key del tipo MIME validado, no del nombre de archivo", async () => {
    await loginComoAdmin();
    const foto = crearFotoFalsa("foto.png.exe", "image/png");

    const usuario = await crearUsuario(altaTrabajador({ vehiculo: datosVehiculo({ foto }) }));

    expect(usuario.vehiculo?.fotoS3Key).toMatch(/\.png$/);
  });

  it("un rol distinto de TRABAJADOR no lleva vehículo (ignora los datos si llegan)", async () => {
    await loginComoAdmin();

    const usuario = await crearUsuario({
      name: "Supervisor Sin Vehículo",
      email: emailUnico(),
      password: "password123",
      passwordConfirmacion: "password123",
      role: Role.SUPERVISOR,
      vehiculo: datosVehiculo({ placa: "IGN123" }),
    });

    expect(usuario.vehicleId).toBeNull();
    expect(await prisma.vehicle.count()).toBe(0);
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it("audita CREAR_USUARIO (con la placa) y CREAR_VEHICULO, sin la contraseña", async () => {
    await loginComoAdmin();

    await crearUsuario(
      altaTrabajador({ password: "clave-que-no-va-al-audit", passwordConfirmacion: "clave-que-no-va-al-audit" }),
    );

    const registros = await prisma.auditLog.findMany({
      where: { action: { in: ["CREAR_USUARIO", "CREAR_VEHICULO"] } },
    });
    expect(registros.map((r) => r.action).sort()).toEqual(["CREAR_USUARIO", "CREAR_VEHICULO"]);
    expect(registros.find((r) => r.action === "CREAR_USUARIO")?.metadata).toMatchObject({ placa: "ABC123" });
    expect(JSON.stringify(registros)).not.toContain("clave-que-no-va-al-audit");
  });
});

describe("actualizarUsuario — vehículo del trabajador", () => {
  async function trabajadorConVehiculo() {
    await loginComoAdmin();
    const creado = await crearUsuario(altaTrabajador({ vehiculo: datosVehiculo({ placa: "OLD123" }) }));
    mockUploadObject.mockClear();
    return creado;
  }

  const datos = (u: { name: string; email: string }, extra: Record<string, unknown> = {}) => ({
    name: u.name,
    email: u.email,
    role: Role.TRABAJADOR,
    activo: true,
    cedula: "9999",
    tipoVehiculo: TipoVehiculo.MOTO,
    ...extra,
  });

  it("edita los datos del vehículo sin volver a subir la foto (conserva el fotoS3Key)", async () => {
    const trabajador = await trabajadorConVehiculo();
    const keyOriginal = trabajador.vehiculo?.fotoS3Key;

    const actualizado = await actualizarUsuario(
      trabajador.id,
      datos(trabajador, {
        tipoVehiculo: TipoVehiculo.CARRO,
        vehiculo: datosVehiculo({ placa: "new123", foto: undefined, marca: "Chevrolet", modelo: "NPR" }),
      }),
    );

    const vehiculo = await prisma.vehicle.findUniqueOrThrow({ where: { id: actualizado.vehicleId! } });
    expect(vehiculo).toMatchObject({
      id: trabajador.vehicleId,
      placa: "NEW123",
      marca: "Chevrolet",
      modelo: "NPR",
      tipoVehiculo: TipoVehiculo.CARRO,
      tipo: "Automóvil",
      fotoS3Key: keyOriginal,
    });
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it("audita ACTUALIZAR_VEHICULO con la placa y el estado `activo` resultante al desactivar el vehículo", async () => {
    const trabajador = await trabajadorConVehiculo();
    const admin = await prisma.user.findFirstOrThrow({ where: { role: Role.ADMINISTRADOR } });

    await actualizarUsuario(
      trabajador.id,
      datos(trabajador, {
        vehiculo: datosVehiculo({ placa: "OLD123", foto: undefined, activo: false }),
      }),
    );

    const registros = await prisma.auditLog.findMany({ where: { action: "ACTUALIZAR_VEHICULO" } });
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({
      userId: admin.id,
      entityType: "Vehicle",
      entityId: trabajador.vehicleId,
      metadata: { placa: "OLD123", activo: false },
    });
  });

  it("audita ACTUALIZAR_VEHICULO con `activo: true` al reactivar el vehículo", async () => {
    const trabajador = await trabajadorConVehiculo();
    await prisma.vehicle.update({ where: { id: trabajador.vehicleId! }, data: { activo: false } });

    await actualizarUsuario(
      trabajador.id,
      datos(trabajador, {
        vehiculo: datosVehiculo({ placa: "OLD123", foto: undefined, activo: true }),
      }),
    );

    const registros = await prisma.auditLog.findMany({ where: { action: "ACTUALIZAR_VEHICULO" } });
    expect(registros).toHaveLength(1);
    expect(registros[0].metadata).toEqual({ placa: "OLD123", activo: true });
  });

  it("reemplaza la foto cuando se sube una nueva", async () => {
    const trabajador = await trabajadorConVehiculo();

    await actualizarUsuario(
      trabajador.id,
      datos(trabajador, {
        vehiculo: datosVehiculo({ placa: "OLD123", foto: crearFotoFalsa("nueva.png", "image/png") }),
      }),
    );

    const vehiculo = await prisma.vehicle.findUniqueOrThrow({ where: { id: trabajador.vehicleId! } });
    expect(mockUploadObject).toHaveBeenCalledTimes(1);
    expect(vehiculo.fotoS3Key).toMatch(/\.png$/);
    expect(vehiculo.fotoS3Key).not.toBe(trabajador.vehiculo?.fotoS3Key);
  });

  it("no acepta vaciar la hoja de vida de un vehículo que ya la tenía completa", async () => {
    const trabajador = await trabajadorConVehiculo();

    await expect(
      actualizarUsuario(
        trabajador.id,
        datos(trabajador, { vehiculo: datosVehiculo({ placa: "OLD123", foto: undefined, marca: "" }) }),
      ),
    ).rejects.toThrow(/marca/i);
  });

  it("rechaza una foto que no es imagen al editar", async () => {
    const trabajador = await trabajadorConVehiculo();

    await expect(
      actualizarUsuario(
        trabajador.id,
        datos(trabajador, {
          vehiculo: datosVehiculo({ placa: "OLD123", foto: crearFotoFalsa("doc.pdf", "application/pdf") }),
        }),
      ),
    ).rejects.toThrow(/imagen/i);
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it("con placa duplicada al editar devuelve un error claro y borra la foto nueva", async () => {
    const trabajador = await trabajadorConVehiculo();
    await crearVehiculoDeTest({ placa: "OTRA123" });

    await expect(
      actualizarUsuario(
        trabajador.id,
        datos(trabajador, { vehiculo: datosVehiculo({ placa: "otra123" }) }),
      ),
    ).rejects.toThrow("Ya existe un vehículo con esa placa.");
    expect(mockDeleteObject).toHaveBeenCalledTimes(1);
  });

  it("permite completar a un TRABAJADOR legacy sin vehículo: lo crea y lo vincula (mismas reglas del alta)", async () => {
    await loginComoAdmin();
    const legacy = await crearUsuarioDeTest(Role.TRABAJADOR, { name: "Legacy" });

    const actualizado = await actualizarUsuario(
      legacy.id,
      datos(legacy, { vehiculo: datosVehiculo({ placa: "LEG123" }) }),
    );

    const vehiculo = await prisma.vehicle.findUniqueOrThrow({ where: { placa: "LEG123" } });
    expect(actualizado.vehicleId).toBe(vehiculo.id);
    expect(vehiculo.fotoS3Key).toMatch(/^vehiculos\/LEG123\//);
    expect(mockUploadObject).toHaveBeenCalledTimes(1);
  });

  it("un TRABAJADOR legacy sin vehículo puede editarse sin cargar ninguno (no se exige retroactivamente)", async () => {
    await loginComoAdmin();
    const legacy = await crearUsuarioDeTest(Role.TRABAJADOR, { name: "Legacy" });

    const actualizado = await actualizarUsuario(
      legacy.id,
      datos(legacy, {
        vehiculo: { placa: "", marca: "", modelo: "", color: "" },
      }),
    );

    expect(actualizado.vehicleId).toBeNull();
    expect(await prisma.vehicle.count()).toBe(0);
  });

  it("al completar un legacy exige el alta completa (p. ej. la foto)", async () => {
    await loginComoAdmin();
    const legacy = await crearUsuarioDeTest(Role.TRABAJADOR, { name: "Legacy" });

    await expect(
      actualizarUsuario(
        legacy.id,
        datos(legacy, { vehiculo: datosVehiculo({ placa: "LEG124", foto: undefined }) }),
      ),
    ).rejects.toThrow(/foto/i);
    expect(await prisma.vehicle.count()).toBe(0);
  });

  it("un vehículo legacy sin hoja de vida es editable sin forzar a completarla (strings vacíos -> null)", async () => {
    await loginComoAdmin();
    const vehiculoLegacy = await crearVehiculoDeTest({ placa: "OLDLEG1" });
    const legacy = await crearUsuarioDeTest(Role.TRABAJADOR, { vehicleId: vehiculoLegacy.id });

    await actualizarUsuario(
      legacy.id,
      datos(legacy, {
        vehiculo: { placa: "OLDLEG1", marca: "", modelo: "", color: "" },
      }),
    );

    const vehiculo = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehiculoLegacy.id } });
    expect(vehiculo.marca).toBeNull();
    expect(mockUploadObject).not.toHaveBeenCalled();
  });

  it("rechaza una hoja de vida a medias en un vehículo legacy (no acepta datos parciales)", async () => {
    await loginComoAdmin();
    const vehiculoLegacy = await crearVehiculoDeTest({ placa: "OLDLEG2" });
    const legacy = await crearUsuarioDeTest(Role.TRABAJADOR, { vehicleId: vehiculoLegacy.id });

    await expect(
      actualizarUsuario(legacy.id, datos(legacy, { vehiculo: { placa: "OLDLEG2", marca: "Yamaha" } })),
    ).rejects.toThrow(/modelo/i);
  });

  it("un rol distinto de TRABAJADOR ignora los datos de vehículo", async () => {
    await loginComoAdmin();
    const supervisor = await crearUsuarioDeTest(Role.SUPERVISOR);

    const actualizado = await actualizarUsuario(supervisor.id, {
      name: supervisor.name,
      email: supervisor.email,
      role: Role.SUPERVISOR,
      activo: true,
      vehiculo: datosVehiculo({ placa: "SUP123" }),
    });

    expect(actualizado.vehicleId).toBeNull();
    expect(await prisma.vehicle.count()).toBe(0);
  });

  // Sin el módulo de vehículos aparte, editar al usuario es la única forma de
  // activar o desactivar su vehículo (y de destrabar a un trabajador cuyo
  // vehículo quedó inactivo, que no puede iniciar inspecciones).
  it("desactiva y vuelve a activar el vehículo del trabajador al editarlo", async () => {
    const trabajador = await trabajadorConVehiculo();
    const activoEnBase = async () =>
      (await prisma.vehicle.findUniqueOrThrow({ where: { id: trabajador.vehicleId! } })).activo;
    const editar = (activo: boolean) =>
      actualizarUsuario(
        trabajador.id,
        datos(trabajador, { vehiculo: datosVehiculo({ placa: "OLD123", foto: undefined, activo }) }),
      );

    await editar(false);
    expect(await activoEnBase()).toBe(false);

    await editar(true);
    expect(await activoEnBase()).toBe(true);
  });

  it("no cambia el estado del vehículo si el formulario no envía `activo`", async () => {
    const trabajador = await trabajadorConVehiculo();
    await prisma.vehicle.update({ where: { id: trabajador.vehicleId! }, data: { activo: false } });

    await actualizarUsuario(
      trabajador.id,
      datos(trabajador, { vehiculo: datosVehiculo({ placa: "OLD123", foto: undefined }) }),
    );

    const vehiculo = await prisma.vehicle.findUniqueOrThrow({ where: { id: trabajador.vehicleId! } });
    expect(vehiculo.activo).toBe(false);
  });
});
