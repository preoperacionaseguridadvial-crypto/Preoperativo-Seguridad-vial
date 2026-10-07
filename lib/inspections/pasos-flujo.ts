// Pasos del flujo guiado de la inspección del trabajador, en el orden real en
// que `getNextStepPath` (lib/inspections/queries.ts) lleva al trabajador. Es
// solo la vista previa de la pantalla de inicio: si cambia el orden del
// flujo, se cambia acá y en ese test.

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
 * Lista ordenada de los pasos reales de una inspección, como rutas RELATIVAS
 * a `/inspecciones/[id]/`. Es la misma secuencia que recorre `getNextStepPath`
 * (lib/inspections/queries.ts) y sirve para el botón "Atrás": kilometraje →
 * checklist → declaración del conductor (una entrada por pregunta) → fotos →
 * resultado → confirmar.
 *
 * El checklist se recorre ítem por ítem, salvo la categoría de documentos
 * (`categoriaLista`, "Documentación"), que es UN solo paso: la pantalla de
 * lista `/checklist`, en la posición que ocupa en el catálogo. Pura (recibe el
 * catálogo ya filtrado por tipo de vehículo) para poder probarla sin base.
 */
export function construirPasosFlujo(
  catalogo: { nombre: string; items: { id: string }[] }[],
  categoriaLista: string,
  totalPreguntasEstadoConductor: number,
): string[] {
  const pasos: string[] = ["medidas"];

  for (const categoria of catalogo) {
    if (categoria.nombre === categoriaLista) {
      if (categoria.items.length > 0) pasos.push("checklist");
      continue;
    }
    for (const item of categoria.items) {
      pasos.push(`checklist/${item.id}`);
    }
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
