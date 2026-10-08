import { describe, expect, it } from "vitest";
import { Role } from "@/generated/prisma/client";
import { puedeAccederARuta } from "@/lib/auth/route-roles";
import { atajosPorRol, fechaLegible, primerNombre } from "@/lib/inicio/atajos";

describe("primerNombre", () => {
  it("toma la primera palabra del nombre", () => {
    expect(primerNombre("Jorge Luis Ramirez")).toBe("Jorge");
  });

  it("ignora espacios sobrantes", () => {
    expect(primerNombre("  Ana   María ")).toBe("Ana");
  });

  it("cae a un texto neutro si el nombre está vacío o falta", () => {
    expect(primerNombre("")).toBe("");
    expect(primerNombre(null)).toBe("");
    expect(primerNombre(undefined)).toBe("");
  });
});

describe("fechaLegible", () => {
  it("formatea la fecha en español de Colombia con la zona horaria de Bogotá", () => {
    // 2026-10-08T03:00Z sigue siendo 7 de octubre en Bogotá (UTC-5).
    expect(fechaLegible(new Date("2026-10-08T03:00:00Z"))).toBe("Miércoles, 7 de octubre de 2026");
  });
});

describe("atajosPorRol", () => {
  const todos = Object.values(Role);

  it.each(todos)("todos los atajos de %s son rutas que el proxy le permite abrir", (rol) => {
    for (const atajo of atajosPorRol(rol)) {
      expect(puedeAccederARuta(rol, atajo.href), `${rol} -> ${atajo.href}`).toBe(true);
    }
  });

  it("cada rol tiene al menos un atajo", () => {
    for (const rol of todos) {
      expect(atajosPorRol(rol).length).toBeGreaterThan(0);
    }
  });

  it("entrega los atajos esperados por rol", () => {
    const hrefs = (rol: Role) => atajosPorRol(rol).map((a) => a.href);
    expect(hrefs(Role.SUPERVISOR)).toEqual(["/aprobaciones", "/consulta-inspecciones"]);
    expect(hrefs(Role.SUPERVISOR_OLARIARI)).toEqual(["/aprobaciones", "/consulta-inspecciones"]);
    expect(hrefs(Role.DIRECTOR)).toEqual(["/dashboard", "/consulta-inspecciones"]);
    expect(hrefs(Role.SST)).toEqual(["/dashboard", "/consulta-inspecciones", "/admin/usuarios"]);
    expect(hrefs(Role.ADMINISTRADOR)).toEqual([
      "/admin/usuarios",
      "/admin/configuracion",
      "/dashboard",
      "/consulta-inspecciones",
    ]);
    expect(hrefs(Role.TRABAJADOR)).toEqual(["/inspecciones"]);
  });

  it("puedeAccederARuta rechaza rutas de otro rol y acepta subrutas", () => {
    expect(puedeAccederARuta(Role.TRABAJADOR, "/dashboard")).toBe(false);
    expect(puedeAccederARuta(Role.SUPERVISOR, "/aprobaciones/abc")).toBe(true);
    expect(puedeAccederARuta(Role.SUPERVISOR_OLARIARI, "/aprobaciones/abc")).toBe(true);
    expect(puedeAccederARuta(Role.SUPERVISOR_OLARIARI, "/consulta-inspecciones")).toBe(true);
    expect(puedeAccederARuta(Role.SUPERVISOR_OLARIARI, "/admin/usuarios")).toBe(false);
    expect(puedeAccederARuta(Role.SUPERVISOR_OLARIARI, "/dashboard")).toBe(false);
    expect(puedeAccederARuta(Role.DIRECTOR, "/admin/usuarios")).toBe(false);
    expect(puedeAccederARuta(Role.TRABAJADOR, "/")).toBe(true);
  });
});
