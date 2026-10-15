// Genera los íconos de la PWA (los que muestra el celular al instalar la app)
// a partir del logo de ESS LTDA en public/logo/ess-ltda.png.
//
//   node scripts/generar-iconos.mjs
//
// El logo tiene fondo blanco, así que los íconos van sobre un cuadrado blanco.
// - "any": el logo ocupa ~80 % del lado.
// - "maskable": Android recorta el ícono en círculo o con esquinas
//   redondeadas; el contenido debe quedar dentro del 80 % central ("zona
//   segura"), por eso el logo ocupa ~60 % del lado.
// - apple-touch-icon (180 px): iOS no usa SVG ni el manifest para el ícono.
//
// El logo original mide 140x158 px: se amplía con lanczos3. Si ESS entrega el
// logo en mayor resolución (o SVG), reemplazar public/logo/ess-ltda.png y
// volver a correr este script.
import sharp from "sharp";

const ORIGEN = "public/logo/ess-ltda.png";
const BLANCO = { r: 255, g: 255, b: 255, alpha: 1 };

const ICONOS = [
  { archivo: "public/icons/icon-192.png", lado: 192, proporcion: 0.8 },
  { archivo: "public/icons/icon-512.png", lado: 512, proporcion: 0.8 },
  { archivo: "public/icons/icon-maskable-512.png", lado: 512, proporcion: 0.6 },
  { archivo: "public/icons/apple-touch-icon.png", lado: 180, proporcion: 0.8 },
];

for (const { archivo, lado, proporcion } of ICONOS) {
  const contenido = Math.round(lado * proporcion);
  const logo = await sharp(ORIGEN)
    .resize({ width: contenido, height: contenido, fit: "contain", background: BLANCO, kernel: "lanczos3" })
    .toBuffer();
  await sharp({ create: { width: lado, height: lado, channels: 4, background: BLANCO } })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(archivo);
  console.log(`OK ${archivo} (${lado}x${lado})`);
}
