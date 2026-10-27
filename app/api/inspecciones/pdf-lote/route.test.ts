import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { unzipSync } from "fflate";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: () => mockAuth(),
}));

import { prisma } from "@/lib/prisma";
import { Role, InspectionStatus } from "@/generated/prisma/client";
import { GET } from "@/app/api/inspecciones/pdf-lote/route";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

function loginComo(user: { id: string; role: Role }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, role: user.role } });
}

function request(query = "") {
  return GET(new Request(`http://localhost/api/inspecciones/pdf-lote${query}`));
}

async function crearInspeccion(status: InspectionStatus, placa?: string) {
  const worker = await crearUsuario(Role.TRABAJADOR);
  const vehicle = await crearVehiculo(placa ? { placa } : undefined);
  return prisma.inspection.create({
    data: {
      workerId: worker.id,
      conductorId: worker.id,
      vehicleId: vehicle.id,
      status,
      completedAt: new Date(),
      puedeOperar: true,
    },
  });
}

describe("GET /api/inspecciones/pdf-lote", () => {
  beforeEach(async () => {
    await limpiarBaseDeTest();
    mockAuth.mockReset();
  });

  afterAll(async () => {
    await limpiarBaseDeTest();
    await prisma.$disconnect();
  });

  it("sin sesión: 401", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await request()).status).toBe(401);
  });

  it("no SST: 404", async () => {
    loginComo(await crearUsuario(Role.DIRECTOR));
    expect((await request()).status).toBe(404);
  });

  it("SST sin inspecciones descargables: 404 con mensaje", async () => {
    await crearInspeccion(InspectionStatus.EN_PROCESO);
    await crearInspeccion(InspectionStatus.CANCELADA);
    loginComo(await crearUsuario(Role.SST));
    const res = await request();
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/No hay inspecciones/);
  });

  it("ADMINISTRADOR (con permisos de SST): 200 application/zip", async () => {
    await crearInspeccion(InspectionStatus.APROBADA);
    loginComo(await crearUsuario(Role.ADMINISTRADOR));

    const res = await request("?fechaDesde=2000-01-01");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
  }, 60_000);

  it("SST: 200 application/zip con un PDF por inspección descargable", async () => {
    const a = await crearInspeccion(InspectionStatus.APROBADA);
    const b = await crearInspeccion(InspectionStatus.PENDIENTE_APROBACION);
    await crearInspeccion(InspectionStatus.EN_PROCESO);
    await crearInspeccion(InspectionStatus.CANCELADA);
    loginComo(await crearUsuario(Role.SST));

    const res = await request("?fechaDesde=2000-01-01");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment; filename="inspecciones_desde_2000-01-01\.zip"/);

    const entradas = unzipSync(new Uint8Array(await res.arrayBuffer()));
    const nombres = Object.keys(entradas);
    expect(nombres).toHaveLength(2);
    expect(nombres.some((n) => n.includes(a.id))).toBe(true);
    expect(nombres.some((n) => n.includes(b.id))).toBe(true);
    for (const n of nombres) {
      expect(Buffer.from(entradas[n]).subarray(0, 5).toString("ascii")).toBe("%PDF-");
    }
  }, 60_000);
});
