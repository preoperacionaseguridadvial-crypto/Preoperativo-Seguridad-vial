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
});
