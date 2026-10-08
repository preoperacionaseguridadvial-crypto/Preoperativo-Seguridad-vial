import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { InspectionStatus, Role, Sede, TipoFirma, TipoFotoInspeccion } from "@/generated/prisma/client";
import {
  getAllInspeccionesForOversight,
  getInspeccionesPendientes,
  getInspectionForSupervisor,
} from "@/lib/inspections/supervisor-queries";
import * as s3 from "@/lib/storage/s3";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

// Fase soporte-moto-carro, Slice 5 (A7): `getInspectionForSupervisor` (usada
// tanto por el Supervisor como por `getInspeccionParaPdf`) todavía no traía
// las fotos diarias (LATERAL/PLACA, modelo `FotoInspeccion`) — el PDF no
// tiene forma de dibujarlas. Mismo criterio que `getFirmasInspeccion`: la
// URL de lectura se firma on-demand, nunca se persiste.
describe("getInspectionForSupervisor — fotos diarias", () => {
  beforeEach(async () => {
    await limpiarBaseDeTest();
  });

  async function crearInspeccionConFotos(tipos: TipoFotoInspeccion[]) {
    const worker = await crearUsuario(Role.TRABAJADOR);
    const vehicle = await crearVehiculo();
    const inspection = await prisma.inspection.create({
      data: { workerId: worker.id, conductorId: worker.id, vehicleId: vehicle.id },
    });
    for (const tipo of tipos) {
      await prisma.fotoInspeccion.create({
        data: { inspectionId: inspection.id, tipo, s3Key: `fotos-inspeccion/${inspection.id}/${tipo}.jpg` },
      });
    }
    return inspection;
  }

  it("trae ambas fotos diarias con una URL de lectura firmada no vacía", async () => {
    const inspection = await crearInspeccionConFotos([TipoFotoInspeccion.LATERAL, TipoFotoInspeccion.PLACA]);

    const resultado = await getInspectionForSupervisor(inspection.id);

    expect(resultado?.fotos).toHaveLength(2);
    const lateral = resultado?.fotos.find((f) => f.tipo === TipoFotoInspeccion.LATERAL);
    const placa = resultado?.fotos.find((f) => f.tipo === TipoFotoInspeccion.PLACA);
    expect(lateral?.url).toBeTruthy();
    expect(placa?.url).toBeTruthy();
    expect(typeof lateral?.url).toBe("string");
  });

  it("una inspección sin fotos todavía devuelve el arreglo vacío, no undefined ni un error", async () => {
    const inspection = await crearInspeccionConFotos([]);

    const resultado = await getInspectionForSupervisor(inspection.id);

    expect(resultado?.fotos).toEqual([]);
  });

  // Corrección Slice 5 (hallazgo WARNING resilience): antes de este fix, el
  // mapeo de URL firmada de las fotos diarias no tenía try/catch — a
  // diferencia de las fotos de Novedad (solo disparan si hay una novedad),
  // las fotos diarias son obligatorias en casi toda inspección, así que
  // cualquier falla de `getSignedReadUrl` (ej. `S3_BUCKET` mal configurado)
  // tumbaba toda la consulta (y con ella, todo el PDF). Mismo criterio que
  // `resolverFechaVigencia` (lib/inspections/pdf-queries.ts, corrección
  // Slice 4): se degrada foto por foto (sin `url`) en vez de propagar el
  // error, probado acá espiando `getSignedReadUrl` con `vi.spyOn` (mismo
  // patrón que `lib/inspections/pdf-queries.test.ts` para `getSetting`).
  describe("degradación ante fallo de firma de URL", () => {
    it("si getSignedReadUrl falla para una foto diaria, esa foto se devuelve sin url (no se tumba toda la consulta)", async () => {
      const inspection = await crearInspeccionConFotos([TipoFotoInspeccion.LATERAL, TipoFotoInspeccion.PLACA]);
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const getSignedReadUrlSpy = vi
        .spyOn(s3, "getSignedReadUrl")
        .mockRejectedValueOnce(new Error("Fallo simulado de S3"));

      const resultado = await getInspectionForSupervisor(inspection.id);

      expect(resultado?.fotos).toHaveLength(2);
      const fotoConFalla = resultado?.fotos.find((f) => !f.url);
      const fotoOk = resultado?.fotos.find((f) => f.url);
      expect(fotoConFalla).toBeDefined();
      expect(fotoOk?.url).toBeTruthy();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      getSignedReadUrlSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});

// Flujo de dos etapas (roles-oleariari): cada aprobador ve solo su cola, y el
// Supervisor Oleariari solo consulta su propia sede.
describe("colas por rol y consulta por sede", () => {
  beforeEach(async () => {
    await limpiarBaseDeTest();
  });

  async function crear(sede: Sede | null, extra: { revisada?: boolean } = {}) {
    const worker = await crearUsuario(Role.TRABAJADOR);
    const vehicle = await crearVehiculo();
    const inspection = await prisma.inspection.create({
      data: {
        workerId: worker.id,
        conductorId: worker.id,
        vehicleId: vehicle.id,
        status: InspectionStatus.PENDIENTE_APROBACION,
        completedAt: new Date(),
        sede,
        revisadaSupervisorOleariariAt: extra.revisada ? new Date() : null,
      },
    });
    // La cola del Director exige ademas la firma del Supervisor Oleariari.
    if (extra.revisada) {
      const supOleariari = await crearUsuario(Role.SUPERVISOR_OLEARIARI);
      await prisma.firma.create({
        data: {
          inspectionId: inspection.id,
          userId: supOleariari.id,
          tipo: TipoFirma.SUPERVISOR_OLEARIARI,
          s3Key: "firmas/test-so.png",
        },
      });
    }
    return inspection;
  }

  it("getInspeccionesPendientes(rol) devuelve la cola de cada aprobador", async () => {
    const bogota = await crear(Sede.BOGOTA);
    const oleariari1 = await crear(Sede.OLEARIARI);
    const oleariari2 = await crear(Sede.OLEARIARI, { revisada: true });

    const colaOleariari = await getInspeccionesPendientes(Role.SUPERVISOR_OLEARIARI);
    const colaDirector = await getInspeccionesPendientes(Role.SUPERVISOR);

    expect(colaOleariari.map((i) => i.id)).toEqual([oleariari1.id]);
    expect(colaDirector.map((i) => i.id).sort()).toEqual([bogota.id, oleariari2.id].sort());
  });

  it("getAllInspeccionesForOversight filtra por sede cuando se pide", async () => {
    const bogota = await crear(Sede.BOGOTA);
    const oleariari = await crear(Sede.OLEARIARI);

    const soloOleariari = await getAllInspeccionesForOversight({ sede: Sede.OLEARIARI });
    const todas = await getAllInspeccionesForOversight();

    expect(soloOleariari.map((i) => i.id)).toEqual([oleariari.id]);
    expect(todas.map((i) => i.id).sort()).toEqual([bogota.id, oleariari.id].sort());
  });

  // fechaDesde/fechaHasta llegan como día calendario (medianoche UTC) y se
  // interpretan como días de Bogotá; `rangoInstantes` (rango ya calculado) manda.
  it("getAllInspeccionesForOversight filtra por días de Bogotá", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);
    const vehicle = await crearVehiculo();
    const en = (startedAt: string) =>
      prisma.inspection.create({
        data: {
          workerId: worker.id,
          conductorId: worker.id,
          vehicleId: vehicle.id,
          status: InspectionStatus.APROBADA,
          startedAt: new Date(startedAt),
        },
      });
    const nocheDel7 = await en("2026-10-08T00:30:00Z"); // 7 oct 19:30 Bogotá
    const madrugadaDel8 = await en("2026-10-08T05:30:00Z"); // 8 oct 00:30 Bogotá
    await en("2026-10-07T04:00:00Z"); // 6 oct 23:00 Bogotá

    const dia7 = await getAllInspeccionesForOversight({
      fechaDesde: new Date("2026-10-07T00:00:00Z"),
      fechaHasta: new Date("2026-10-07T00:00:00Z"),
    });
    expect(dia7.map((i) => i.id)).toEqual([nocheDel7.id]);

    const porInstantes = await getAllInspeccionesForOversight({
      rangoInstantes: { desde: new Date("2026-10-08T05:00:00Z"), hasta: new Date("2026-10-08T06:00:00Z") },
    });
    expect(porInstantes.map((i) => i.id)).toEqual([madrugadaDel8.id]);
  });
});
