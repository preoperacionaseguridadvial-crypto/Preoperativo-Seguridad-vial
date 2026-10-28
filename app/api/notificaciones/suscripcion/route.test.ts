import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/config", () => ({
  auth: () => mockAuth(),
}));

import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { DELETE, POST } from "@/app/api/notificaciones/suscripcion/route";
import { crearUsuario, limpiarBaseDeTest } from "@/test/helpers/db";

function loginComo(user: { id: string; role: Role }) {
  mockAuth.mockResolvedValue({ user: { id: user.id, role: user.role } });
}

function req(method: "POST" | "DELETE", body: unknown) {
  return new Request("http://localhost/api/notificaciones/suscripcion", {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const SUB = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  keys: { p256dh: "BPublicKey", auth: "authSecret" },
};

describe("/api/notificaciones/suscripcion", () => {
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
    expect((await POST(req("POST", SUB))).status).toBe(401);
    expect((await DELETE(req("DELETE", { endpoint: SUB.endpoint }))).status).toBe(401);
  });

  it("rol sin notificaciones (ADMINISTRADOR): 403 y no guarda", async () => {
    loginComo(await crearUsuario(Role.ADMINISTRADOR));
    expect((await POST(req("POST", SUB))).status).toBe(403);
    expect(await prisma.suscripcionPush.count()).toBe(0);
  });

  it.each([Role.TRABAJADOR, Role.SUPERVISOR, Role.SUPERVISOR_OLEARIARI, Role.SST])(
    "%s guarda su suscripción",
    async (rol) => {
      const user = await crearUsuario(rol);
      loginComo(user);

      const res = await POST(req("POST", SUB));

      expect(res.status).toBe(200);
      const fila = await prisma.suscripcionPush.findUniqueOrThrow({ where: { endpoint: SUB.endpoint } });
      expect(fila).toMatchObject({ userId: user.id, p256dh: "BPublicKey", auth: "authSecret" });
    },
  );

  it("deja en el log el alta del dispositivo con el rol y el servicio push (sin el endpoint completo)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const user = await crearUsuario(Role.SUPERVISOR);
    loginComo(user);

    await POST(req("POST", SUB));

    expect(info).toHaveBeenCalledWith(`[push] Dispositivo activado: usuario ${user.id} (SUPERVISOR) vía fcm.googleapis.com`);
    info.mockRestore();
  });

  it("upsert por endpoint: reasigna al usuario actual y actualiza claves, sin duplicar", async () => {
    const a = await crearUsuario(Role.TRABAJADOR);
    const b = await crearUsuario(Role.SST);
    loginComo(a);
    await POST(req("POST", SUB));
    loginComo(b);
    const res = await POST(req("POST", { ...SUB, keys: { p256dh: "Nueva", auth: "Otra" } }));

    expect(res.status).toBe(200);
    const filas = await prisma.suscripcionPush.findMany();
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ userId: b.id, p256dh: "Nueva", auth: "Otra" });
  });

  it.each([
    ["JSON inválido", "{no es json"],
    ["sin endpoint", { keys: SUB.keys }],
    ["endpoint no https", { ...SUB, endpoint: "http://inseguro.example/x" }],
    ["endpoint que no es URL", { ...SUB, endpoint: "no-es-url" }],
    ["sin keys", { endpoint: SUB.endpoint }],
    ["p256dh vacío", { ...SUB, keys: { p256dh: "", auth: "a" } }],
    ["auth no string", { ...SUB, keys: { p256dh: "p", auth: 5 } }],
    ["endpoint gigante", { ...SUB, endpoint: `https://x.example/${"a".repeat(3000)}` }],
    ["endpoint fuera de los servicios push", { ...SUB, endpoint: "https://interno.example/x" }],
    ["host que solo termina parecido", { ...SUB, endpoint: "https://evilfcm.googleapis.com.example/x" }],
  ])("payload inválido (%s): 400", async (_nombre, body) => {
    loginComo(await crearUsuario(Role.TRABAJADOR));
    expect((await POST(req("POST", body))).status).toBe(400);
    expect(await prisma.suscripcionPush.count()).toBe(0);
  });

  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://web.push.apple.com/QGx",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ])("acepta el servicio push oficial %s", async (endpoint) => {
    loginComo(await crearUsuario(Role.TRABAJADOR));
    expect((await POST(req("POST", { ...SUB, endpoint }))).status).toBe(200);
  });

  it("DELETE borra solo la suscripción del usuario actual", async () => {
    const a = await crearUsuario(Role.TRABAJADOR);
    const b = await crearUsuario(Role.SST);
    await prisma.suscripcionPush.create({ data: { userId: a.id, endpoint: "https://p.example/a", p256dh: "p", auth: "a" } });
    await prisma.suscripcionPush.create({ data: { userId: b.id, endpoint: "https://p.example/b", p256dh: "p", auth: "a" } });

    loginComo(a);
    expect((await DELETE(req("DELETE", { endpoint: "https://p.example/b" }))).status).toBe(200);
    expect(await prisma.suscripcionPush.count()).toBe(2);

    expect((await DELETE(req("DELETE", { endpoint: "https://p.example/a" }))).status).toBe(200);
    const restantes = await prisma.suscripcionPush.findMany({ select: { endpoint: true } });
    expect(restantes).toEqual([{ endpoint: "https://p.example/b" }]);
  });

  it("DELETE sin endpoint válido: 400", async () => {
    loginComo(await crearUsuario(Role.TRABAJADOR));
    expect((await DELETE(req("DELETE", {}))).status).toBe(400);
  });
});
