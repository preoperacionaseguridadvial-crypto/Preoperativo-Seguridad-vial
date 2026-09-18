import fs from "node:fs";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

// Fase soporte-moto-carro, Slice 5 (D1 — ver proposal/design del cambio).
// El formato oficial FO-SVS-23 pide Arial Narrow, pero es una fuente
// propietaria de Microsoft sin archivo redistribuible en este repo ni
// licencia de embedding confirmada. Se usa Liberation Sans Narrow, la
// alternativa libre métricamente compatible con Arial Narrow, descargada del
// release oficial del proyecto (tag 1.07.6):
// https://github.com/liberationfonts/liberation-sans-narrow/releases/tag/1.07.6
//
// Licencia real verificada (ver public/fonts/README.md para el detalle
// completo): la EULA "LIBERATION FONT SOFTWARE" de Red Hat — GNU GPL v2 más
// una excepción explícita de incrustación de fuente (cláusula 1(a) de
// License.txt del release): incrustar esta fuente en un documento (como los
// PDF que genera este sistema) no hace que el documento resultante quede
// bajo GPL. Importante: esto NO es la licencia SIL OFL 1.1 que se asumió
// inicialmente en la propuesta del cambio — Liberation Sans/Serif/Mono
// migraron a OFL en la versión 2.x del proyecto, pero la variante "Narrow"
// vive en un repo aparte (liberationfonts/liberation-sans-narrow) que nunca
// migró y sigue en 1.07.6 bajo la EULA de Red Hat. Se documenta acá con
// precisión porque es una decisión de licenciamiento (D1), no un detalle de
// implementación.
export const FONT_FAMILY_REGULAR = "Liberation Sans Narrow";
export const FONT_FAMILY_BOLD = "Liberation Sans Narrow Bold";

// Mismo patrón que LOGO_PATH (lib/pdf/InspeccionPdfDocument.tsx): ruta
// absoluta de filesystem resuelta desde process.cwd(), nunca una URL remota
// — @react-pdf/renderer/fontkit lee el archivo directamente.
export const FONT_REGULAR_PATH = path.join(
  process.cwd(),
  "public",
  "fonts",
  "LiberationSansNarrow-Regular.ttf",
);
export const FONT_BOLD_PATH = path.join(
  process.cwd(),
  "public",
  "fonts",
  "LiberationSansNarrow-Bold.ttf",
);

/**
 * `true` si la ruta apunta a un archivo real y no vacío/placeholder. Umbral
 * de 50KB elegido por ser muy inferior al tamaño real de cualquiera de los 2
 * TTF bundleados (~110-130KB cada uno) pero muy superior a lo que pesaría un
 * archivo vacío o un placeholder de texto accidental.
 */
export function esArchivoFuenteValido(rutaAbsoluta: string): boolean {
  return fs.existsSync(rutaAbsoluta) && fs.statSync(rutaAbsoluta).size > 50_000;
}

/** `true` si ambos TTF (Regular y Bold) están presentes y son válidos. */
export function fuentesPdfDisponibles(): boolean {
  return esArchivoFuenteValido(FONT_REGULAR_PATH) && esArchivoFuenteValido(FONT_BOLD_PATH);
}

let registrado = false;

/**
 * Registra la familia tipográfica del PDF una sola vez por proceso —
 * @react-pdf/renderer no distingue registros repetidos, pero evitarlos es
 * más barato que reprocesar el TTF en cada request del route handler
 * (app/api/inspecciones/[id]/pdf/route.ts). Llamada a nivel de módulo desde
 * InspeccionPdfDocument.tsx, igual que la lectura de LOGO_PATH.
 */
export function registrarFuentesPdf(): void {
  if (registrado) return;
  Font.register({ family: FONT_FAMILY_REGULAR, src: FONT_REGULAR_PATH });
  Font.register({ family: FONT_FAMILY_BOLD, src: FONT_BOLD_PATH });
  registrado = true;
}
