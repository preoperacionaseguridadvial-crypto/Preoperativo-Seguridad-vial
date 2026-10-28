import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSetVapidDetails = vi.fn();
const mockSendNotification = vi.fn();
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => mockSetVapidDetails(...args),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
}));

import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { enviarAUsuarios, pushConfigurado } from "@/lib/notificaciones/push";
import { crearUsuario, limpiarBaseDeTest } from "@/test/helpers/db";

const PAYLOAD = { titulo: "Nueva inspección", cuerpo: "ABC123 espera su revisión", url: "/aprobaciones/x" };

const ENV = {
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "clave-publica",
  VAPID_PRIVATE_KEY: "clave-privada",
  VAPID_SUBJECT: "mailto:soporte@example.com",
};

function conVapid() {
  Object.assign(process.env, ENV);
}

function sinVapid() {
  for (const k of Object.keys(ENV)) delete process.env[k];
}

async function suscribir(userId: string, endpoint: string) {
  return prisma.suscripcionPush.create({ data: { userId, endpoint, p256dh: "p", auth: "a" } });
}

describe("lib/notificaciones/push", () => {
  beforeEach(async () => {
    await limpiarBaseDeTest();
    mockSetVapidDetails.mockReset();
    mockSendNotification.mockReset();
    mockSendNotification.mockResolvedValue({ statusCode: 201 });
    conVapid();
  });

  afterEach(() => {
    sinVapid();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await limpiarBaseDeTest();
    await prisma.$disconnect();
  });

  it("sin variables VAPID: no envía nada, no lanza y avisa una sola vez", async () => {
    sinVapid();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const user = await crearUsuario(Role.SUPERVISOR);
    await suscribir(user.id, "https://push.example/1");

    expect(pushConfigurado()).toBe(false);
    await expect(enviarAUsuarios([user.id], PAYLOAD)).resolves.toBeUndefined();
    await enviarAUsuarios([user.id], PAYLOAD);

    expect(mockSendNotification).not.toHaveBeenCalled();
    expect(mockSetVapidDetails).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("deja rastro en el log cuando los destinatarios no tienen dispositivos suscritos", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const user = await crearUsuario(Role.SUPERVISOR);

    await enviarAUsuarios([user.id], PAYLOAD);

    expect(mockSendNotification).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(expect.stringContaining("[push] 1 destinatario(s), 0 dispositivo(s)"));
  });

  it("registra en el log cuántos envíos salieron bien y cuántos fallaron", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = await crearUsuario(Role.SUPERVISOR);
    await suscribir(user.id, "https://push.example/ok");
    await suscribir(user.id, "https://push.example/falla");
    mockSendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith("falla")) throw Object.assign(new Error("boom"), { statusCode: 500 });
      return { statusCode: 201 };
    });

    await enviarAUsuarios([user.id], PAYLOAD);

    expect(info).toHaveBeenCalledWith(expect.stringContaining("[push] 1 destinatario(s), 2 dispositivo(s): 1 enviada(s), 1 fallida(s)"));
  });

  it("envía a todas las suscripciones de los usuarios con el payload JSON", async () => {
    const a = await crearUsuario(Role.SUPERVISOR);
    const b = await crearUsuario(Role.SST);
    const otro = await crearUsuario(Role.TRABAJADOR);
    await suscribir(a.id, "https://push.example/a1");
    await suscribir(a.id, "https://push.example/a2");
    await suscribir(b.id, "https://push.example/b1");
    await suscribir(otro.id, "https://push.example/o1");

    await enviarAUsuarios([a.id, b.id], { ...PAYLOAD, tag: "insp-1" });

    expect(pushConfigurado()).toBe(true);
    expect(mockSetVapidDetails).toHaveBeenCalledWith(ENV.VAPID_SUBJECT, ENV.NEXT_PUBLIC_VAPID_PUBLIC_KEY, ENV.VAPID_PRIVATE_KEY);
    expect(mockSendNotification).toHaveBeenCalledTimes(3);
    const endpoints = mockSendNotification.mock.calls.map(([sub]) => sub.endpoint).sort();
    expect(endpoints).toEqual(["https://push.example/a1", "https://push.example/a2", "https://push.example/b1"]);
    const [sub, cuerpo] = mockSendNotification.mock.calls[0];
    expect(sub.keys).toEqual({ p256dh: "p", auth: "a" });
    expect(JSON.parse(cuerpo)).toEqual({ ...PAYLOAD, tag: "insp-1" });
  });

  it("sin usuarios destino no consulta ni envía", async () => {
    await enviarAUsuarios([], PAYLOAD);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("borra la suscripción cuando el servicio push responde 410 o 404", async () => {
    const user = await crearUsuario(Role.SUPERVISOR);
    await suscribir(user.id, "https://push.example/viva");
    await suscribir(user.id, "https://push.example/gone");
    await suscribir(user.id, "https://push.example/notfound");
    mockSendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith("/gone")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      if (sub.endpoint.endsWith("/notfound")) throw Object.assign(new Error("nf"), { statusCode: 404 });
      return { statusCode: 201 };
    });

    await enviarAUsuarios([user.id], PAYLOAD);

    const restantes = await prisma.suscripcionPush.findMany({ select: { endpoint: true } });
    expect(restantes).toEqual([{ endpoint: "https://push.example/viva" }]);
  });

  it("otros errores se registran y se tragan: no lanza y conserva la suscripción", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = await crearUsuario(Role.SST);
    await suscribir(user.id, "https://push.example/x");
    mockSendNotification.mockRejectedValue(Object.assign(new Error("boom"), { statusCode: 500 }));

    await expect(enviarAUsuarios([user.id], PAYLOAD)).resolves.toBeUndefined();

    expect(error).toHaveBeenCalled();
    expect(await prisma.suscripcionPush.count()).toBe(1);
  });

  it("un fallo en la consulta tampoco lanza", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(prisma.suscripcionPush, "findMany").mockRejectedValue(new Error("db caída"));

    await expect(enviarAUsuarios(["x"], PAYLOAD)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});
