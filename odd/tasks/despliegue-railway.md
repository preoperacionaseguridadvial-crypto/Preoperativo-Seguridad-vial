# Feature: despliegue-railway

## Objective
Make the repo deployable on Railway (Hobby plan) with Postgres on Railway and photos/documents on Cloudflare R2 (free tier).

## Problem / Why
User (2026-10-14) decided to deploy online: working through `next dev` + a quick tunnel caused hangs on the phone. Phase 1 review found blockers for a clean server build and an unsafe seed:
- `generated/` (Prisma client) is gitignored and no script runs `prisma generate`, so `npm ci && npm run build` fails on a clean machine.
- `prisma/seed.ts` creates 8 demo users with a known password plus demo vehicles.
- `prisma/seed.ts` `limpiarDatosDePruebaObsoletos()` deletes ALL photos, novedades and checklist responses on every run. Running it in production would wipe real inspections.

## Scope (authorized: "procedamos con la etapa 2" of the agreed plan)
- Build generates the Prisma client.
- Seed has a production mode: catalog + settings only, no demo users/vehicles, no data cleanup.
- Deployment doc with Railway/R2 steps, env vars and commands.
- Out of scope: creating accounts, secrets, running anything against production.

## Constraints
- TDD strict, runner `npx vitest run`.
- Dev workflow unchanged (`npm run prisma:seed` locally keeps demo data).
- Never put secrets in the repo.

## Tasks
- [x] T1 — `prisma generate` in the build (route: inline, mechanical package.json change). Also `db:desplegar` script, `tsx`/`dotenv` moved to dependencies (needed at runtime by `prisma.config.ts` and the seed if devDependencies are pruned), `engines.node` = `22.x`.
- [x] T2 — Seed production mode (route: inline, one non-trivial file + small pure module with tests)
- [x] T3 — `docs/despliegue-railway.md` (route: inline, doc)

## Acceptance criteria
- `npm run build` works after deleting `generated/`.
- In production mode the seed never creates demo users/vehicles and never deletes inspection data.
- tsc, eslint, `npx vitest run` green.

## Progress
- 2026-10-15: branch `chore/despliegue-railway` from main `050da9e`.
- TDD: strict, source: user config, runner `npx vitest run`.
  - RED: `npx vitest run prisma/seed-modo.test.ts` -> failed (module `./seed-modo` missing).
  - GREEN: same command -> 5 passed.
- Verification:
  - `SEED_MODO=produccion npx prisma db seed` on the dev DB: catalog + settings only; Photo count unchanged (3), User count unchanged (11).
  - `DATABASE_URL= npx prisma generate`: works without a DB URL.
  - `rm -rf generated && npm run build`: exit 0 (Prisma client generated, Next build, Serwist precache 80 URLs).
  - `npx vitest run`: 60 files, 823 passed. `npx tsc --noEmit`: clean. eslint on seed files: clean.
- RDD off.
- Pending (user): accounts, secrets and Railway/R2 configuration; first admin user command is a follow-up.
