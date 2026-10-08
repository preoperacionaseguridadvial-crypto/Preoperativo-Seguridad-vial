import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { InspectionStatus, Role, Sede } from "@/generated/prisma/client";
import { getDatosInicioTrabajador } from "@/lib/inicio/trabajador-queries";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

describe("getDatosInicioTrabajador", () => {
  beforeEach(async () => {
    await limpiarBaseDeTest();
  });

  it("trabajador sin vehículo ni inspecciones: todo vacío", async () => {
    const worker = await crearUsuario(Role.TRABAJADOR);

    const datos = await getDatosInicioTrabajador(worker.id);

    expect(datos.vehiculo).toBeNull();
    expect(datos.inspecciones).toEqual([]);
    expect(datos.fotoVehiculoUrl).toBeNull();
  });

  it("devuelve la sede del trabajador (null si es legacy sin sede)", async () => {
    const oleariari = await crearUsuario(Role.TRABAJADOR, { sede: Sede.OLEARIARI });
    const legacy = await crearUsuario(Role.TRABAJADOR);

    expect((await getDatosInicioTrabajador(oleariari.id)).sede).toBe(Sede.OLEARIARI);
    expect((await getDatosInicioTrabajador(legacy.id)).sede).toBeNull();
  });

  it("trae su vehículo y sus últimas 3 inspecciones no canceladas, la más reciente primero", async () => {
    const vehicle = await crearVehiculo();
    const worker = await crearUsuario(Role.TRABAJADOR, { vehicleId: vehicle.id });
    const base = Date.now();
    const crear = (status: InspectionStatus, minutosAtras: number) =>
      prisma.inspection.create({
        data: {
          workerId: worker.id,
          conductorId: worker.id,
          vehicleId: vehicle.id,
          status,
          startedAt: new Date(base - minutosAtras * 60_000),
        },
      });
    await crear(InspectionStatus.APROBADA, 400);
    await crear(InspectionStatus.RECHAZADA, 300);
    await crear(InspectionStatus.CANCELADA, 50);
    const reciente = await crear(InspectionStatus.PENDIENTE_APROBACION, 10);
    await crear(InspectionStatus.APROBADA, 200);

    const datos = await getDatosInicioTrabajador(worker.id);

    expect(datos.vehiculo?.placa).toBe(vehicle.placa);
    expect(datos.inspecciones).toHaveLength(3);
    expect(datos.inspecciones[0].id).toBe(reciente.id);
    expect(datos.inspecciones.map((i) => i.status)).toEqual([
      InspectionStatus.PENDIENTE_APROBACION,
      InspectionStatus.APROBADA,
      InspectionStatus.RECHAZADA,
    ]);
  });

  it("expone la sede y la primera etapa de cada inspección, y la observación del Supervisor Oleariari si la rechazó", async () => {
    const vehicle = await crearVehiculo();
    const worker = await crearUsuario(Role.TRABAJADOR, { vehicleId: vehicle.id, sede: Sede.OLEARIARI });
    const ahora = new Date();
    await prisma.inspection.create({
      data: {
        workerId: worker.id,
        conductorId: worker.id,
        vehicleId: vehicle.id,
        status: InspectionStatus.RECHAZADA,
        sede: Sede.OLEARIARI,
        reviewedAt: ahora,
        revisadaSupervisorOleariariAt: ahora,
        observacionesSupervisorOleariari: "Falta el casco",
      },
    });

    const [inspeccion] = (await getDatosInicioTrabajador(worker.id)).inspecciones;

    expect(inspeccion.sede).toBe(Sede.OLEARIARI);
    expect(inspeccion.revisadaSupervisorOleariariAt).toEqual(ahora);
    expect(inspeccion.observacionesSupervisor).toBe("Falta el casco");
  });

  it("no mezcla inspecciones de otros trabajadores", async () => {
    const vehicle = await crearVehiculo();
    const worker = await crearUsuario(Role.TRABAJADOR, { vehicleId: vehicle.id });
    const otroVehiculo = await crearVehiculo();
    const otro = await crearUsuario(Role.TRABAJADOR, { vehicleId: otroVehiculo.id });
    await prisma.inspection.create({
      data: { workerId: otro.id, conductorId: otro.id, vehicleId: otroVehiculo.id },
    });

    const datos = await getDatosInicioTrabajador(worker.id);

    expect(datos.inspecciones).toEqual([]);
  });

  it("firma la foto de la hoja de vida del vehículo cuando existe", async () => {
    const vehicle = await crearVehiculo();
    await prisma.vehicle.update({ where: { id: vehicle.id }, data: { fotoS3Key: "vehiculos/x.jpg" } });
    const worker = await crearUsuario(Role.TRABAJADOR, { vehicleId: vehicle.id });

    const datos = await getDatosInicioTrabajador(worker.id);

    expect(datos.fotoVehiculoUrl).toContain("vehiculos/x.jpg");
  });
});
