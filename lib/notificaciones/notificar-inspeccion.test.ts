import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockEnviar = vi.fn();
const mockConfigurado = vi.fn();
vi.mock("@/lib/notificaciones/push", () => ({
  enviarAUsuarios: (...args: unknown[]) => mockEnviar(...args),
  pushConfigurado: () => mockConfigurado(),
}));

const mockAfter = vi.fn();
vi.mock("next/server", () => ({
  after: (fn: unknown) => mockAfter(fn),
}));

import { prisma } from "@/lib/prisma";
import { InspectionStatus, Role, Sede } from "@/generated/prisma/client";
import {
  enviarNotificacionInspeccion,
  notificarInspeccion,
  resolverDestinatarios,
} from "@/lib/notificaciones/notificar-inspeccion";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

async function crearInspeccion(sede: Sede | null, overrides: { workerSede?: Sede | null } = {}) {
  const worker = await crearUsuario(Role.TRABAJADOR, { name: "Juan Pérez", sede: overrides.workerSede ?? sede });
  const vehicle = await crearVehiculo({ placa: "ABC123" });
  const inspection = await prisma.inspection.create({
    data: {
      workerId: worker.id,
      conductorId: worker.id,
      vehicleId: vehicle.id,
      status: InspectionStatus.PENDIENTE_APROBACION,
      completedAt: new Date(),
      puedeOperar: true,
      sede,
    },
  });
  return { worker, inspection };
}

type Envio = [string[], { titulo: string; url: string }];
const envios = () => mockEnviar.mock.calls as Envio[];
const idsEnviados = () => envios().flatMap(([ids]) => ids).sort();

describe("notificaciones de inspección", () => {
  beforeEach(async () => {
    await limpiarBaseDeTest();
    mockEnviar.mockReset();
    mockEnviar.mockResolvedValue(undefined);
    mockConfigurado.mockReset();
    mockConfigurado.mockReturnValue(true);
    mockAfter.mockReset();
  });

  afterAll(async () => {
    await limpiarBaseDeTest();
    await prisma.$disconnect();
  });

  describe("resolverDestinatarios", () => {
    it("ENVIADA Bogotá o legacy: todos los SUPERVISOR activos y todos los SST; no los de Oleariari", async () => {
      const sup1 = await crearUsuario(Role.SUPERVISOR);
      const sup2 = await crearUsuario(Role.SUPERVISOR);
      const supInactivo = await crearUsuario(Role.SUPERVISOR);
      await prisma.user.update({ where: { id: supInactivo.id }, data: { activo: false } });
      const supOle = await crearUsuario(Role.SUPERVISOR_OLEARIARI);
      const sst = await crearUsuario(Role.SST);
      await crearUsuario(Role.ADMINISTRADOR);
      const { worker } = await crearInspeccion(null);

      const grupos = await resolverDestinatarios("ENVIADA", { sede: null, workerId: worker.id }, worker.id);

      const porAudiencia = Object.fromEntries(grupos.map((g) => [g.audiencia, g.userIds.sort()]));
      expect(porAudiencia).toEqual({
        APROBADOR: [sup1.id, sup2.id].sort(),
        SST: [sst.id],
      });
      expect(JSON.stringify(grupos)).not.toContain(supOle.id);
      expect(JSON.stringify(grupos)).not.toContain(supInactivo.id);
    });

    it("ENVIADA Oleariari: los SUPERVISOR_OLEARIARI (no el Director) y SST", async () => {
      const supOle = await crearUsuario(Role.SUPERVISOR_OLEARIARI);
      const director = await crearUsuario(Role.SUPERVISOR);
      const sst = await crearUsuario(Role.SST);
      const { worker } = await crearInspeccion(Sede.OLEARIARI);

      const grupos = await resolverDestinatarios("ENVIADA", { sede: Sede.OLEARIARI, workerId: worker.id }, worker.id);

      expect(grupos.find((g) => g.audiencia === "APROBADOR")?.userIds).toEqual([supOle.id]);
      expect(grupos.find((g) => g.audiencia === "SST")?.userIds).toEqual([sst.id]);
      expect(JSON.stringify(grupos)).not.toContain(director.id);
    });

    it("APROBADA: el trabajador y SST; no se notifica al actor aunque sea SST", async () => {
      const sst1 = await crearUsuario(Role.SST);
      const sst2 = await crearUsuario(Role.SST);
      const { worker } = await crearInspeccion(Sede.BOGOTA);

      const grupos = await resolverDestinatarios("APROBADA", { sede: Sede.BOGOTA, workerId: worker.id }, sst1.id);

      expect(grupos.find((g) => g.audiencia === "TRABAJADOR")?.userIds).toEqual([worker.id]);
      expect(grupos.find((g) => g.audiencia === "SST")?.userIds).toEqual([sst2.id]);
    });

    it("sin destinatarios en un grupo: el grupo se omite", async () => {
      const { worker } = await crearInspeccion(Sede.BOGOTA);
      const grupos = await resolverDestinatarios("ENVIADA", { sede: Sede.BOGOTA, workerId: worker.id }, worker.id);
      expect(grupos).toEqual([]);
    });
  });

  describe("enviarNotificacionInspeccion", () => {
    it("ENVIADA: manda un push a los aprobadores (detalle de aprobación) y otro a SST (consulta)", async () => {
      const sup = await crearUsuario(Role.SUPERVISOR);
      const sst = await crearUsuario(Role.SST);
      const { worker, inspection } = await crearInspeccion(Sede.BOGOTA);

      await enviarNotificacionInspeccion("ENVIADA", inspection.id, worker.id);

      expect(mockEnviar).toHaveBeenCalledTimes(2);
      const aprobadores = envios().find(([ids]) => ids.includes(sup.id))!;
      const sstEnvio = envios().find(([ids]) => ids.includes(sst.id))!;
      expect(aprobadores[1].url).toBe(`/aprobaciones/${inspection.id}`);
      expect(sstEnvio[1].url).toBe(`/consulta-inspecciones/${inspection.id}`);
    });

    it("el cuerpo lleva la placa y el nombre del trabajador", async () => {
      await crearUsuario(Role.SUPERVISOR);
      const { worker, inspection } = await crearInspeccion(null);

      await enviarNotificacionInspeccion("ENVIADA", inspection.id, worker.id);

      const payload = mockEnviar.mock.calls[0][1] as { cuerpo: string };
      expect(payload.cuerpo).toContain("ABC123");
      expect(payload.cuerpo).toContain("Juan Pérez");
    });

    it("RECHAZADA con extras: avisa al trabajador con quién y motivo", async () => {
      const { worker, inspection } = await crearInspeccion(Sede.BOGOTA);
      const director = await crearUsuario(Role.SUPERVISOR);

      await enviarNotificacionInspeccion("RECHAZADA", inspection.id, director.id, {
        decididoPor: "Director de Operaciones",
        observacion: "Llantas lisas",
      });

      expect(mockEnviar).toHaveBeenCalledTimes(1);
      const [ids, payload] = mockEnviar.mock.calls[0] as [string[], { url: string; cuerpo: string }];
      expect(ids).toEqual([worker.id]);
      expect(payload.url).toBe(`/inspecciones/${inspection.id}/enviada`);
      expect(payload.cuerpo).toContain("Llantas lisas");
    });

    it("usa la sede de la INSPECCIÓN, no la actual del trabajador", async () => {
      const supOle = await crearUsuario(Role.SUPERVISOR_OLEARIARI);
      const director = await crearUsuario(Role.SUPERVISOR);
      const { worker, inspection } = await crearInspeccion(Sede.OLEARIARI, { workerSede: Sede.BOGOTA });

      await enviarNotificacionInspeccion("ENVIADA", inspection.id, worker.id);

      expect(idsEnviados()).toContain(supOle.id);
      expect(idsEnviados()).not.toContain(director.id);
    });

    it("push no configurado: ni consulta ni envía, pero lo deja en el log", async () => {
      mockConfigurado.mockReturnValue(false);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const spy = vi.spyOn(prisma.inspection, "findUnique");
      await enviarNotificacionInspeccion("ENVIADA", "x", "y");
      expect(spy).not.toHaveBeenCalled();
      expect(mockEnviar).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("[push] ENVIADA x: faltan variables VAPID"));
      spy.mockRestore();
    });

    it("deja en el log el evento y cuántos destinatarios tiene cada grupo", async () => {
      const info = vi.spyOn(console, "info").mockImplementation(() => {});
      await crearUsuario(Role.SUPERVISOR);
      const { worker, inspection } = await crearInspeccion(Sede.BOGOTA);

      await enviarNotificacionInspeccion("ENVIADA", inspection.id, worker.id);

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining(`[push] ENVIADA ${inspection.id}: APROBADOR=1`),
      );
    });

    it("inspección inexistente: no lanza ni envía", async () => {
      await expect(enviarNotificacionInspeccion("ENVIADA", "no-existe", "y")).resolves.toBeUndefined();
      expect(mockEnviar).not.toHaveBeenCalled();
    });

    it("si todo falla por dentro, no lanza", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const spy = vi.spyOn(prisma.inspection, "findUnique").mockRejectedValue(new Error("db"));
      await expect(enviarNotificacionInspeccion("ENVIADA", "x", "y")).resolves.toBeUndefined();
      expect(error).toHaveBeenCalled();
      spy.mockRestore();
      error.mockRestore();
    });
  });

  describe("notificarInspeccion (programación)", () => {
    it("lo programa con after() sin ejecutarlo en línea", async () => {
      await crearUsuario(Role.SUPERVISOR);
      const { worker, inspection } = await crearInspeccion(null);

      notificarInspeccion("ENVIADA", inspection.id, worker.id);

      expect(mockAfter).toHaveBeenCalledTimes(1);
      expect(mockEnviar).not.toHaveBeenCalled();
      await (mockAfter.mock.calls[0][0] as () => Promise<void>)();
      expect(mockEnviar).toHaveBeenCalled();
    });

    it("si after() no está disponible (fuera de una request), lo ejecuta igual sin lanzar", async () => {
      mockAfter.mockImplementation(() => {
        throw new Error("after was called outside a request scope");
      });
      await crearUsuario(Role.SUPERVISOR);
      const { worker, inspection } = await crearInspeccion(null);

      expect(() => notificarInspeccion("ENVIADA", inspection.id, worker.id)).not.toThrow();

      await vi.waitFor(() => expect(mockEnviar).toHaveBeenCalled());
    });
  });
});
