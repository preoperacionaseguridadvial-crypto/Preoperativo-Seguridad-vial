// Pasos del flujo guiado de la inspección del trabajador, en el orden real en
// que `getNextStepPath` (lib/inspections/queries.ts) lleva al trabajador. Es
// solo la vista previa de la pantalla de inicio: si cambia el orden del
// flujo, se cambia acá y en ese test. Orden (2026-10-23): kilometraje →
// documentos → ítems por orden global → declaración → fotos → resultado → firma.

import type { ClaveFotoFlujo } from "@/lib/inspections/fotos-flujo";

export type IconoPaso = "kilometraje" | "checklist" | "conductor" | "fotos" | "resultado" | "firma";

export const PASOS_INSPECCION: readonly {
  clave: "medidas" | "checklist" | "estado-conductor" | "fotos" | "resultado" | "confirmar";
  titulo: string;
  descripcion: string;
  icono: IconoPaso;
}[] = [
  { clave: "medidas", titulo: "Kilometraje", descripcion: "Registra el kilometraje actual", icono: "kilometraje" },
  {
    clave: "checklist",
    titulo: "Checklist del vehículo",
    descripcion: "Documentos y revisión de cada ítem",
    icono: "checklist",
  },
  {
    clave: "estado-conductor",
    titulo: "Declaración del conductor",
    descripcion: "3 preguntas sobre tu estado",
    icono: "conductor",
  },
  { clave: "fotos", titulo: "Fotos del vehículo", descripcion: "Foto lateral y foto de la placa", icono: "fotos" },
  {
    clave: "resultado",
    titulo: "Declaración final",
    descripcion: "Si la unidad está en condiciones de operar",
    icono: "resultado",
  },
  { clave: "confirmar", titulo: "Confirmar y firmar", descripcion: "Revisa el resumen y firma el envío", icono: "firma" },
];

/**
 * Catálogo (ya filtrado por tipo de vehículo) con el `orden` GLOBAL de cada
 * ítem. `fotoDespues`: foto que se pide justo después de ese ítem (ver
 * lib/inspections/fotos-flujo.ts).
 */
export type CatalogoFlujo = {
  nombre: string;
  items: { id: string; orden: number; fotoDespues?: ClaveFotoFlujo | null }[];
}[];

export type PasoChecklist =
  | { tipo: "lista" }
  | { tipo: "item"; id: string; categoria: string }
  | { tipo: "foto"; clave: ClaveFotoFlujo };

/**
 * Pasos del checklist en el orden del recorrido: primero la pantalla de lista
 * de documentos (`categoriaLista`, si tiene ítems) y luego cada ítem de las
 * demás categorías, ordenados por su `orden` GLOBAL (no por categoría: así
 * Frenos puede ir entre Líquido de frenos y Refrigerante). Empate: orden del
 * catálogo (categoría y luego ítem). Única fuente de este orden, compartida por
 * `construirPasosFlujo` y `getNextStepPath` (lib/inspections/queries.ts).
 */
export function pasosChecklistEnOrden(catalogo: CatalogoFlujo, categoriaLista: string): PasoChecklist[] {
  const pasos: PasoChecklist[] = [];
  const items: {
    id: string;
    categoria: string;
    orden: number;
    posicion: number;
    fotoDespues: ClaveFotoFlujo | null;
  }[] = [];

  for (const categoria of catalogo) {
    if (categoria.nombre === categoriaLista) {
      if (categoria.items.length > 0) pasos.push({ tipo: "lista" });
      continue;
    }
    for (const item of categoria.items) {
      items.push({
        id: item.id,
        categoria: categoria.nombre,
        orden: item.orden,
        posicion: items.length,
        fotoDespues: item.fotoDespues ?? null,
      });
    }
  }

  items.sort((a, b) => a.orden - b.orden || a.posicion - b.posicion);
  for (const item of items) {
    pasos.push({ tipo: "item", id: item.id, categoria: item.categoria });
    if (item.fotoDespues) pasos.push({ tipo: "foto", clave: item.fotoDespues });
  }
  return pasos;
}

/**
 * Lista ordenada de los pasos reales de una inspección, como rutas RELATIVAS
 * a `/inspecciones/[id]/`. Es la misma secuencia que recorre `getNextStepPath`
 * (lib/inspections/queries.ts) y sirve para el botón "Atrás": kilometraje →
 * documentos (una sola pantalla de lista, `/checklist`) → ítems del checklist
 * uno por uno en orden global (`pasosChecklistEnOrden`, con la foto de las
 * llantas de la MOTO justo después de Llantas) → declaración del
 * conductor (una entrada por pregunta) → fotos → resultado → confirmar.
 * Pura (recibe el catálogo ya filtrado por tipo de vehículo) para poder
 * probarla sin base.
 */
export function construirPasosFlujo(
  catalogo: CatalogoFlujo,
  categoriaLista: string,
  totalPreguntasEstadoConductor: number,
): string[] {
  const pasos: string[] = ["medidas"];

  for (const paso of pasosChecklistEnOrden(catalogo, categoriaLista)) {
    if (paso.tipo === "lista") pasos.push("checklist");
    else if (paso.tipo === "item") pasos.push(`checklist/${paso.id}`);
    else pasos.push(`foto-${paso.clave}`);
  }

  for (let paso = 1; paso <= totalPreguntasEstadoConductor; paso++) {
    pasos.push(`estado-conductor?paso=${paso}`);
  }

  pasos.push("fotos", "resultado", "confirmar");
  return pasos;
}

/** Paso previo de `actual` en `pasos`, o `null` si es el primero o no está en la lista. */
export function pasoAnterior(pasos: readonly string[], actual: string): string | null {
  const indice = pasos.indexOf(actual);
  return indice > 0 ? pasos[indice - 1] : null;
}

/** Paso siguiente de `actual` en `pasos`, o `null` si es el último o no está en la lista. */
export function pasoSiguiente(pasos: readonly string[], actual: string): string | null {
  const indice = pasos.indexOf(actual);
  return indice >= 0 && indice < pasos.length - 1 ? pasos[indice + 1] : null;
}
