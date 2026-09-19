import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PREGUNTAS_ESTADO_CONDUCTOR,
  requiereAtencionEstadoConductor,
  siguientePreguntaEstadoConductor,
} from "@/lib/inspections/estado-conductor";

// A6 del design de soporte-moto-carro: la declaración de estado del
// conductor NUNCA bloquea el envío (D8) — esta función solo decide si el
// Supervisor debe ver una advertencia. Es derivada, no un flag guardado.
describe("requiereAtencionEstadoConductor", () => {
  it("no requiere atención cuando las 3 respuestas son las esperadas (sin medicamentos, apto, sin alcohol)", () => {
    expect(
      requiereAtencionEstadoConductor({
        tomaMedicamentos: false,
        condicionesAptas: true,
        consumioAlcohol: false,
      }),
    ).toBe(false);
  });

  it("requiere atención si toma medicamentos/sustancias (SÍ)", () => {
    expect(
      requiereAtencionEstadoConductor({
        tomaMedicamentos: true,
        condicionesAptas: true,
        consumioAlcohol: false,
      }),
    ).toBe(true);
  });

  it("requiere atención si NO está en condiciones físicas y mentales adecuadas", () => {
    expect(
      requiereAtencionEstadoConductor({
        tomaMedicamentos: false,
        condicionesAptas: false,
        consumioAlcohol: false,
      }),
    ).toBe(true);
  });

  it("requiere atención si consumió alcohol/sustancias (SÍ)", () => {
    expect(
      requiereAtencionEstadoConductor({
        tomaMedicamentos: false,
        condicionesAptas: true,
        consumioAlcohol: true,
      }),
    ).toBe(true);
  });

  it("no requiere atención (false, no true) cuando todavía falta responder (null)", () => {
    expect(
      requiereAtencionEstadoConductor({
        tomaMedicamentos: null,
        condicionesAptas: null,
        consumioAlcohol: null,
      }),
    ).toBe(false);
  });
});

// Las 3 preguntas de la declaración se muestran de a una, en este orden
// (pedido del dueño de producto, 2026-09-18), con el texto textual del formato.
describe("PREGUNTAS_ESTADO_CONDUCTOR", () => {
  it("son 3, en el orden medicamentos → condiciones → alcohol, con el texto textual", () => {
    expect(PREGUNTAS_ESTADO_CONDUCTOR.map((pregunta) => pregunta.campo)).toEqual([
      "tomaMedicamentos",
      "condicionesAptas",
      "consumioAlcohol",
    ]);
    expect(PREGUNTAS_ESTADO_CONDUCTOR.map((pregunta) => pregunta.texto)).toEqual([
      "¿Se encuentra bajo los efectos de algún medicamento, sustancia o condición que pueda afectar su capacidad para conducir de manera segura?",
      "¿Se encuentra en condiciones físicas y mentales adecuadas para conducir de manera segura?",
      "¿Ha consumido alcohol o alguna sustancia que pueda afectar su capacidad para conducir?",
    ]);
  });

  it("solo la primera lleva el aviso de informar al responsable si se responde Sí", () => {
    expect(PREGUNTAS_ESTADO_CONDUCTOR[0].ayudaSi).toBe(
      'Si respondió "Sí": informar al responsable antes de iniciar el recorrido.',
    );
    expect(PREGUNTAS_ESTADO_CONDUCTOR[1].ayudaSi).toBeUndefined();
    expect(PREGUNTAS_ESTADO_CONDUCTOR[2].ayudaSi).toBeUndefined();
  });
});

// Cada pregunta se muestra con su imagen de apoyo (pedido del dueño de
// producto, 2026-09-18); si el archivo no existe, la pantalla cae al
// placeholder, así que este test evita que un nombre mal escrito pase
// desapercibido.
describe("imagen de cada pregunta", () => {
  it("cada pregunta declara una imagen bajo /estado-conductor/ y el archivo existe en public/", () => {
    for (const pregunta of PREGUNTAS_ESTADO_CONDUCTOR) {
      expect(pregunta.imagen, pregunta.campo).toMatch(/^\/estado-conductor\/[a-z0-9-]+\.jpg$/);
      expect(existsSync(join(process.cwd(), "public", pregunta.imagen)), pregunta.imagen).toBe(true);
    }
  });

  it("las 3 preguntas usan imágenes distintas", () => {
    const imagenes = PREGUNTAS_ESTADO_CONDUCTOR.map((pregunta) => pregunta.imagen);
    expect(new Set(imagenes).size).toBe(3);
  });
});

describe("siguientePreguntaEstadoConductor", () => {
  const vacia = { tomaMedicamentos: null, condicionesAptas: null, consumioAlcohol: null };

  it("empieza por la primera pregunta cuando no hay ninguna respuesta", () => {
    expect(siguientePreguntaEstadoConductor(vacia)).toBe(1);
  });

  it("avanza a la segunda y a la tercera a medida que se responden", () => {
    expect(siguientePreguntaEstadoConductor({ ...vacia, tomaMedicamentos: false })).toBe(2);
    expect(siguientePreguntaEstadoConductor({ ...vacia, tomaMedicamentos: true, condicionesAptas: true })).toBe(3);
  });

  it("devuelve la primera que falte aunque haya una posterior respondida", () => {
    expect(siguientePreguntaEstadoConductor({ ...vacia, condicionesAptas: true })).toBe(1);
  });

  it("devuelve null cuando las 3 están respondidas", () => {
    expect(
      siguientePreguntaEstadoConductor({ tomaMedicamentos: false, condicionesAptas: true, consumioAlcohol: false }),
    ).toBeNull();
  });
});
