import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHECKLIST } from "@/prisma/catalogo-checklist";
import { pasosChecklistEnOrden } from "@/lib/inspections/pasos-flujo";

type Vehiculo = "MOTO" | "CARRO";

// Catálogo tal como lo ve `getChecklistCatalog` para un tipo de vehículo: sus
// ítems más los compartidos (tipoVehiculo null), ordenados por `orden`.
function catalogoPara(tipo: Vehiculo) {
  return CHECKLIST.map((categoria) => ({
    nombre: categoria.nombre,
    items: categoria.items
      .filter((item) => !item.tipoVehiculo || item.tipoVehiculo === tipo)
      .sort((a, b) => a.orden - b.orden)
      .map((item) => ({ id: item.nombre, orden: item.orden })),
  })).filter((categoria) => categoria.items.length > 0);
}

function recorrido(tipo: Vehiculo): string[] {
  return pasosChecklistEnOrden(catalogoPara(tipo), "Documentación").map((paso) =>
    paso.tipo === "lista" ? "Documentos" : paso.tipo === "item" ? paso.id : `Foto ${paso.clave}`,
  );
}

describe("orden del recorrido del catálogo sembrado", () => {
  it("MOTO: documentos primero y luego el orden pedido por el dueño de producto", () => {
    expect(recorrido("MOTO")).toEqual([
      "Documentos",
      "Luces externas con direccionales",
      "Llantas",
      "Nivel de aceite",
      "Nivel líquido de frenos",
      "Frenos",
      "Nivel refrigerante",
      "Espejos",
      "Canguro de emergencia vial",
      "Casco",
    ]);
  });

  it("CARRO: documentos primero y luego el orden pedido por el dueño de producto", () => {
    expect(recorrido("CARRO")).toEqual([
      "Documentos",
      "Luces altas, bajas, reversa e internas con direccionales",
      "Llantas, incluye repuesto",
      "Nivel de aceite",
      "Nivel líquido de frenos",
      "Frenos",
      "Nivel refrigerante",
      "Cinturones de seguridad",
      "Limpiabrisas",
      "Espejos",
      "Botiquín",
      "Extintor",
    ]);
  });

  it("no repite (categoría, nombre)", () => {
    const claves = CHECKLIST.flatMap((c) => c.items.map((i) => `${c.nombre}/${i.nombre}`));
    expect(new Set(claves).size).toBe(claves.length);
  });
});

// La migración aplica el orden a las bases existentes; el seed, a las nuevas.
// Si divergen, producción y una base limpia recorrerían el checklist distinto.
describe("migración orden_flujo_checklist", () => {
  const sql = readFileSync(
    path.join(__dirname, "migrations", "20261023150000_orden_flujo_checklist", "migration.sql"),
    "utf8",
  );
  const filas = [...sql.matchAll(/\('([^']+)', '([^']+)', (\d+)\)/g)].map((m) => ({
    categoria: m[1],
    nombre: m[2],
    orden: Number(m[3]),
  }));

  it("fija el mismo orden que el seed para cada ítem no documental", () => {
    const delSeed = CHECKLIST.filter((c) => c.nombre !== "Documentación").flatMap((c) =>
      c.items.map((i) => ({ categoria: c.nombre, nombre: i.nombre, orden: i.orden })),
    );

    const ordenar = (xs: typeof filas) => [...xs].sort((a, b) => a.nombre.localeCompare(b.nombre));
    expect(ordenar(filas)).toEqual(ordenar(delSeed));
  });
});
