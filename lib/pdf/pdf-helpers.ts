import "server-only";
import type { RespuestaChecklist } from "@/generated/prisma/client";

// Lógica pura (sin JSX, sin Prisma) que extrae del componente del PDF
// (InspeccionPdfDocument.tsx) las dos reglas que la corrección de Slice 2
// (hallazgos CRITICAL #2 y #3) encontró rotas: la clasificación de
// "Inspección Visual" por posición fija, y el mapeo binario OK/FALLA que no
// sabía dibujar los 3 estados de los ítems de fluidos (BUENO/BAJO/MALO).
// Separado del componente para poder testearlo sin renderizar PDF/React.

/**
 * Clasifica los ítems de la categoría "Inspección Visual" en los dos
 * subtítulos del formato oficial FO-SVS-23: los que mencionan "Luces" van
 * bajo "ENCIENDA LAS LUCES DEL VEHICULO Y VERIFIQUE", el resto bajo "ESTADO
 * GENERAL DEL VEHICULO". Clasifica por NOMBRE, no por posición: el catálogo
 * branchea por tipo de vehículo (MOTO 5 ítems / CARRO 6 ítems, distinto
 * orden — ver prisma/seed.ts) y ya no garantiza que los ítems de luces
 * caigan en las primeras posiciones del arreglo.
 */
export function clasificarInspeccionVisual<T extends { checklistItem: { nombre: string } }>(
  items: T[],
): { luces: T[]; estadoGeneral: T[] } {
  const luces = items.filter((item) => item.checklistItem.nombre.includes("Luces"));
  const estadoGeneral = items.filter((item) => !item.checklistItem.nombre.includes("Luces"));
  return { luces, estadoGeneral };
}

/**
 * Categorías del checklist que van en una sección genérica del PDF: todas
 * menos "Inspección Visual" (se subdivide con `clasificarInspeccionVisual`)
 * y "Documentación" (tiene su propio subtítulo fijo "DOCUMENTOS
 * CONDUCTORES"). Antes de este fix el PDF solo buscaba esas dos categorías
 * por nombre exacto y el resto (Fluidos, Equipo de prevención) quedaba
 * afuera aunque `data.respuestas` sí las trajera. Genérico a propósito: no
 * hardcodea "Fluidos"/"Equipo de prevención" por nombre, para no volver a
 * romperse si se agrega una categoría nueva al catálogo.
 */
const CATEGORIAS_CON_SECCION_PROPIA = new Set(["Inspección Visual", "Documentación"]);

export function categoriasGenericasPdf<T extends { categoria: { nombre: string } }>(
  respuestasPorCategoria: T[],
): T[] {
  return respuestasPorCategoria.filter((c) => !CATEGORIAS_CON_SECCION_PROPIA.has(c.categoria.nombre));
}

/** Estilo visual (no el texto) asociado al valor de un ítem — "ok"/"warn"/"falla". */
export type EstiloValorItem = "ok" | "warn" | "falla";

/**
 * Texto + estilo para el valor de un ítem del checklist en el PDF. Cubre
 * tanto BINARIO (OK/FALLA, como siempre) como TRIESTADO (BUENO/BAJO/MALO,
 * ítems de fluidos) — antes de este fix el PDF solo sabía dibujar dos
 * estados (`esOk = valor === "OK"`), así que un ítem en MALO se hubiera
 * mostrado con el mismo texto que un ítem en FALLA sin distinguirlos, y
 * BUENO/BAJO ni siquiera se contemplaban.
 */
export function formatoValorItemPdf(valor: RespuestaChecklist): { texto: string; estilo: EstiloValorItem } {
  switch (valor) {
    case "OK":
      return { texto: "✓ OK.", estilo: "ok" };
    case "BUENO":
      return { texto: "✓ BUENO", estilo: "ok" };
    case "BAJO":
      return { texto: "⚠ BAJO", estilo: "warn" };
    case "MALO":
      return { texto: "X MALO", estilo: "falla" };
    case "FALLA":
    default:
      return { texto: "X FALLA, DAÑO, FALTANTE", estilo: "falla" };
  }
}
