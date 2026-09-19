import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Las imágenes de public/checklist y public/estado-conductor se sirven tal
// cual (<img> nativo, sin next/image) y se abren en el celular del trabajador,
// muchas veces con datos móviles: pesar MB por imagen hace lenta cada pantalla
// del recorrido. Para optimizar una imagen nueva: `npm run imagenes:optimizar`.
const CARPETAS = ["public/checklist", "public/estado-conductor"];
const MAX_KB = 400;

const imagenes = CARPETAS.flatMap((carpeta) =>
  readdirSync(join(process.cwd(), carpeta))
    .filter((archivo) => /\.(jpe?g|png|webp)$/i.test(archivo))
    .map((archivo) => ({ ruta: `${carpeta}/${archivo}`, archivo })),
);

const esJpeg = (bytes: Buffer) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
const esPng = (bytes: Buffer) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

// WebP: "RIFF" + tamaño (4 bytes) + "WEBP".
const esWebp = (bytes: Buffer) => bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP";
const formatoCorrecto = (ruta: string, bytes: Buffer) =>
  /\.png$/i.test(ruta) ? esPng(bytes) : /\.webp$/i.test(ruta) ? esWebp(bytes) : esJpeg(bytes);

describe("imágenes servidas al trabajador", () => {
  it("hay imágenes que revisar", () => {
    expect(imagenes.length).toBeGreaterThan(0);
  });

  it.each(imagenes)(`$ruta pesa como máximo ${MAX_KB} KB`, ({ ruta }) => {
    const kb = statSync(join(process.cwd(), ruta)).size / 1024;
    expect(kb).toBeLessThanOrEqual(MAX_KB);
  });

  it.each(imagenes)("$ruta tiene el formato que dice su extensión (no un PNG renombrado a .jpg)", ({ ruta }) => {
    const bytes = readFileSync(join(process.cwd(), ruta));
    expect(formatoCorrecto(ruta, bytes)).toBe(true);
  });
});
