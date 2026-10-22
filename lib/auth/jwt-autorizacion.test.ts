import { describe, expect, it, vi } from "vitest";
import type { JWT } from "next-auth/jwt";
import { jwtConAutorizacion } from "@/lib/auth/jwt-autorizacion";

const tokenBase: JWT = { id: "u1", role: "TRABAJADOR", autorizoDatos: false };

describe("jwtConAutorizacion", () => {
  it("al iniciar sesión copia el dato que resolvió el servidor", async () => {
    const consultar = vi.fn();
    const token = await jwtConAutorizacion(
      { token: {} as JWT, user: { id: "u1", role: "TRABAJADOR", autorizoDatos: true } },
      consultar,
    );
    expect(token).toMatchObject({ id: "u1", role: "TRABAJADOR", autorizoDatos: true });
    expect(consultar).not.toHaveBeenCalled();
  });

  it("en una actualización de sesión vuelve a leer la base de datos", async () => {
    const consultar = vi.fn().mockResolvedValue(true);
    const token = await jwtConAutorizacion({ token: { ...tokenBase }, trigger: "update" }, consultar);
    expect(consultar).toHaveBeenCalledWith("u1");
    expect(token.autorizoDatos).toBe(true);
  });

  it("ignora lo que mande el cliente en la actualización: sin registro en la base sigue en false", async () => {
    const consultar = vi.fn().mockResolvedValue(false);
    const token = await jwtConAutorizacion(
      { token: { ...tokenBase }, trigger: "update", session: { autorizoDatos: true, user: { autorizoDatos: true } } },
      consultar,
    );
    expect(token.autorizoDatos).toBe(false);
  });

  it("en un request normal no toca el token ni consulta la base", async () => {
    const consultar = vi.fn();
    const token = await jwtConAutorizacion({ token: { ...tokenBase, autorizoDatos: true } }, consultar);
    expect(token).toEqual({ ...tokenBase, autorizoDatos: true });
    expect(consultar).not.toHaveBeenCalled();
  });

  it("al iniciar sesión guarda si el usuario pidió ser recordado", async () => {
    const consultar = vi.fn();
    const sinRecordar = await jwtConAutorizacion(
      { token: {} as JWT, user: { id: "u1", role: "TRABAJADOR", recordar: false } },
      consultar,
    );
    expect(sinRecordar.recordar).toBe(false);
    const recordado = await jwtConAutorizacion({ token: {} as JWT, user: { id: "u1", role: "TRABAJADOR" } }, consultar);
    expect(recordado.recordar).toBe(true);
  });

  it("en una actualización de sesión conserva la preferencia de Recordarme", async () => {
    const consultar = vi.fn().mockResolvedValue(true);
    const token = await jwtConAutorizacion({ token: { ...tokenBase, recordar: false }, trigger: "update" }, consultar);
    expect(token.recordar).toBe(false);
  });
});
