// Optimiza las imágenes de public/checklist y public/estado-conductor para que
// carguen rápido en el celular del trabajador (se sirven tal cual, sin
// next/image). Uso: `npm run imagenes:optimizar`.
//
// Solo procesa lo que no cumple (más de MAX_KB, o una extensión que no
// coincide con el contenido, p. ej. un PNG guardado como .jpg), así volver a
// ejecutarlo no degrada de nuevo las imágenes ya optimizadas. Mantiene nombre
// y ruta de cada archivo: la base de datos y el código no cambian.
//   .jpg  -> JPEG real (calidad 80, transparencias sobre blanco)
//   .png  -> PNG con paleta (conserva la transparencia)
//   .webp -> WebP (calidad 80)
// Lado máximo 1200 px (se ve nítido a 2x-3x en la pantalla del celular).
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const CARPETAS = ["public/checklist", "public/estado-conductor"];
const MAX_KB = 400; // mismo límite que test/public-images.test.ts
const LADO_MAXIMO = 1200;

const esJpeg = (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
const esPng = (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const esWebp = (bytes) => bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP";

let antesTotal = 0;
let despuesTotal = 0;

for (const carpeta of CARPETAS) {
  for (const archivo of readdirSync(carpeta)) {
    if (!/\.(jpe?g|png|webp)$/i.test(archivo)) continue;
    const ruta = join(carpeta, archivo);
    const original = readFileSync(ruta);
    const esPngEsperado = /\.png$/i.test(archivo);
    const esWebpEsperado = /\.webp$/i.test(archivo);
    const formatoCorrecto = esPngEsperado ? esPng(original) : esWebpEsperado ? esWebp(original) : esJpeg(original);
    const kbAntes = statSync(ruta).size / 1024;
    if (formatoCorrecto && kbAntes <= MAX_KB) continue;

    const base = sharp(original)
      .rotate() // respeta la orientación EXIF de las fotos de celular
      .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: "inside", withoutEnlargement: true });
    const resultado = esPngEsperado
      ? await base.png({ palette: true, quality: 80, compressionLevel: 9, effort: 10 }).toBuffer()
      : esWebpEsperado
        ? await base.flatten({ background: "#ffffff" }).webp({ quality: 80, effort: 6 }).toBuffer()
        : await base.flatten({ background: "#ffffff" }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();

    writeFileSync(ruta, resultado);
    antesTotal += kbAntes;
    despuesTotal += resultado.length / 1024;
    console.log(`${ruta.padEnd(46)} ${String(Math.round(kbAntes)).padStart(5)} KB -> ${String(Math.round(resultado.length / 1024)).padStart(4)} KB`);
  }
}

console.log(`Total: ${Math.round(antesTotal)} KB -> ${Math.round(despuesTotal)} KB`);
