import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mismo patrón que lib/inspections/actions.test.ts: mockeamos la sesión de
// NextAuth (no la base de datos) porque `auth()` normalmente lee una cookie
// firmada — lo único que este handler necesita es `{ user: { id, role } }`.
const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: () => mockAuth(),
}));

import { prisma } from "@/lib/prisma";
import { Role, InspectionStatus } from "@/generated/prisma/client";
import { GET } from "@/app/api/inspecciones/[id]/pdf/route";
import { crearUsuario, crearVehiculo, limpiarBaseDeTest } from "@/test/helpers/db";

function loginComo(user: { id: string; role: Role }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, role: user.role } });
}

function request(id: string) {
  return GET(new Request(`http://localhost/api/inspecciones/${id}/pdf`), {
    params: Promise.resolve({ id }),
  });
}

// Único caso que efectivamente llega a renderizar el PDF (SST): el resto de
// los roles queda bloqueado por el chequeo de rol antes de tocar la base, así
// que no necesitan una inspección real (alcanza con un id inexistente).
async function crearInspeccionAprobada() {
  const worker = await crearUsuario(Role.TRABAJADOR);
  const vehicle = await crearVehiculo();
  return prisma.inspection.create({
    data: {
      workerId: worker.id,
      conductorId: worker.id,
      vehicleId: vehicle.id,
      status: InspectionStatus.APROBADA,
      completedAt: new Date(),
      reviewedAt: new Date(),
      puedeOperar: true,
    },
  });
}

describe("GET /api/inspecciones/[id]/pdf — solo SST puede descargar", () => {
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
    const res = await request(randomUUID());
    expect(res.status).toBe(401);
  });

  it("TRABAJADOR, incluso dueño de la inspección: 404", async () => {
    const inspection = await crearInspeccionAprobada();
    loginComo({ id: inspection.workerId, role: Role.TRABAJADOR });
    const res = await request(inspection.id);
    expect(res.status).toBe(404);
  });

  it("SUPERVISOR: 404", async () => {
    const supervisor = await crearUsuario(Role.SUPERVISOR);
    loginComo(supervisor);
    const res = await request(randomUUID());
    expect(res.status).toBe(404);
  });

  it("DIRECTOR: 404", async () => {
    const director = await crearUsuario(Role.DIRECTOR);
    loginComo(director);
    const res = await request(randomUUID());
    expect(res.status).toBe(404);
  });

  it("SST: 200, PDF real", async () => {
    const inspection = await crearInspeccionAprobada();
    const sst = await crearUsuario(Role.SST);
    loginComo(sst);
    const res = await request(inspection.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const buffer = Buffer.from(await res.arrayBuffer());
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
