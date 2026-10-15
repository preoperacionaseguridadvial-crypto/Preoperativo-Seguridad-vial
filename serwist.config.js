// @ts-check
// Serwist "configurator mode": bundler-agnostic (works with Turbopack, which
// Next.js 16 uses by default for both `next dev` and `next build`). This runs
// as a separate build step (see package.json "build" script) instead of
// hooking into webpack, which the classic `@serwist/next` plugin requires and
// Turbopack does not support.
import { serwist } from "@serwist/next/config";

export default serwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // No precachear páginas prerenderizadas: casi todas exigen sesión (p. ej.
  // /admin), y el service worker, instalado antes del login, guardaba la
  // página de login en su lugar y la servía desde el caché.
  precachePrerendered: false,
  // No precachear las imágenes de guía, documentación ni archivos de trabajo
  // de public/. Las imágenes se piden al usarlas (y el caché de imágenes en
  // tiempo de ejecución las guarda). Precachearlas hacía que el service
  // worker, instalado en la pantalla de login, guardara la página de login en
  // lugar de cada imagen; además, sacarlas del precache hace que los
  // celulares que ya tienen esa copia rota la descarten al actualizar.
  globIgnores: [
    "**/checklist/**",
    "**/estado-conductor/**",
    "**/fotos-guia/**",
    "**/fonts/**",
    "**/*.md",
    "**/*.xlsx",
  ],
});
