import { describe, expect, it } from "vitest";
import { Role } from "@/generated/prisma/enums";
import { descripcionRol, filtrarUsuarios, llevaVehiculo, type UsuarioFiltrable } from "@/lib/admin/usuario-ui";

const base = { cedula: null, activo: true, vehicle: null };
const usuarios: UsuarioFiltrable[] = [
  { ...base, name: "María Pérez", email: "maria@ess.co", role: Role.TRABAJADOR, cedula: "1020304050", vehicle: { placa: "ABC123" } },
  { ...base, name: "Juan Gómez", email: "juan@ess.co", role: Role.SST },
  { ...base, name: "Luis Díaz", email: "luis@ess.co", role: Role.TRABAJADOR, activo: false },
];

describe("llevaVehiculo", () => {
  it("solo el Recorredor lleva vehiculo", () => {
    expect(llevaVehiculo(Role.TRABAJADOR)).toBe(true);
    expect(llevaVehiculo(Role.SST)).toBe(false);
    expect(llevaVehiculo("")).toBe(false);
  });
});

describe("descripcionRol", () => {
  it("describe cada rol en una linea", () => {
    for (const rol of Object.values(Role)) {
      expect(descripcionRol(rol).length).toBeGreaterThan(10);
    }
  });
});

describe("filtrarUsuarios", () => {
  it("sin filtros devuelve todos", () => {
    expect(filtrarUsuarios(usuarios, {})).toHaveLength(3);
  });
  it("busca por nombre sin importar tildes ni mayusculas", () => {
    expect(filtrarUsuarios(usuarios, { q: "maria perez" }).map((u) => u.email)).toEqual(["maria@ess.co"]);
  });
  it("busca por email, cedula y placa", () => {
    expect(filtrarUsuarios(usuarios, { q: "juan@" })).toHaveLength(1);
    expect(filtrarUsuarios(usuarios, { q: "10203" })).toHaveLength(1);
    expect(filtrarUsuarios(usuarios, { q: "abc1" })).toHaveLength(1);
  });
  it("filtra por rol y por estado", () => {
    expect(filtrarUsuarios(usuarios, { rol: Role.TRABAJADOR })).toHaveLength(2);
    expect(filtrarUsuarios(usuarios, { estado: "inactivo" }).map((u) => u.name)).toEqual(["Luis Díaz"]);
    expect(filtrarUsuarios(usuarios, { rol: Role.TRABAJADOR, estado: "activo" })).toHaveLength(1);
  });
  it("ignora espacios sobrantes en la busqueda", () => {
    expect(filtrarUsuarios(usuarios, { q: "  luis " })).toHaveLength(1);
  });
});
