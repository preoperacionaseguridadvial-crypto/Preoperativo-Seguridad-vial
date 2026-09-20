import { describe, expect, it } from "vitest";
import {
  MAX_ADJUNTO_NOVEDAD_BYTES,
  MAX_FIRMA_BYTES,
  MAX_FOTO_INSPECCION_BYTES,
  PERFIL_ADJUNTO_NOVEDAD,
  PERFIL_FIRMA,
  PERFIL_FOTO_INSPECCION,
  validarArchivo,
} from "@/lib/storage/validar-archivo";

// Buffers mínimos con los magic bytes reales de cada formato (no son archivos
// decodificables, solo la firma que el validador inspecciona).
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP"),
  Buffer.from("VP8 "),
]);
const PDF = Buffer.from("%PDF-1.7\n%âãÏÓ\n", "latin1");
const GIF = Buffer.from("GIF89a\x01\x00\x01\x00", "latin1");
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

function archivo(contenido: BlobPart, tipo: string, nombre = "archivo.bin"): File {
  return new File([contenido], nombre, { type: tipo });
}

describe("validarArchivo — foto de inspección (JPEG/PNG/WebP, 8 MB)", () => {
  it.each([
    ["image/jpeg", JPEG, "jpg"],
    ["image/png", PNG, "png"],
    ["image/webp", WEBP, "webp"],
  ])("acepta %s con su firma real y deriva contentType/extensión del tipo validado", async (tipo, bytes, extension) => {
    const resultado = await validarArchivo(archivo(bytes, tipo), PERFIL_FOTO_INSPECCION);

    expect(resultado.contentType).toBe(tipo);
    expect(resultado.extension).toBe(extension);
    expect(resultado.buffer.equals(bytes)).toBe(true);
  });

  it("ignora el nombre del archivo: la extensión sale del tipo validado, nunca de file.name", async () => {
    const resultado = await validarArchivo(archivo(PNG, "image/png", "foto.php.exe"), PERFIL_FOTO_INSPECCION);

    expect(resultado.extension).toBe("png");
  });

  it("normaliza el tipo declarado (mayúsculas y parámetros)", async () => {
    const resultado = await validarArchivo(
      archivo(JPEG, "IMAGE/JPEG; charset=binary"),
      PERFIL_FOTO_INSPECCION,
    );

    expect(resultado.contentType).toBe("image/jpeg");
  });

  it.each([
    ["image/gif", GIF],
    ["image/svg+xml", SVG],
    ["image/heic", JPEG],
    ["application/pdf", PDF],
    ["", JPEG],
  ])("rechaza el tipo declarado %j aunque empiece por image/ o el contenido parezca válido", async (tipo, bytes) => {
    await expect(validarArchivo(archivo(bytes, tipo), PERFIL_FOTO_INSPECCION)).rejects.toThrow(
      /JPG, PNG o WEBP/,
    );
  });

  it.each([
    ["JPEG declarado, contenido PNG", "image/jpeg", PNG],
    ["PNG declarado, contenido JPEG", "image/png", JPEG],
    ["WebP declarado, contenido JPEG", "image/webp", JPEG],
    ["JPEG declarado, contenido GIF", "image/jpeg", GIF],
    ["JPEG declarado, contenido SVG", "image/jpeg", SVG],
    ["JPEG declarado, contenido texto", "image/jpeg", Buffer.from("contenido-de-prueba")],
    ["JPEG declarado, contenido PDF", "image/jpeg", PDF],
  ])("rechaza contenido que no coincide con el tipo declarado: %s", async (_caso, tipo, bytes) => {
    await expect(validarArchivo(archivo(bytes, tipo), PERFIL_FOTO_INSPECCION)).rejects.toThrow(
      /no coincide|no corresponde/i,
    );
  });

  it("rechaza un RIFF que no es WebP (ej. WAV)", async () => {
    const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WAVE")]);

    await expect(validarArchivo(archivo(wav, "image/webp"), PERFIL_FOTO_INSPECCION)).rejects.toThrow(
      /no coincide|no corresponde/i,
    );
  });

  it("rechaza un archivo demasiado corto para tener firma", async () => {
    await expect(
      validarArchivo(archivo(Buffer.from([0xff, 0xd8]), "image/jpeg"), PERFIL_FOTO_INSPECCION),
    ).rejects.toThrow(/no coincide|no corresponde/i);
  });

  it("acepta un archivo justo en el límite de tamaño y rechaza uno que lo supera", async () => {
    const enElLimite = Buffer.alloc(MAX_FOTO_INSPECCION_BYTES);
    JPEG.copy(enElLimite);
    await expect(
      validarArchivo(archivo(enElLimite, "image/jpeg"), PERFIL_FOTO_INSPECCION),
    ).resolves.toMatchObject({ extension: "jpg" });

    const excedido = Buffer.alloc(MAX_FOTO_INSPECCION_BYTES + 1);
    JPEG.copy(excedido);
    await expect(
      validarArchivo(archivo(excedido, "image/jpeg"), PERFIL_FOTO_INSPECCION),
    ).rejects.toThrow(/no puede superar 8 MB/);
  });

  it("el tamaño se valida antes que el contenido (no lee archivos enormes)", async () => {
    const excedido = new File([new Uint8Array(MAX_FOTO_INSPECCION_BYTES + 1)], "x.jpg", {
      type: "image/jpeg",
    });

    // Sin firma JPEG: si primero validara el contenido, el mensaje sería otro.
    await expect(validarArchivo(excedido, PERFIL_FOTO_INSPECCION)).rejects.toThrow(/no puede superar/);
  });
});

describe("validarArchivo — firma (solo PNG, 1 MB)", () => {
  it("acepta PNG real", async () => {
    const resultado = await validarArchivo(archivo(PNG, "image/png"), PERFIL_FIRMA);

    expect(resultado).toMatchObject({ contentType: "image/png", extension: "png" });
  });

  it.each([
    ["image/jpeg", JPEG],
    ["image/webp", WEBP],
    ["image/gif", GIF],
    ["image/svg+xml", SVG],
    ["application/pdf", PDF],
  ])("rechaza %s", async (tipo, bytes) => {
    await expect(validarArchivo(archivo(bytes, tipo), PERFIL_FIRMA)).rejects.toThrow(/PNG/);
  });

  it("rechaza un PNG declarado cuyo contenido es otro formato", async () => {
    await expect(validarArchivo(archivo(SVG, "image/png"), PERFIL_FIRMA)).rejects.toThrow(
      /no coincide|no corresponde/i,
    );
  });

  it("rechaza una firma que supera 1 MB", async () => {
    const excedida = Buffer.alloc(MAX_FIRMA_BYTES + 1);
    PNG.copy(excedida);

    await expect(validarArchivo(archivo(excedida, "image/png"), PERFIL_FIRMA)).rejects.toThrow(
      /no puede superar 1 MB/,
    );
  });
});

describe("validarArchivo — adjunto de novedad (imágenes + PDF, 8 MB)", () => {
  it.each([
    ["image/jpeg", JPEG, "jpg"],
    ["image/png", PNG, "png"],
    ["image/webp", WEBP, "webp"],
    ["application/pdf", PDF, "pdf"],
  ])("acepta %s", async (tipo, bytes, extension) => {
    const resultado = await validarArchivo(archivo(bytes, tipo), PERFIL_ADJUNTO_NOVEDAD);

    expect(resultado).toMatchObject({ contentType: tipo, extension });
  });

  it.each([
    ["image/gif", GIF],
    ["image/svg+xml", SVG],
    ["text/html", Buffer.from("<html></html>")],
    ["application/zip", Buffer.from([0x50, 0x4b, 0x03, 0x04])],
  ])("rechaza %s", async (tipo, bytes) => {
    await expect(validarArchivo(archivo(bytes, tipo), PERFIL_ADJUNTO_NOVEDAD)).rejects.toThrow(
      /imagen.*PDF/i,
    );
  });

  it("rechaza un PDF falso (declara PDF pero el contenido es una imagen) y una imagen falsa (declara imagen pero es PDF)", async () => {
    await expect(validarArchivo(archivo(JPEG, "application/pdf"), PERFIL_ADJUNTO_NOVEDAD)).rejects.toThrow(
      /no coincide|no corresponde/i,
    );
    await expect(validarArchivo(archivo(PDF, "image/jpeg"), PERFIL_ADJUNTO_NOVEDAD)).rejects.toThrow(
      /no coincide|no corresponde/i,
    );
  });

  it("rechaza un adjunto que supera 8 MB (imagen o PDF)", async () => {
    const pdfGrande = Buffer.alloc(MAX_ADJUNTO_NOVEDAD_BYTES + 1);
    PDF.copy(pdfGrande);

    await expect(
      validarArchivo(archivo(pdfGrande, "application/pdf"), PERFIL_ADJUNTO_NOVEDAD),
    ).rejects.toThrow(/no puede superar 8 MB/);
  });
});
