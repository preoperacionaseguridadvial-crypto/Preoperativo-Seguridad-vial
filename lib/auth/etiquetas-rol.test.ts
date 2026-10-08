import { describe, expect, it } from "vitest";
import { Role, Sede } from "@/generated/prisma/client";
import {
  NOMBRE_SEDE_OLARIARI,
  ROLES_ASIGNABLES,
  SEDES,
  etiquetaRol,
  etiquetaSede,
  etiquetaUsuario,
} from "@/lib/auth/etiquetas-rol";

describe("etiquetaRol", () => {
  it("devuelve el cargo real de ESS para cada rol", () => {
    expect(etiquetaRol(Role.TRABAJADOR)).toBe("Recorredor");
    expect(etiquetaRol(Role.SUPERVISOR)).toBe("Director de Operaciones");
    expect(etiquetaRol(Role.DIRECTOR)).toBe("Director");
    expect(etiquetaRol(Role.SST)).toBe("Administrador SST");
    expect(etiquetaRol(Role.ADMINISTRADOR)).toBe("Administrador");
    expect(etiquetaRol(Role.SUPERVISOR_OLARIARI)).toBe("Supervisor Olariari");
  });

  it("cubre todos los roles del enum", () => {
    for (const rol of Object.values(Role)) {
      expect(etiquetaRol(rol).length).toBeGreaterThan(0);
    }
  });
});

describe("etiquetaSede", () => {
  it("devuelve el nombre legible de cada sede", () => {
    expect(etiquetaSede(Sede.BOGOTA)).toBe("Bogotá");
    expect(etiquetaSede(Sede.OLARIARI)).toBe(NOMBRE_SEDE_OLARIARI);
    expect(NOMBRE_SEDE_OLARIARI).toBe("Olariari");
  });

  it("SEDES lista ambas sedes con su etiqueta", () => {
    expect(SEDES).toEqual([
      { value: "BOGOTA", label: "Bogotá" },
      { value: "OLARIARI", label: "Olariari" },
    ]);
  });
});

describe("etiquetaUsuario", () => {
  it("el Recorredor se muestra con su sede", () => {
    expect(etiquetaUsuario(Role.TRABAJADOR, Sede.BOGOTA)).toBe("Recorredor Bogotá");
    expect(etiquetaUsuario(Role.TRABAJADOR, Sede.OLARIARI)).toBe("Recorredor Olariari");
  });

  it("el Recorredor sin sede conocida es solo 'Recorredor'", () => {
    expect(etiquetaUsuario(Role.TRABAJADOR, null)).toBe("Recorredor");
    expect(etiquetaUsuario(Role.TRABAJADOR, undefined)).toBe("Recorredor");
    expect(etiquetaUsuario(Role.TRABAJADOR)).toBe("Recorredor");
  });

  it("los demás roles ignoran la sede", () => {
    expect(etiquetaUsuario(Role.SUPERVISOR, Sede.BOGOTA)).toBe("Director de Operaciones");
    expect(etiquetaUsuario(Role.SUPERVISOR_OLARIARI, Sede.OLARIARI)).toBe("Supervisor Olariari");
    expect(etiquetaUsuario(Role.SST, null)).toBe("Administrador SST");
  });
});

describe("ROLES_ASIGNABLES", () => {
  it("incluye todos los roles, con el nuevo Supervisor Olariari", () => {
    expect([...ROLES_ASIGNABLES].sort()).toEqual(Object.values(Role).sort());
    expect(ROLES_ASIGNABLES).toContain(Role.SUPERVISOR_OLARIARI);
  });
});
