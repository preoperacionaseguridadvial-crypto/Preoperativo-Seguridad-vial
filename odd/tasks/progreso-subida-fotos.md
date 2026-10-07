# Feature: progreso-subida-fotos

## Objective
On the "Fotos del vehículo" step, show real upload progress and a thumbnail of each photo, so the worker on a phone can see that the photo was taken, uploaded and saved.

## Problem / Why
User (2026-10-07, real phone: Android 10, Chrome 154): after taking both photos the screen "se quedó cargando" and the photos "no cargan". Evidence: both uploads reached the server (POST 200, ~300 ms) and were saved (DB rows LATERAL/PLACA; MinIO objects ~146 KB JPEG each, so client compression works on a real phone). The page shows only "✓ Foto adjuntada" with no image, and the button only swaps its text ("Procesando foto…" / "Subiendo foto…"), with no progress feedback. Signed read URLs point to `localhost:9010` (S3_ENDPOINT), which a phone cannot reach in dev.

## Scope (authorized by user: "la idea es que el botón de subir la foto se vea como una barra de progreso")
- Upload with real progress: the button turns into a progress bar with three states: "Optimizando foto…" (indeterminate), "Subiendo NN %" (real, from XMLHttpRequest `upload.onprogress`), "✓ Foto guardada". A clear error state with retry on failure.
- A thumbnail of each photo: an instant local preview (object URL) while uploading, then the stored photo (signed URL) after the page refreshes.
- Dev-only reachability: optional env `S3_PUBLIC_ENDPOINT`, used ONLY to presign read URLs (falls back to `S3_ENDPOINT`). The upload/write client is unchanged.
- Scope is the fotos step (`app/(worker)/inspecciones/[id]/fotos`). The novedad photo page keeps working unchanged. Reuse is welcome if it's clean, but not required.

## Constraints
- Keep the server-side rules: `subirFotoInspeccion` (auth, ownership, EN_PROCESO only, validation, replace semantics, signature invalidation). The new route handler must call it; don't duplicate its logic.
- Keep client compression (`comprimirFotoEnNavegador`) before the upload, and keep `capture="environment"`.
- After a successful upload, refresh the route (`router.refresh()`) so "Continuar" appears when both photos exist.
- Next.js 16: read `node_modules/next/dist/docs/` for route handlers. `proxy.ts` / `lib/auth/route-roles.ts` must protect the new route for TRABAJADOR.
- TDD strict, runner `npx vitest run`. Mobile-first, Spanish UI copy, design tokens.
- The temporary diagnostics files (`app/api/dev-log/route.ts`, `app/_components/DevErrorReporter.tsx`, the reporter line in `app/layout.tsx`) are NOT part of this feature. Never stage them.

## Tasks
- [x] T1 — Route handler for photo upload with progress-friendly response + `S3_PUBLIC_ENDPOINT` presign support (route: delegated writer, 2+ non-trivial files)
- [x] T2 — Client upload component: progress bar states, local preview, error/retry; fotos page shows stored thumbnails

## Acceptance criteria
- On the phone, taking a photo shows a preview immediately, a bar advancing to 100 %, then "✓ Foto guardada" with the stored thumbnail.
- Wrong role / other user's inspection / non-EN_PROCESO → rejected, same as today.
- tsc, eslint, npm test green; live check with real uploads via the new route as trabajador (curl/Node multipart) and a headless Chrome run if feasible.

## Checks
TDD: strict / user global config / `npx vitest run`. RDD: off (global).

## Progress / evidence
- T1 (route: delegated writer). Route `POST /inspecciones/[id]/fotos/[tipo]/subir` (tipo = lateral|placa), under `/inspecciones` so proxy already restricts it to TRABAJADOR; no new map entry. Pure helper `lib/inspections/foto-upload-http.ts` (`parseTipoFoto`, `errorFotoAHttp`: 401/403/400, Prisma/AWS errors -> generic 500). `lib/storage/s3.ts`: `getSignedReadUrl` presigns with a second client when `S3_PUBLIC_ENDPOINT` is set.
  - RED: s3.test.ts 2 failed (host stayed localhost), route/helper suites failed to import. GREEN: 3 files, 17 tests passed. tsc and eslint clean.
- T1 commit: 67bb0cd.
- T2 (route: delegated writer). `lib/imagenes/progreso-subida.ts` (reducer, percentage, response parsing; 14 tests), client `SubirFotoInspeccion.tsx` (local preview, XHR progress, retry), fotos page shows signed thumbnails. No-JS server-action fallback dropped: compression and progress need JS, and an uncompressed upload would hit the 8 MB cap.
  - RED: progreso-subida.test.ts failed (module missing). GREEN: 14/14. tsc, eslint clean; npm test 45 files / 610 tests passed.
  - Live (temp worker, data deleted): route 200 for own EN_PROCESO (lateral, placa, replace); 404 bad tipo; 400 no file; 403 other worker and trabajador@ess.local; 400 ENVIADA; 307 to login without session. DB rows, S3 objects (141721 B JPEG) and audit rows confirmed. Headless Pixel 7 Chrome: Optimizando -> Subiendo NN % -> Guardando… -> Foto guardada, Continuar after both, abort of the XHR shows error + Reintentar -> saved.
  - User must add to `.env`: `S3_PUBLIC_ENDPOINT=http://192.168.1.7:9010`, then restart dev server.

## Next step
T1–T2 via one delegated writer on branch `feat/compresion-fotos`.
