import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mockeamos la sesión de NextAuth (no la base de datos): `auth()` normalmente
// lee una cookie firmada y no tiene sentido simularla acá — lo único que
// `requireRole` necesita es el objeto `{ user: { id, role } }` que devuelve.
// El resto (Prisma, constraints, transacciones) corre contra Postgres real
// (ver test/setup.ts y test/helpers/db.ts) porque son justo las reglas de
// negocio que hay que proteger.
const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: () => mockAuth(),
}));

import { prisma } from "@/lib/prisma";
import {
  Role,
  InspectionStatus,
  RespuestaChecklist,
  TipoFirma,
  TipoVehiculo,
  TipoRespuestaItem,
  TipoFotoInspeccion,
} from "@/generated/prisma/client";
import {
  cancelarInspeccion,
  enviarInspeccion,
  iniciarInspeccion,
  registrarEstadoConductor,
  registrarRespuestaEstadoConductor,
  registrarKilometraje,
  registrarResultado,
  responderItem,
} from "@/lib/inspections/actions";
import {
  crearCatalogoMinimo,
  crearChecklistItem,
  crearUsuario,
  crearVehiculo,
  limpiarBaseDeTest,
} from "@/test/helpers/db";
import { getChecklistCatalog } from "@/lib/inspections/queries";

function loginComo(user: { id: string; role: Role }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, role: user.role } });
}

async function crearInspeccionEnProceso() {
  const worker = await crearUsuario(Role.TRABAJADOR);
  const vehicle = await crearVehiculo();
  const inspection = await prisma.inspection.create({
    data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
  });
  return { worker, vehicle, inspection };
}

async function responderTodoElChecklist(inspectionId: string, itemId: string) {
  await prisma.inspectionItemResponse.create({
    data: { inspectionId, checklistItemId: itemId, valor: RespuestaChecklist.OK },
  });
}

async function firmarComoConductor(inspectionId: string, userId: string) {
  await prisma.firma.create({
    data: { inspectionId, userId, tipo: TipoFirma.CONDUCTOR, s3Key: "firmas/test.png" },
  });
}

// Slice 3: `enviarInspeccion` ahora también exige las 2 fotos diarias y la
// declaración de estado del conductor completa. Helper equivalente a
// `firmarComoConductor` — inserta directo en base (mismo criterio: no pasa
// por el server action `subirFotoInspeccion`, que requiere un `File` real y
// S3, igual que `firmarComoConductor` no pasa por `guardarFirmaConductor`).
async function completarFotosYDeclaracion(inspectionId: string) {
  await prisma.fotoInspeccion.create({
    data: { inspectionId, tipo: TipoFotoInspeccion.LATERAL, s3Key: "fotos-inspeccion/test-lateral.jpg" },
  });
  await prisma.fotoInspeccion.create({
    data: { inspectionId, tipo: TipoFotoInspeccion.PLACA, s3Key: "fotos-inspeccion/test-placa.jpg" },
  });
  await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      tomaMedicamentos: false,
      condicionesAptas: true,
      consumioAlcohol: false,
      declaracionEstadoAt: new Date(),
    },
  });
}

beforeEach(async () => {
  await limpiarBaseDeTest();
  await crearCatalogoMinimo();
  mockAuth.mockReset();
});

afterAll(async () => {
  await limpiarBaseDeTest();
  await prisma.$disconnect();
});

describe("enviarInspeccion", () => {
  it("rechaza si falta registrar el resultado (puedeOperar)", async () => {
    const { worker, inspection } = await crearInspeccionEnProceso();
    loginComo(worker);

    await expect(enviarInspeccion(inspection.id)).rejects.toThrow(
      /falta registrar si el vehículo puede operar/i,
    );
  });

  it("rechaza si falta la firma del conductor", async () => {
    const { worker, inspection } = await crearInspeccionEnProceso();
    loginComo(worker);
    await registrarResultado(inspection.id, true);

    await expect(enviarInspeccion(inspection.id)).rejects.toThrow(/falta la firma del conductor/i);
  });

  it("rechaza si el checklist no está completo", async () => {
    const { worker, inspection } = await crearInspeccionEnProceso();
    loginComo(worker);
    await registrarResultado(inspection.id, true);
    await firmarComoConductor(inspection.id, worker.id);

    // Catálogo mínimo tiene 1 ítem y no se respondió ninguno.
    await expect(enviarInspeccion(inspection.id)).rejects.toThrow(/faltan ítems del checklist/i);
  });

  it("acepta el envío cuando checklist, resultado, firma, fotos y declaración están completos, y fija completedAt server-side", async () => {
    const { worker, inspection } = await crearInspeccionEnProceso();
    const item = await prisma.checklistItem.findFirstOrThrow();
    loginComo(worker);

    await responderTodoElChecklist(inspection.id, item.id);
    await registrarResultado(inspection.id, true);
    await firmarComoConductor(inspection.id, worker.id);
    await completarFotosYDeclaracion(inspection.id);

    const antes = Date.now();
    const resultado = await enviarInspeccion(inspection.id);
    const despues = Date.now();

    expect(resultado.status).toBe(InspectionStatus.PENDIENTE_APROBACION);
    expect(resultado.completedAt).not.toBeNull();
    const completedAtMs = resultado.completedAt!.getTime();
    // `enviarInspeccion` no recibe ningún parámetro de fecha del caller: el
    // timestamp se genera con `new Date()` del servidor dentro de la propia
    // función, así que alcanza con verificar que cae en la ventana de
    // ejecución del test (no hay forma de que el caller lo inyecte).
    expect(completedAtMs).toBeGreaterThanOrEqual(antes);
    expect(completedAtMs).toBeLessThanOrEqual(despues);
  });

  it("mueve a NO_APTA_PARA_OPERAR cuando puedeOperar es false", async () => {
    const { worker, inspection } = await crearInspeccionEnProceso();
    const item = await prisma.checklistItem.findFirstOrThrow();
    loginComo(worker);

    await responderTodoElChecklist(inspection.id, item.id);
    await registrarResultado(inspection.id, false, "Frenos en mal estado");
    await firmarComoConductor(inspection.id, worker.id);
    await completarFotosYDeclaracion(inspection.id);

    const resultado = await enviarInspeccion(inspection.id);
    expect(resultado.status).toBe(InspectionStatus.NO_APTA_PARA_OPERAR);
  });
});

// Slice 3 (spec: daily-vehicle-photos): las 2 fotos diarias (LATERAL/PLACA)
// son obligatorias antes de enviar, independiente del resultado del
// checklist.
describe("enviarInspeccion — fotos diarias obligatorias", () => {
  async function prepararHastaFirma() {
    const { worker, inspection } = await crearInspeccionEnProceso();
    const item = await prisma.checklistItem.findFirstOrThrow();
    loginComo(worker);
    await responderTodoElChecklist(inspection.id, item.id);
    await registrarResultado(inspection.id, true);
    await firmarComoConductor(inspection.id, worker.id);
    return { worker, inspection };
  }

  it("rechaza el envío sin ninguna de las 2 fotos diarias", async () => {
    const { inspection } = await prepararHastaFirma();
    await registrarEstadoConductor(inspection.id, {
      tomaMedicamentos: false,
      condicionesAptas: true,
      consumioAlcohol: false,
    });

    await expect(enviarInspeccion(inspection.id)).rejects.toThrow(/faltan fotos/i);
  });

  it("rechaza el envío con solo una de las 2 fotos diarias", async () => {
    const { inspection } = await prepararHastaFirma();
    await prisma.fotoInspeccion.create({
      data: { inspectionId: inspection.id, tipo: TipoFotoInspeccion.LATERAL, s3Key: "solo-lateral.jpg" },
    });
    await registrarEstadoConductor(inspection.id, {
      tomaMedicamentos: false,
      condicionesAptas: true,
      consumioAlcohol: false,
    });

    await expect(enviarInspeccion(inspection.id)).rejects.toThrow(/faltan fotos/i);
  });

  it("acepta el envío con las 2 fotos diarias presentes", async () => {
    const { inspection } = await prepararHastaFirma();
    await prisma.fotoInspeccion.create({
      data: { inspectionId: inspection.id, tipo: TipoFotoInspeccion.LATERAL, s3Key: "a.jpg" },
    });
    await prisma.fotoInspeccion.create({
      data: { inspectionId: inspection.id, tipo: TipoFotoInspeccion.PLACA, s3Key: "b.jpg" },
    });
    await registrarEstadoConductor(inspection.id, {
      tomaMedicamentos: false,
      condicionesAptas: true,
      consumioAlcohol: false,
    });

    await expect(enviarInspeccion(inspection.id)).resolves.not.toThrow();
  });
});

// Slice 3 (spec: driver-state-declaration): las 3 respuestas son
// obligatorias antes de enviar, pero una respuesta "preocupante" NUNCA
// bloquea el envío — solo se refleja como advertencia derivada para el
// Supervisor (D8, A6). Ver lib/inspections/estado-conductor.ts.
describe("enviarInspeccion — declaración de estado del conductor obligatoria, nunca bloqueante por preocupante", () => {
  async function prepararHastaFotos() {
    const { worker, inspection } = await crearInspeccionEnProceso();
    const item = await prisma.checklistItem.findFirstOrThrow();
    loginComo(worker);
    await responderTodoElChecklist(inspection.id, item.id);
    await registrarResultado(inspection.id, true);
    await firmarComoConductor(inspection.id, worker.id);
    await prisma.fotoInspeccion.create({
      data: { inspectionId: inspection.id, tipo: TipoFotoInspeccion.LATERAL, s3Key: "a.jpg" },
    });
    await prisma.fotoInspeccion.create({
      data: { inspectionId: inspection.id, tipo: TipoFotoInspeccion.PLACA, s3Key: "b.jpg" },
    });
    return { worker, inspection };
  }

  it("rechaza el envío si falta la declaración de estado del conductor", async () => {
    const { inspection } = await prepararHastaFotos();

    await expect(enviarInspeccion(inspection.id)).rejects.toThrow(
      /declaración de estado del conductor/i,
    );
  });

  it("acepta el envío aunque la declaración tenga una respuesta preocupante (no bloquea)", async () => {
    const { inspection } = await prepararHastaFotos();
    await registrarEstadoConductor(inspection.id, {
      tomaMedicamentos: true,
      condicionesAptas: true,
      consumioAlcohol: false,
    });

    const resultado = await enviarInspeccion(inspection.id);
    expect(resultado.status).toBe(InspectionStatus.PENDIENTE_APROBACION);
  });
});

describe("registrarEstadoConductor", () => {
  it("guarda las 3 respuestas y fija declaracionEstadoAt server-side", async () => {
    const { worker, inspection } = await crearInspeccionEnProceso();
    loginComo(worker);

    const antes = Date.now();
    const resultado = await registrarEstadoConductor(inspection.id, {
      tomaMedicamentos: false,
      condicionesAptas: true,
      consumioAlcohol: false,
    });
    const despues = Date.now();

    expect(resultado.tomaMedicamentos).toBe(false);
    expect(resultado.condicionesAptas).toBe(true);
    expect(resultado.consumioAlcohol).toBe(false);
    expect(resultado.declaracionEstadoAt).not.toBeNull();
    const declaracionMs = resultado.declaracionEstadoAt!.getTime();
    expect(declaracionMs).toBeGreaterThanOrEqual(antes);
    expect(declaracionMs).toBeLessThanOrEqual(despues);
  });

  it("rechaza sobre una inspección de otro trabajador", async () => {
    const { inspection } = await crearInspeccionEnProceso();
    const otro = await crearUsuario(Role.TRABAJADOR);
    loginComo(otro);

    await expect(
      registrarEstadoConductor(inspection.id, {
        tomaMedicamentos: false,
        condicionesAptas: true,
        consumioAlcohol: false,
      }),
    ).rejects.toThrow(/no pertenece al usuario autenticado/i);
  });
});

// La declaración se contesta pregunta por pregunta (una pantalla por pregunta,
// pedido del dueño de producto, 2026-09-18): cada respuesta se guarda sola.
describe("registrarRespuestaEstadoConductor", () => {
  it("guarda solo la respuesta indicada y deja las otras sin contestar", async () => {
    const { worker, inspection } = await crearInspeccionEnProceso();
    loginComo(worker);

    const resultado = await registrarRespuestaEstadoConductor(inspection.id, "tomaMedicamentos", true);

    expect(resultado.tomaMedicamentos).toBe(true);
    expect(resultado.condicionesAptas).toBeNull();
    expect(resultado.consumioAlcohol).toBeNull();
    expect(resultado.declaracionEstadoAt).toBeNull();
  });

  it("fija declaracionEstadoAt server-side recién cuando la tercera respuesta completa la declaración", async () => {
    const { worker, inspection } = await crearInspeccionEnProceso();
    loginComo(worker);

    await registrarRespuestaEstadoConductor(inspection.id, "tomaMedicamentos", false);
    const segunda = await registrarRespuestaEstadoConductor(inspection.id, "condicionesAptas", true);
    expect(segunda.declaracionEstadoAt).toBeNull();

    const antes = Date.now();
    const tercera = await registrarRespuestaEstadoConductor(inspection.id, "consumioAlcohol", false);
    const despues = Date.now();

    expect(tercera).toMatchObject({ tomaMedicamentos: false, condicionesAptas: true, consumioAlcohol: false });
    const ms = tercera.declaracionEstadoAt!.getTime();
    expect(ms).toBeGreaterThanOrEqual(antes);
    expect(ms).toBeLessThanOrEqual(despues);
  });

  it("permite corregir una respuesta ya dada mientras la inspección siga EN_PROCESO", async () => {
    const { worker, inspection } = await crearInspeccionEnProceso();
    loginComo(worker);

    await registrarRespuestaEstadoConductor(inspection.id, "consumioAlcohol", true);
    const corregida = await registrarRespuestaEstadoConductor(inspection.id, "consumioAlcohol", false);

    expect(corregida.consumioAlcohol).toBe(false);
  });

  it("rechaza un campo que no es una pregunta de la declaración (no escribe columnas arbitrarias)", async () => {
    const { worker, inspection } = await crearInspeccionEnProceso();
    loginComo(worker);

    await expect(
      registrarRespuestaEstadoConductor(inspection.id, "puedeOperar" as never, true),
    ).rejects.toThrow(/pregunta/i);
    const sinCambios = await prisma.inspection.findUniqueOrThrow({ where: { id: inspection.id } });
    expect(sinCambios.puedeOperar).toBeNull();
  });

  it("rechaza sobre una inspección de otro trabajador", async () => {
    const { inspection } = await crearInspeccionEnProceso();
    const otro = await crearUsuario(Role.TRABAJADOR);
    loginComo(otro);

    await expect(
      registrarRespuestaEstadoConductor(inspection.id, "tomaMedicamentos", false),
    ).rejects.toThrow(/no pertenece al usuario autenticado/i);
  });

  it("rechaza sobre una inspección ya enviada", async () => {
    const { worker, inspection } = await crearInspeccionEnProceso();
    await prisma.inspection.update({
      where: { id: inspection.id },
      data: { status: InspectionStatus.PENDIENTE_APROBACION },
    });
    loginComo(worker);

    await expect(
      registrarRespuestaEstadoConductor(inspection.id, "tomaMedicamentos", false),
    ).rejects.toThrow(/ya no está en proceso/i);
  });
});

describe("cancelarInspeccion", () => {
  it("cancela una inspección propia EN_PROCESO (no la borra, pasa a CANCELADA)", async () => {
    const { worker, inspection } = await crearInspeccionEnProceso();
    loginComo(worker);

    const resultado = await cancelarInspeccion(inspection.id);

    expect(resultado.status).toBe(InspectionStatus.CANCELADA);
    const enBase = await prisma.inspection.findUniqueOrThrow({ where: { id: inspection.id } });
    expect(enBase.status).toBe(InspectionStatus.CANCELADA);
  });

  it("ya no aparece en getInspeccionesEnProcesoDelTrabajador después de cancelarla", async () => {
    const { worker, inspection } = await crearInspeccionEnProceso();
    loginComo(worker);
    await cancelarInspeccion(inspection.id);

    const { getInspeccionesEnProcesoDelTrabajador } = await import("@/lib/inspections/queries");
    const enProceso = await getInspeccionesEnProcesoDelTrabajador(worker.id);
    expect(enProceso.find((i) => i.id === inspection.id)).toBeUndefined();
  });

  it("rechaza cancelar una inspección de otro trabajador", async () => {
    const { inspection } = await crearInspeccionEnProceso();
    const otro = await crearUsuario(Role.TRABAJADOR);
    loginComo(otro);

    await expect(cancelarInspeccion(inspection.id)).rejects.toThrow(/no pertenece al usuario autenticado/i);
  });

  it("rechaza cancelar una inspección que ya no está EN_PROCESO", async () => {
    const { worker, inspection } = await crearInspeccionEnProceso();
    const item = await prisma.checklistItem.findFirstOrThrow();
    loginComo(worker);
    await responderTodoElChecklist(inspection.id, item.id);
    await registrarResultado(inspection.id, true);
    await firmarComoConductor(inspection.id, worker.id);
    await completarFotosYDeclaracion(inspection.id);
    await enviarInspeccion(inspection.id);

    await expect(cancelarInspeccion(inspection.id)).rejects.toThrow(
      /solo se puede cancelar una inspección que sigue en proceso/i,
    );
  });
});

describe("inmutabilidad: una inspección ENVIADA no puede volver a editarse con acciones del trabajador", () => {
  async function crearInspeccionEnviada() {
    const { worker, inspection } = await crearInspeccionEnProceso();
    const item = await prisma.checklistItem.findFirstOrThrow();
    loginComo(worker);
    await responderTodoElChecklist(inspection.id, item.id);
    await registrarResultado(inspection.id, true);
    await firmarComoConductor(inspection.id, worker.id);
    await completarFotosYDeclaracion(inspection.id);
    await enviarInspeccion(inspection.id);
    return { worker, inspection, item };
  }

  // Estas pruebas confirman una regla YA implementada hoy en el código
  // (`getOwnInspeccionEnProceso` en lib/inspections/actions.ts exige
  // `status === EN_PROCESO` antes de cualquier escritura del trabajador), no
  // agregan lógica nueva. Se dejan explícitas porque protegen exactamente la
  // regla de inmutabilidad del brief.
  it("responderItem rechaza sobre una inspección ya enviada", async () => {
    const { worker, inspection, item } = await crearInspeccionEnviada();
    loginComo(worker);

    await expect(
      responderItem(inspection.id, item.id, RespuestaChecklist.OK),
    ).rejects.toThrow(/ya no está en proceso/i);
  });

  it("registrarResultado rechaza sobre una inspección ya enviada", async () => {
    const { worker, inspection } = await crearInspeccionEnviada();
    loginComo(worker);

    await expect(registrarResultado(inspection.id, false, "otro motivo")).rejects.toThrow(
      /ya no está en proceso/i,
    );
  });

  it("registrarKilometraje rechaza sobre una inspección ya enviada", async () => {
    const { worker, inspection } = await crearInspeccionEnviada();
    loginComo(worker);

    await expect(
      registrarKilometraje(inspection.id, { kilometraje: 12345 }),
    ).rejects.toThrow(/ya no está en proceso/i);
  });

  it("registrarEstadoConductor rechaza sobre una inspección ya enviada", async () => {
    const { worker, inspection } = await crearInspeccionEnviada();
    loginComo(worker);

    await expect(
      registrarEstadoConductor(inspection.id, {
        tomaMedicamentos: false,
        condicionesAptas: true,
        consumioAlcohol: false,
      }),
    ).rejects.toThrow(/ya no está en proceso/i);
  });
});

// A2 del design de soporte-moto-carro: `ChecklistItem.tipoRespuesta`
// discrimina BINARIO (OK/FALLA, como siempre) de TRIESTADO (BUENO/BAJO/MALO,
// ítems de fluidos). `responderItem` valida `valor` contra ese discriminador
// vía lib/inspections/respuesta.ts.
describe("responderItem — valores según tipoRespuesta", () => {
  it("acepta BUENO/BAJO/MALO en un ítem TRIESTADO", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);
    const vehicle = await crearVehiculo();
    const { categoria } = await crearCatalogoMinimo();
    const itemFluido = await crearChecklistItem(categoria.id, {
      nombre: "Nivel de aceite",
      tipoRespuesta: TipoRespuestaItem.TRIESTADO,
    });
    const inspection = await prisma.inspection.create({
      data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
    });
    loginComo(worker);

    const { response } = await responderItem(inspection.id, itemFluido.id, RespuestaChecklist.BUENO);
    expect(response.valor).toBe(RespuestaChecklist.BUENO);
  });

  it("rechaza BUENO/BAJO/MALO en un ítem BINARIO", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);
    const vehicle = await crearVehiculo();
    const { item } = await crearCatalogoMinimo();
    const inspection = await prisma.inspection.create({
      data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
    });
    loginComo(worker);

    await expect(
      responderItem(inspection.id, item.id, RespuestaChecklist.MALO),
    ).rejects.toThrow(/no es un valor válido/i);
  });

  it("rechaza OK/FALLA en un ítem TRIESTADO", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);
    const vehicle = await crearVehiculo();
    const { categoria } = await crearCatalogoMinimo();
    const itemFluido = await crearChecklistItem(categoria.id, {
      nombre: "Nivel de aceite",
      tipoRespuesta: TipoRespuestaItem.TRIESTADO,
    });
    const inspection = await prisma.inspection.create({
      data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
    });
    loginComo(worker);

    await expect(
      responderItem(inspection.id, itemFluido.id, RespuestaChecklist.OK),
    ).rejects.toThrow(/no es un valor válido/i);
  });

  it("MALO en un ítem TRIESTADO crea una Novedad; BAJO no crea nada", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);
    const vehicle = await crearVehiculo();
    const { categoria } = await crearCatalogoMinimo();
    const itemFluido = await crearChecklistItem(categoria.id, {
      nombre: "Nivel de aceite",
      tipoRespuesta: TipoRespuestaItem.TRIESTADO,
    });
    const inspection = await prisma.inspection.create({
      data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
    });
    loginComo(worker);

    const { novedad: novedadBajo } = await responderItem(
      inspection.id,
      itemFluido.id,
      RespuestaChecklist.BAJO,
    );
    expect(novedadBajo).toBeNull();

    const { novedad: novedadMalo } = await responderItem(
      inspection.id,
      itemFluido.id,
      RespuestaChecklist.MALO,
      "Nivel muy bajo, huele a quemado",
      "FALLA",
    );
    expect(novedadMalo).not.toBeNull();
    const enBase = await prisma.novedad.findFirst({
      where: { inspectionItemResponse: { checklistItemId: itemFluido.id, inspectionId: inspection.id } },
    });
    expect(enBase).not.toBeNull();
  });

  it("BAJO no requiere observación ni tipo de novedad", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);
    const vehicle = await crearVehiculo();
    const { categoria } = await crearCatalogoMinimo();
    const itemFluido = await crearChecklistItem(categoria.id, {
      nombre: "Nivel refrigerante",
      tipoRespuesta: TipoRespuestaItem.TRIESTADO,
    });
    const inspection = await prisma.inspection.create({
      data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
    });
    loginComo(worker);

    await expect(
      responderItem(inspection.id, itemFluido.id, RespuestaChecklist.BAJO),
    ).resolves.not.toThrow();
  });
});

// Modelo 1:1 (decisión del usuario, 2026-09-18): cada trabajador tiene UN
// vehículo (`User.vehicleId`). `iniciarInspeccion` re-valida en el servidor
// (defensa en profundidad: no confía en que la pantalla ya haya mostrado solo
// su vehículo) que el vehículo pedido sea el suyo; el tipo sigue validándose
// además (A1 del design) por si los datos quedaran inconsistentes.
describe("iniciarInspeccion — el vehículo debe ser el asignado al trabajador", () => {
  it("acepta el vehículo asignado", async () => {
    const vehicle = await crearVehiculo({ tipoVehiculo: TipoVehiculo.CARRO });
    const worker = await crearUsuario(Role.TRABAJADOR, {
      tipoVehiculo: TipoVehiculo.CARRO,
      vehicleId: vehicle.id,
    });
    loginComo(worker);

    const inspection = await iniciarInspeccion(vehicle.id);
    expect(inspection.vehicleId).toBe(vehicle.id);
  });

  it("rechaza iniciar una inspección sobre OTRO vehículo (aunque sea del mismo tipo)", async () => {
    const asignado = await crearVehiculo({ tipoVehiculo: TipoVehiculo.MOTO });
    const ajeno = await crearVehiculo({ tipoVehiculo: TipoVehiculo.MOTO });
    const worker = await crearUsuario(Role.TRABAJADOR, {
      tipoVehiculo: TipoVehiculo.MOTO,
      vehicleId: asignado.id,
    });
    loginComo(worker);

    await expect(iniciarInspeccion(ajeno.id)).rejects.toThrow(/vehículo asignado/i);
    expect(await prisma.inspection.count({ where: { workerId: worker.id } })).toBe(0);
  });

  it("rechaza a un trabajador legacy sin vehículo con un mensaje de asignación pendiente", async () => {
    const vehicle = await crearVehiculo({ tipoVehiculo: TipoVehiculo.MOTO });
    const worker = await crearUsuario(Role.TRABAJADOR, { tipoVehiculo: TipoVehiculo.MOTO });
    loginComo(worker);

    await expect(iniciarInspeccion(vehicle.id)).rejects.toThrow(/pendiente de asignación/i);
    expect(await prisma.inspection.count({ where: { workerId: worker.id } })).toBe(0);
  });

  it("rechaza si su vehículo asignado está inactivo", async () => {
    const vehicle = await crearVehiculo({ tipoVehiculo: TipoVehiculo.MOTO, activo: false });
    const worker = await crearUsuario(Role.TRABAJADOR, {
      tipoVehiculo: TipoVehiculo.MOTO,
      vehicleId: vehicle.id,
    });
    loginComo(worker);

    await expect(iniciarInspeccion(vehicle.id)).rejects.toThrow(/inactivo/i);
  });

  it("rechaza si el tipo del trabajador (MOTO) no coincide con el de su vehículo (CARRO)", async () => {
    const vehicle = await crearVehiculo({ tipoVehiculo: TipoVehiculo.CARRO });
    const worker = await crearUsuario(Role.TRABAJADOR, {
      tipoVehiculo: TipoVehiculo.MOTO,
      vehicleId: vehicle.id,
    });
    loginComo(worker);

    await expect(iniciarInspeccion(vehicle.id)).rejects.toThrow(/no corresponde/i);
  });

  // Corrección Slice 2 (hallazgo WARNING #6): la misma guarda es simétrica.
  it("rechaza si el tipo del trabajador (CARRO) no coincide con el de su vehículo (MOTO)", async () => {
    const vehicle = await crearVehiculo({ tipoVehiculo: TipoVehiculo.MOTO });
    const worker = await crearUsuario(Role.TRABAJADOR, {
      tipoVehiculo: TipoVehiculo.CARRO,
      vehicleId: vehicle.id,
    });
    loginComo(worker);

    await expect(iniciarInspeccion(vehicle.id)).rejects.toThrow(/no corresponde/i);
  });

  it("rechaza si el trabajador no tiene tipo asignado (null), aunque tenga vehículo", async () => {
    const vehicle = await crearVehiculo({ tipoVehiculo: TipoVehiculo.MOTO });
    const worker = await crearUsuario(Role.TRABAJADOR, { tipoVehiculo: null, vehicleId: vehicle.id });
    loginComo(worker);

    await expect(iniciarInspeccion(vehicle.id)).rejects.toThrow(/no corresponde/i);
  });
});

// Corrección Slice 2 (hallazgo CRITICAL #1, corroborado por 3 lentes): la
// completitud del checklist en `enviarInspeccion` era un conteo pelado, no
// una comparación de conjuntos — un ítem de OTRO tipo de vehículo "colado"
// vía `responderItem` podía inflar el conteo y tapar que faltaba un ítem
// real. `responderItem` ahora valida que el ítem pertenezca al catálogo del
// tipo de vehículo de la inspección, y `enviarInspeccion` compara por
// diferencia de conjuntos de IDs en vez de por cantidad.
describe("responderItem — el ítem debe pertenecer al catálogo del tipo de vehículo de la inspección", () => {
  it("rechaza un checklistItemId de un ítem exclusivo de otro tipo de vehículo", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR, { tipoVehiculo: TipoVehiculo.MOTO });
    const vehicle = await crearVehiculo({ tipoVehiculo: TipoVehiculo.MOTO });
    const { categoria } = await crearCatalogoMinimo();
    const itemDeCarro = await crearChecklistItem(categoria.id, {
      nombre: "Cinturones de seguridad",
      tipoVehiculo: TipoVehiculo.CARRO,
    });
    const inspection = await prisma.inspection.create({
      data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
    });
    loginComo(worker);

    await expect(
      responderItem(inspection.id, itemDeCarro.id, RespuestaChecklist.OK),
    ).rejects.toThrow(/no corresponde al tipo de vehículo/i);
  });

  it("acepta un ítem compartido (tipoVehiculo null) o del mismo tipo que el vehículo", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR, { tipoVehiculo: TipoVehiculo.MOTO });
    const vehicle = await crearVehiculo({ tipoVehiculo: TipoVehiculo.MOTO });
    const { item: itemCompartido } = await crearCatalogoMinimo();
    const inspection = await prisma.inspection.create({
      data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
    });
    loginComo(worker);

    await expect(
      responderItem(inspection.id, itemCompartido.id, RespuestaChecklist.OK),
    ).resolves.not.toThrow();
  });
});

describe("enviarInspeccion — completitud por diferencia de conjuntos, no por conteo pelado", () => {
  it("rechaza el envío si falta un ítem real del tipo de vehículo aunque el conteo total coincida (ítem ajeno colado)", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR, { tipoVehiculo: TipoVehiculo.MOTO });
    const vehicle = await crearVehiculo({ tipoVehiculo: TipoVehiculo.MOTO });
    const { categoria } = await crearCatalogoMinimo();
    // Ítem real, obligatorio para MOTO — a propósito NO se responde.
    const itemMoto = await crearChecklistItem(categoria.id, {
      nombre: "Casco",
      orden: 2,
      tipoVehiculo: TipoVehiculo.MOTO,
    });
    // Ítem exclusivo de CARRO: no pertenece al catálogo MOTO de esta
    // inspección, pero se "cuela" con una respuesta directa en base (simula
    // el bypass de `responderItem` que exponía el hallazgo original).
    const itemCarro = await crearChecklistItem(categoria.id, {
      nombre: "Cinturones de seguridad",
      orden: 3,
      tipoVehiculo: TipoVehiculo.CARRO,
    });

    const inspection = await prisma.inspection.create({
      data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
    });
    loginComo(worker);

    // Responde TODOS los ítems reales del catálogo MOTO salvo "Casco"
    // (incluye el ítem del catálogo mínimo global del beforeEach) — así el
    // conteo total de respuestas queda exactamente en `totalItems - 1`...
    const catalogoMoto = await getChecklistCatalog(TipoVehiculo.MOTO);
    const idsRequeridos = catalogoMoto.flatMap((c) => c.items.map((i) => i.id));
    expect(idsRequeridos).toContain(itemMoto.id);
    expect(idsRequeridos).not.toContain(itemCarro.id);
    for (const id of idsRequeridos) {
      if (id === itemMoto.id) continue;
      await prisma.inspectionItemResponse.create({
        data: { inspectionId: inspection.id, checklistItemId: id, valor: RespuestaChecklist.OK },
      });
    }
    // ...y agrega la respuesta "colada" de un ítem de CARRO para volver a
    // igualar el conteo total (`totalItems`) sin haber respondido "Casco" en
    // realidad — exactamente el escenario que el conteo pelado antiguo no
    // podía distinguir de un envío legítimo.
    await prisma.inspectionItemResponse.create({
      data: { inspectionId: inspection.id, checklistItemId: itemCarro.id, valor: RespuestaChecklist.OK },
    });

    await registrarResultado(inspection.id, true);
    await firmarComoConductor(inspection.id, worker.id);

    await expect(enviarInspeccion(inspection.id)).rejects.toThrow(/faltan ítems del checklist/i);
  });
});
