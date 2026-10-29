import { describe, expect, it } from "vitest";
import { Role } from "@/generated/prisma/client";
import { puedeEliminarInspecciones, puedeGestionarAdministradores, tienePermisosSst } from "@/lib/auth/permisos";

describe("tienePermisosSst", () => {
  it("SST y ADMINISTRADOR tienen los permisos de SST", () => {
    expect(tienePermisosSst(Role.SST)).toBe(true);
    expect(tienePermisosSst(Role.ADMINISTRADOR)).toBe(true);
  });

  it("ningún otro rol los tiene", () => {
    for (const rol of Object.values(Role).filter((r) => r !== Role.SST && r !== Role.ADMINISTRADOR)) {
      expect(tienePermisosSst(rol)).toBe(false);
    }
  });
});

describe("puedeGestionarAdministradores", () => {
  it("solo ADMINISTRADOR puede crear o modificar cuentas de Administrador", () => {
    for (const rol of Object.values(Role)) {
      expect(puedeGestionarAdministradores(rol)).toBe(rol === Role.ADMINISTRADOR);
    }
  });
});

describe("puedeEliminarInspecciones", () => {
  it("solo ADMINISTRADOR puede eliminar inspecciones", () => {
    for (const rol of Object.values(Role)) {
      expect(puedeEliminarInspecciones(rol)).toBe(rol === Role.ADMINISTRADOR);
    }
  });
});
