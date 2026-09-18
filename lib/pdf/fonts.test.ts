import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { esArchivoFuenteValido, fuentesPdfDisponibles, FONT_REGULAR_PATH, FONT_BOLD_PATH } from "@/lib/pdf/fonts";

// Fase soporte-moto-carro, Slice 5 (D1): Arial Narrow es propietaria y no
// tiene archivo redistribuible en este repo — se bundlea Liberation Sans
// Narrow (alternativa libre métricamente compatible, ver public/fonts/README.md
// para la fuente y licencia real verificadas) como Regular + Bold (el
// documento usa texto en negrita, ver InspeccionPdfDocument.tsx). Este test
// no renderiza ningún PDF: solo confirma que el bundling de archivos no está
// roto (archivo ausente o placeholder vacío) sin pagar el costo de un render
// completo — la prueba de render real vive en la verificación manual
// end-to-end de esta fase (no hay infra de test de PDF en este proyecto).
describe("esArchivoFuenteValido", () => {
  it("un TTF real bundleado (LiberationSansNarrow-Regular.ttf) es válido", () => {
    expect(esArchivoFuenteValido(FONT_REGULAR_PATH)).toBe(true);
  });

  it("una ruta que no existe no es válida", () => {
    const rutaInexistente = path.join(process.cwd(), "public", "fonts", "no-existe.ttf");
    expect(esArchivoFuenteValido(rutaInexistente)).toBe(false);
  });
});

describe("fuentesPdfDisponibles", () => {
  it("confirma que Regular y Bold están presentes y pesan bytes coherentes con un TTF real (no un placeholder vacío)", () => {
    expect(fuentesPdfDisponibles()).toBe(true);
    expect(fs.statSync(FONT_REGULAR_PATH).size).toBeGreaterThan(50_000);
    expect(fs.statSync(FONT_BOLD_PATH).size).toBeGreaterThan(50_000);
  });
});
