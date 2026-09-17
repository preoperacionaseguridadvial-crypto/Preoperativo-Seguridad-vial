import type { TipoNovedad } from "@/generated/prisma/client";

// No se importa `CATEGORIA_SIN_PANTALLA_PROPIA` de lib/inspections/queries.ts
// a propósito: ese módulo tiene `import "server-only"`, y este archivo lo
// importan componentes "use client" (RespuestaChecklistItem.tsx,
// DocumentoCheckItem.tsx) — importarlo rompería el build. Se duplica el
// literal; si cambia el nombre de la categoría en el seed, hay que
// actualizar los dos lugares.
const NOMBRE_CATEGORIA_DOCUMENTACION = "Documentación";

// Fase C: los 7 valores originales de TipoNovedad, auditados contra el
// formato oficial FO-SVS-23 (no se inventan valores nuevos). VENCIDO se
// sumó después, específico para documentos (ver TIPOS_NOVEDAD_DOCUMENTO).
// Se usa `import type` para el tipo (nunca el enum en runtime del cliente
// Prisma) porque este módulo se importa tanto desde Server Components/
// actions como desde componentes "use client" (RespuestaChecklistItem.tsx,
// DocumentoCheckItem.tsx) — solo necesita los strings.

/** Los 8 valores, en el orden en que se muestran en la pantalla de novedad genérica. */
export const TIPOS_NOVEDAD: TipoNovedad[] = [
  "RAYON",
  "RAYON_FUERTE",
  "ABOLLADURA",
  "GOLPE_FUERTE",
  "FALLA",
  "DANO",
  "FALTANTE",
  "VENCIDO",
];

/**
 * Subconjunto para el ítem "Rayones": es literalmente el ítem de las
 * convenciones de dibujo de daños de carrocería del formato oficial, por
 * eso solo ofrece los 4 tipos relacionados a ese dibujo (no FALLA/DAÑO/
 * FALTANTE/VENCIDO, que no aplican a esa convención).
 */
export const TIPOS_NOVEDAD_CARROCERIA: TipoNovedad[] = [
  "RAYON",
  "RAYON_FUERTE",
  "ABOLLADURA",
  "GOLPE_FUERTE",
];

/**
 * Subconjunto para la categoría "Documentación" (SOAT, cédula, licencia,
 * etc.): ninguno de los 4 tipos de daño de carrocería aplica a un
 * documento — pedido del dueño de producto tras ver que "Reportar
 * problema" en un documento mostraba opciones de rayón/abolladura, que no
 * tienen sentido ahí.
 */
export const TIPOS_NOVEDAD_DOCUMENTO: TipoNovedad[] = ["VENCIDO", "DANO", "FALTANTE"];

/**
 * Subconjunto para el resto de ítems de "Inspección Visual" que no son daño
 * de carrocería (luces, direccionales, luz de reversa, espejos, llantas):
 * mismo criterio que ya usa el propio formato oficial para estos ítems en
 * su columna de resultado ("FALLA, DAÑO, FALTANTE") — no tiene sentido
 * ofrecer Rayón/Abolladura/Golpe fuerte para un espejo o una luz.
 */
export const TIPOS_NOVEDAD_FUNCIONAL: TipoNovedad[] = ["FALLA", "DANO", "FALTANTE"];

/**
 * Ítems de "Inspección Visual" cuya novedad es literalmente daño de
 * carrocería (mismo criterio que ya usa "Rayones", que tiene su propio flujo
 * inline con `pideUbicacion` y no pasa por `getTiposNovedadParaItem` — ver
 * app/(worker)/inspecciones/_components/RespuestaChecklistItem.tsx).
 */
const ITEMS_CARROCERIA = new Set(["Estado de la latonería"]);

/**
 * Decide qué subconjunto de tipos de novedad corresponde a un ítem puntual
 * del checklist — pedido del dueño de producto tras ver que "Luces Altas y
 * Bajas" ofrecía Rayón/Abolladura/Golpe fuerte junto con Falla/Daño/
 * Faltante/Vencido, sin relación con lo que se está preguntando. Usado por
 * `NovedadPage` (app/(worker)/inspecciones/[id]/checklist/[itemId]/novedad/page.tsx).
 */
export function getTiposNovedadParaItem(item: { nombre: string; category: { nombre: string } }): TipoNovedad[] {
  if (item.category.nombre === NOMBRE_CATEGORIA_DOCUMENTACION) {
    return TIPOS_NOVEDAD_DOCUMENTO;
  }
  if (ITEMS_CARROCERIA.has(item.nombre)) {
    return TIPOS_NOVEDAD_CARROCERIA;
  }
  return TIPOS_NOVEDAD_FUNCIONAL;
}

/** Etiquetas legibles en español para mostrar en la UI (trabajador y supervisor). */
export const TIPO_NOVEDAD_LABELS: Record<TipoNovedad, string> = {
  RAYON: "Rayón",
  RAYON_FUERTE: "Rayón fuerte",
  ABOLLADURA: "Abolladura",
  GOLPE_FUERTE: "Golpe fuerte",
  FALLA: "Falla",
  DANO: "Daño",
  FALTANTE: "Faltante",
  VENCIDO: "Vencido",
};
