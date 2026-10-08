import { describe, expect, it } from "vitest";
import { RespuestaChecklist, TipoNovedad } from "@/generated/prisma/client";
import {
  motivosConfirmacionAprobacion,
  type InspeccionParaConfirmacion,
} from "@/lib/inspections/motivos-confirmacion-aprobacion";

function inspeccionLimpia(overrides: Partial<InspeccionParaConfirmacion> = {}): InspeccionParaConfirmacion {
  return {
    puedeOperar: true,
    justificacionNoOperar: null,
    tomaMedicamentos: false,
    condicionesAptas: true,
    consumioAlcohol: false,
    respuestas: [],
    novedades: [],
    ...overrides,
  };
}

function respuesta(nombre: string, valor: RespuestaChecklist, orden = 1, ordenCategoria = 1) {
  return { valor, checklistItem: { nombre, orden, category: { orden: ordenCategoria } } };
}

describe("motivosConfirmacionAprobacion", () => {
  it("devuelve un arreglo vacío si no hay nada reportado", () => {
    const motivos = motivosConfirmacionAprobacion(
      inspeccionLimpia({
        respuestas: [respuesta("Frenos", RespuestaChecklist.OK), respuesta("Aceite", RespuestaChecklist.BUENO, 2)],
      }),
    );
    expect(motivos).toEqual([]);
  });

  it("BAJO no genera motivo", () => {
    const motivos = motivosConfirmacionAprobacion(
      inspeccionLimpia({ respuestas: [respuesta("Aceite", RespuestaChecklist.BAJO)] }),
    );
    expect(motivos).toEqual([]);
  });

  it("FALLA y MALO generan un motivo con el nombre del ítem y su etiqueta", () => {
    const motivos = motivosConfirmacionAprobacion(
      inspeccionLimpia({
        respuestas: [respuesta("Luces", RespuestaChecklist.FALLA, 1), respuesta("Frenos", RespuestaChecklist.MALO, 2)],
      }),
    );
    expect(motivos).toEqual(["Luces: Falla", "Frenos: Malo"]);
  });

  it("ordena las respuestas por categoría y luego por ítem, sin importar el orden de entrada", () => {
    const motivos = motivosConfirmacionAprobacion(
      inspeccionLimpia({
        respuestas: [
          respuesta("B2", RespuestaChecklist.FALLA, 2, 2),
          respuesta("A2", RespuestaChecklist.FALLA, 2, 1),
          respuesta("A1", RespuestaChecklist.FALLA, 1, 1),
        ],
      }),
    );
    expect(motivos).toEqual(["A1: Falla", "A2: Falla", "B2: Falla"]);
  });

  it("incluye las novedades generales (sin ítem de checklist) pero no duplica las ligadas a un ítem", () => {
    const motivos = motivosConfirmacionAprobacion(
      inspeccionLimpia({
        respuestas: [respuesta("Luces", RespuestaChecklist.FALLA)],
        novedades: [
          { inspectionItemResponseId: "resp-1", tipo: TipoNovedad.FALLA, descripcion: "No enciende" },
          { inspectionItemResponseId: null, tipo: TipoNovedad.RAYON, descripcion: "Rayón en el costado" },
        ],
      }),
    );
    expect(motivos).toEqual(["Luces: Falla", "Novedad general (Rayón): Rayón en el costado"]);
  });

  it("incluye puedeOperar=false con su justificación cuando existe", () => {
    expect(
      motivosConfirmacionAprobacion(
        inspeccionLimpia({ puedeOperar: false, justificacionNoOperar: "Llanta pinchada" }),
      ),
    ).toEqual(["El trabajador reportó que no puede operar el vehículo: Llanta pinchada"]);
  });

  it("puedeOperar=false sin justificación no deja texto colgado", () => {
    expect(motivosConfirmacionAprobacion(inspeccionLimpia({ puedeOperar: false }))).toEqual([
      "El trabajador reportó que no puede operar el vehículo",
    ]);
  });

  it("genera un motivo por cada declaración preocupante del conductor", () => {
    const motivos = motivosConfirmacionAprobacion(
      inspeccionLimpia({ tomaMedicamentos: true, condicionesAptas: false, consumioAlcohol: true }),
    );
    expect(motivos).toHaveLength(3);
    expect(motivos[0]).toMatch(/medicamento/i);
    expect(motivos[1]).toMatch(/condiciones/i);
    expect(motivos[2]).toMatch(/alcohol/i);
  });

  it("las declaraciones sin responder (null) no generan motivo", () => {
    expect(
      motivosConfirmacionAprobacion(
        inspeccionLimpia({ tomaMedicamentos: null, condicionesAptas: null, consumioAlcohol: null }),
      ),
    ).toEqual([]);
  });

  it("combina los tres orígenes en orden: checklist y novedades, resultado, declaración", () => {
    const motivos = motivosConfirmacionAprobacion(
      inspeccionLimpia({
        respuestas: [respuesta("Frenos", RespuestaChecklist.MALO)],
        puedeOperar: false,
        consumioAlcohol: true,
      }),
    );
    expect(motivos).toHaveLength(3);
    expect(motivos[0]).toBe("Frenos: Malo");
    expect(motivos[1]).toMatch(/no puede operar/i);
    expect(motivos[2]).toMatch(/alcohol/i);
  });
});
