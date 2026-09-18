import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// Corrección Slice 5 (hallazgo WARNING reliability): `registrarFuentesPdf`
// llamaba a `Font.register` sin usar el guard `fuentesPdfDisponibles()` que
// ya existía en este mismo archivo — un TTF faltante/corrupto en el deploy
// solo se hubiera notado como una falla opaca de
// @react-pdf/renderer/fontkit en el momento real de `renderToBuffer`, para
// cada request de PDF. Se testea acá vía un wrapper: `Font.register` se
// mockea (no tiene sentido registrar una fuente real en un test unitario) y
// el estado interno de `registrado` (module-level, no exportado) se resetea
// con `vi.resetModules()` + re-import dinámico entre casos, para que cada
// test ejercite `registrarFuentesPdf` desde cero.
describe("registrarFuentesPdf — guarda con fuentesPdfDisponibles() antes de registrar", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("@react-pdf/renderer");
  });

  it("con los TTF bundleados reales (válidos), registra ambas familias vía Font.register", async () => {
    const registerMock = vi.fn();
    vi.doMock("@react-pdf/renderer", () => ({ Font: { register: registerMock } }));

    const { registrarFuentesPdf } = await import("@/lib/pdf/fonts");
    registrarFuentesPdf();

    expect(registerMock).toHaveBeenCalledTimes(2);
    expect(registerMock).toHaveBeenCalledWith(
      expect.objectContaining({ family: "Liberation Sans Narrow" }),
    );
    expect(registerMock).toHaveBeenCalledWith(
      expect.objectContaining({ family: "Liberation Sans Narrow Bold" }),
    );
  });

  it("si el TTF Regular falta/es inválido, NO llama a Font.register (evita el fallo opaco en renderToBuffer) y loguea una advertencia clara", async () => {
    const registerMock = vi.fn();
    vi.doMock("@react-pdf/renderer", () => ({ Font: { register: registerMock } }));
    const existsSyncSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { registrarFuentesPdf } = await import("@/lib/pdf/fonts");
    registrarFuentesPdf();

    expect(registerMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    existsSyncSpy.mockRestore();
  });
});
