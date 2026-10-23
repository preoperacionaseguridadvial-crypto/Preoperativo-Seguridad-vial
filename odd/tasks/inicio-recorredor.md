# Inicio del recorredor - rediseno

## Objective
Redesign the worker start screen `/inspecciones` following the user's mockup (2026-10-23), using the provided background `public/inspecciones/fondo-recorredor.webp`.

## Scope
- Header band over the background image: eyebrow "SEGURIDAD VIAL, SIEMPRE CONTIGO", title "Inspección preoperacional", subtitle "Revisa tu vehículo antes de salir a operar.", right tagline "CONDUCTORES MÁS SEGUROS / VÍAS MÁS SEGURAS".
- "Unidad asignada" card: vehicle photo (if available), yellow plate chip, type (Moto/Carro), brand/model · year · color, SOAT / Tecnomecánica status chips.
- Side card: "Duración estimada 5 – 7 min / 5 pasos para completar" and "Inspección obligatoria / Tu seguridad y la de todos empieza aquí."
- Full-width primary button "Iniciar inspección" (or "Continuar inspección" when one is in progress, as today).
- "Qué vas a revisar": 5 steps in the new flow order: Kilometraje; Checklist del vehículo (Documentos y revisión de cada ítem, N ítems); Declaración del conductor (3 preguntas); Fotos del vehículo (foto lateral y placa); Declaración final (si la unidad está en condiciones de operar).
- Keep every existing behavior: error banner (`?error=`), in-progress inspections and cancel, document alerts, no-vehicle state, out-of-hours handling.

## Constraints
- Strict TDD on for pure logic; `npm test`. Next.js 16 docs in `node_modules/next/dist/docs/`.

## Tasks
- [x] T1 - UI redesign of `/inspecciones` (+ pure helpers with tests if needed). Route: delegated writer.
- [x] T2 - Checks, live check as worker, commit.

- [x] T3 - Single worker home (user request 2026-10-23): TRABAJADOR lands directly on `/inspecciones` (redirect from `/`); `/inspecciones` absorbs what the old worker home showed (greeting + sede + date, "Últimas inspecciones", any other PanelTrabajador states) and gets a prominent "Cerrar sesión" below the hero. "Inicio" in the flow steps leads to `/inspecciones`. Diagnose the broken vehicle photo on the worker home. Route: delegated writer.

## Progress / evidence
- T1 2ea5113: page + BotonIniciarInspeccion rewritten, lib/inspections/pasos-inicio.ts (+test). RED (module missing) -> GREEN 4/4. npm test 1005 passed; tsc and lint clean.
- T2 live (temp workers tagged tmp-live-recorredor-*, cleaned up): MOTO 14 items, CARRO 16 items; hero, plate, chips, 5 steps, Iniciar button present. Not checked: rendered layout/mobile, in-progress Continuar button, ?error= banner.
- Deviations: big Continuar button added when a reusable inspection exists (duplicates list Continuar); no year field on Vehicle.
- Branch `feat/inicio-recorredor` from `feat/checklist-bueno-malo` @ def4495. Background converted to WebP (2000x667, 21 KB).

- T3 e79dc25: proxy + app/page.tsx redirect TRABAJADOR / -> /inspecciones (rutaInicioPorRol); /inspecciones gains greeting/sede/date, Cerrar sesion, Tu ultima inspeccion, Ultimas inspecciones; AppHeader hrefInicio; PanelTrabajador/TarjetaVehiculo removed; FotoVehiculo onError fallback. RED->GREEN; 1024 tests; tsc/lint clean; live 307 for worker, 200 for SST. Broken photo = dev env S3_PUBLIC_ENDPOINT points to an old LAN IP (192.168.1.7), not a repo bug.

## Next step
User visual check on localhost; push/PR order: checklist-bueno-malo then inicio-recorredor (stacked).
