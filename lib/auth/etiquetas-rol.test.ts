import { describe, expect, it } from "vitest";
import { Role, Sede } from "@/generated/prisma/client";
import {
  NOMBRE_SEDE_OLEARIARI,
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
    expect(etiquetaRol(Role.SUPERVISOR_OLEARIARI)).toBe("Supervisor Oleariari");
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
    expect(etiquetaSede(Sede.OLEARIARI)).toBe(NOMBRE_SEDE_OLEARIARI);
    expect(NOMBRE_SEDE_OLEARIARI).toBe("Oleariari");
  });

  it("SEDES lista ambas sedes con su etiqueta", () => {
    expect(SEDES).toEqual([
      { value: "BOGOTA", label: "Bogotá" },
      { value: "OLEARIARI", label: "Oleariari" },
    ]);
  });
});

describe("etiquetaUsuario", () => {
  it("el Recorredor se muestra con su sede", () => {
    expect(etiquetaUsuario(Role.TRABAJADOR, Sede.BOGOTA)).toBe("Recorredor Bogotá");
    expect(etiquetaUsuario(Role.TRABAJADOR, Sede.OLEARIARI)).toBe("Recorredor Oleariari");
  });

  it("el Recorredor sin sede conocida es solo 'Recorredor'", () => {
    expect(etiquetaUsuario(Role.TRABAJADOR, null)).toBe("Recorredor");
    expect(etiquetaUsuario(Role.TRABAJADOR, undefined)).toBe("Recorredor");
    expect(etiquetaUsuario(Role.TRABAJADOR)).toBe("Recorredor");
  });

  it("los demás roles ignoran la sede", () => {
    expect(etiquetaUsuario(Role.SUPERVISOR, Sede.BOGOTA)).toBe("Director de Operaciones");
    expect(etiquetaUsuario(Role.SUPERVISOR_OLEARIARI, Sede.OLEARIARI)).toBe("Supervisor Oleariari");
    expect(etiquetaUsuario(Role.SST, null)).toBe("Administrador SST");
  });
});

describe("ROLES_ASIGNABLES", () => {
  it("incluye todos los roles, con el nuevo Supervisor Oleariari", () => {
    expect([...ROLES_ASIGNABLES].sort()).toEqual(Object.values(Role).sort());
    expect(ROLES_ASIGNABLES).toContain(Role.SUPERVISOR_OLEARIARI);
  });
});
