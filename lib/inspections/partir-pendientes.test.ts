import { describe, expect, it } from "vitest";
import { ordenarPendientesPorAtencion, partirPendientes } from "@/lib/inspections/partir-pendientes";

const base = { status: "PENDIENTE_APROBACION", tomaMedicamentos: false, condicionesAptas: true, consumioAlcohol: false };
const normal = (id: string) => ({ id, ...base });
const alerta = (id: string) => ({ id, ...base, consumioAlcohol: true });
const noApta = (id: string) => ({ id, ...base, status: "NO_APTA_PARA_OPERAR" });

describe("partirPendientes", () => {
  it("separa las que requieren atención de las demás conservando el orden", () => {
    const { conAlerta, sinAlerta } = partirPendientes([normal("a"), alerta("b"), normal("c"), noApta("d")]);
    expect(conAlerta.map((i) => i.id)).toEqual(["b", "d"]);
    expect(sinAlerta.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("lista vacía: ambas vacías", () => {
    expect(partirPendientes([])).toEqual({ conAlerta: [], sinAlerta: [] });
  });
});

describe("ordenarPendientesPorAtencion", () => {
  it("pone primero las que requieren atención y mantiene el orden relativo", () => {
    const lista = ordenarPendientesPorAtencion([normal("a"), alerta("b"), normal("c"), noApta("d")]);
    expect(lista.map((i) => i.id)).toEqual(["b", "d", "a", "c"]);
  });
});
