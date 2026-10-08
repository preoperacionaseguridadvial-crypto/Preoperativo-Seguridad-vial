import "server-only";
import type { RespuestaChecklist } from "@/generated/prisma/client";
import { Role, Sede, TipoFirma } from "@/generated/prisma/enums";
import { etiquetaRol } from "@/lib/auth/etiquetas-rol";
import { PLACEHOLDER_FECHA_VIGENCIA } from "@/lib/settings/queries";

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
      // Corrección Slice 5 (hallazgo WARNING resilience): "⚠" (U+26A0) no
      // está mapeado ni en Liberation Sans Narrow (fuente bundleada, ver
      // lib/pdf/fonts.ts) ni en la tabla WIN_ANSI_MAP de fallback de
      // @react-pdf/pdfkit — muy probablemente rendereaba como glifo
      // faltante/en blanco. Se retira el símbolo y se confía en el color
      // ámbar + negrita (estilo "warn") + la palabra misma para transmitir
      // la advertencia, sin depender de que ningún glifo Unicode especial
      // esté presente en la fuente.
      return { texto: "BAJO", estilo: "warn" };
    case "MALO":
      return { texto: "X MALO", estilo: "falla" };
    case "FALLA":
    default:
      return { texto: "X FALLA, DAÑO, FALTANTE", estilo: "falla" };
  }
}

/**
 * Texto + bandera para el campo "Fecha vigencia" del encabezado del PDF
 * (fase soporte-moto-carro, Slice 4, ADR A5, corrección CRITICAL #1). Antes
 * de este fix, `data.fechaVigencia` se imprimía tal cual en el documento
 * oficial firmado sin ningún resguardo: si ningún Administrador configuró
 * todavía la fecha real, el placeholder sembrado por el seed
 * (`PLACEHOLDER_FECHA_VIGENCIA`) se veía indistinguible de una fecha real
 * configurada — nadie generando o revisando el PDF lo notaría
 * necesariamente. Cuando `valor` es el placeholder, se le agrega un marcador
 * inequívoco ("(SIN CONFIGURAR)") para que el componente lo distinga y lo
 * pinte con el mismo lenguaje visual de advertencia que ya usa
 * `itemValorWarn` (ítems TRIESTADO en BAJO) en vez de inventar un estilo
 * nuevo.
 */
export function formatFechaVigenciaPdf(valor: string): { texto: string; esPlaceholder: boolean } {
  const esPlaceholder = valor === PLACEHOLDER_FECHA_VIGENCIA;
  return {
    texto: esPlaceholder ? `${valor} (SIN CONFIGURAR)` : valor,
    esPlaceholder,
  };
}

/**
 * Busca la foto diaria de un tipo (LATERAL/PLACA) dentro del arreglo de
 * `data.fotos` (fase soporte-moto-carro, Slice 5, A7) — `null` si esa foto
 * todavía no se subió. Genérica en el tipo de elemento (no depende de la
 * forma exacta del objeto foto con URL firmada) para no acoplar esta función
 * pura al tipo de Prisma/queries.
 */
export function fotoPorTipo<T extends { tipo: string }>(fotos: T[], tipo: string): T | null {
  return fotos.find((foto) => foto.tipo === tipo) ?? null;
}

/**
 * Texto Sí/No/— para una respuesta booleana-o-sin-responder de la
 * declaración de estado del conductor (fase soporte-moto-carro, Slice 5,
 * A6) — mismo criterio que `siNoOTexto` en
 * app/(supervisor)/aprobaciones/[id]/page.tsx, reimplementado acá como
 * función pura y testeable en vez de importar desde un Server Component.
 */
export function formatSiNoPdf(valor: boolean | null): string {
  if (valor === null) return "—";
  return valor ? "Sí" : "No";
}

export type CajaFirmaPdf = {
  tipo: TipoFirma;
  /** Rótulo oficial, en mayúsculas como el resto del formato. */
  titulo: string;
  /** Ancho de la caja dentro de la fila de firmas (los anchos de una fila suman 100). */
  anchoPct: number;
};

// Proporciones del Excel oficial para dos firmas (A:C = 32.10 y D:F = 37.89
// sobre 69.99); con tres, el ancho se reparte parejo para que el cargo más
// largo ("DIRECTOR DE OPERACIONES") parta en dos líneas en vez de desbordar.
const ANCHO_DOS_FIRMAS = [46, 54];
const ANCHO_TRES_FIRMAS = [34, 33, 33];

const tituloFirma = (rol: Role) => `NOMBRE Y FIRMA DEL ${etiquetaRol(rol).toUpperCase()}`;

/**
 * Cajas de firma del FO-SVS-23 según la sede de la inspección (roles-oleariari):
 * Oleariari pasa por dos aprobadores (conductor, Supervisor Oleariari y Director
 * de Operaciones); Bogotá —y una legacy sin sede— por uno (conductor y
 * Director de Operaciones). Puro y testeable; el componente solo las dibuja.
 */
export function cajasFirmaPdf(sede: Sede | null | undefined): CajaFirmaPdf[] {
  const conductor = { tipo: TipoFirma.CONDUCTOR, titulo: "NOMBRE Y FIRMA DEL CONDUCTOR" };
  const director = { tipo: TipoFirma.SUPERVISOR, titulo: tituloFirma(Role.SUPERVISOR) };
  if (sede === Sede.OLEARIARI) {
    const cajas = [
      conductor,
      { tipo: TipoFirma.SUPERVISOR_OLEARIARI, titulo: tituloFirma(Role.SUPERVISOR_OLEARIARI) },
      director,
    ];
    return cajas.map((caja, i) => ({ ...caja, anchoPct: ANCHO_TRES_FIRMAS[i] }));
  }
  return [conductor, director].map((caja, i) => ({ ...caja, anchoPct: ANCHO_DOS_FIRMAS[i] }));
}

/**
 * Líneas "Observación del ..." de la caja de estado del PDF. La del
 * Supervisor Oleariari se muestra siempre que exista (aunque la inspección siga
 * pendiente del Director); la del Director, solo una vez decidida.
 */
export function observacionesAprobacionPdf(data: {
  status: string;
  sede: Sede | null;
  observacionesSupervisor: string | null;
  observacionesSupervisorOleariari: string | null;
}): string[] {
  const lineas: string[] = [];
  if (data.sede === Sede.OLEARIARI && data.observacionesSupervisorOleariari) {
    lineas.push(`Observación del ${etiquetaRol(Role.SUPERVISOR_OLEARIARI)}: ${data.observacionesSupervisorOleariari}`);
  }
  if ((data.status === "APROBADA" || data.status === "RECHAZADA") && data.observacionesSupervisor) {
    lineas.push(`Observación del ${etiquetaRol(Role.SUPERVISOR)}: ${data.observacionesSupervisor}`);
  }
  return lineas;
}
