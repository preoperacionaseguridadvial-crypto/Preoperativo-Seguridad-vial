import { describe, expect, it, vi } from "vitest";

// requireRole importa la config de NextAuth; acá solo se usan sus clases de error.
vi.mock("@/lib/auth/config", () => ({ auth: () => null }));

import { Prisma, TipoFotoInspeccion } from "@/generated/prisma/client";
import { ForbiddenError, UnauthenticatedError } from "@/lib/auth/requireRole";
import { errorFotoAHttp, parseTipoFoto } from "@/lib/inspections/foto-upload-http";

describe("parseTipoFoto", () => {
  it("acepta lateral/placa en minúscula o mayúscula", () => {
    expect(parseTipoFoto("lateral")).toBe(TipoFotoInspeccion.LATERAL);
    expect(parseTipoFoto("PLACA")).toBe(TipoFotoInspeccion.PLACA);
  });
  it("rechaza cualquier otro valor", () => {
    expect(parseTipoFoto("frontal")).toBeNull();
    expect(parseTipoFoto("")).toBeNull();
  });
});

describe("errorFotoAHttp", () => {
  it("sin sesión -> 401", () => {
    expect(errorFotoAHttp(new UnauthenticatedError()).status).toBe(401);
  });
  it("rol/pertenencia -> 403 con el mensaje", () => {
    const r = errorFotoAHttp(new ForbiddenError("Esta inspección no pertenece al usuario autenticado."));
    expect(r).toEqual({ status: 403, message: "Esta inspección no pertenece al usuario autenticado." });
  });
  it("error de negocio/validación -> 400 con su mensaje en español", () => {
    expect(errorFotoAHttp(new Error("Debés tomar la foto antes de continuar."))).toEqual({
      status: 400,
      message: "Debés tomar la foto antes de continuar.",
    });
  });
  it("errores de infraestructura (Prisma, AWS) -> 500 genérico sin filtrar detalles", () => {
    const prismaErr = new Prisma.PrismaClientKnownRequestError("secreto de conexión", {
      code: "P1001",
      clientVersion: "x",
    });
    const awsErr = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:9010"), { $metadata: {} });
    for (const err of [prismaErr, awsErr, "raro"]) {
      const r = errorFotoAHttp(err);
      expect(r.status).toBe(500);
      expect(r.message).toBe("No se pudo guardar la foto. Intentá de nuevo.");
    }
  });
});
