# Feature: autorizacion-datos

## Objective
Ask every user, once, on their first sign-in, to authorize the processing of their personal data (Ley 1581 de 2012) with a handwritten signature, and keep that record in the user's "hoja de vida".

## Problem / Why
User (2026-10-08): the app now publishes a data policy (`/privacidad`), but the policy alone is not enough. The law also requires the data subject's express authorization, above all for the health and alcohol declarations (sensitive data), and the app neither asks for it nor stores it.

## Scope (authorized by user: "debería darse una única vez cuando el usuario ingresa por primera vez a la app, autoriza y firma ... este registro queda en la hoja de vida de cada usuario")
- One-time screen `/autorizacion` after sign-in: summary of what is authorized, link to the policy, an explicit acceptance checkbox and a handwritten signature (reuses `FirmaCanvas`).
- Applies to every role. Users that already exist are asked on their next visit.
- Until authorized, the user cannot open any other page of the app (only the legal texts, sign-out and the authorization screen).
- The record (date, policy version, signature image) is immutable and shown in the user's hoja de vida (`/admin/usuarios/[id]/hoja-de-vida`).

## Out of scope
- Revoking an authorization from the app (the policy routes that request to ESS).
- Re-asking when the policy version changes (the version is stored so this can be added later).

## Constraints
- The gate must not add a database query to every request: `proxy.ts` stays free of Prisma (see `lib/auth/base-config.ts`). The gate reads a JWT claim.
- The claim must never be settable from the client: on a session update the server re-reads the database.
- Signature validation, storage and audit follow `lib/inspections/firma-actions.ts`.
- Next.js 16 (read `node_modules/next/dist/docs/` when unsure). Spanish UI copy, mobile-first.
- The legal wording is a draft pending a lawyer's review.

## Tasks
- [x] T1 — Model `AutorizacionDatos` + migration (dev and test DBs) + server action `registrarAutorizacionDatos` + query, with integration tests (route: inline; one writer already holding the full context)
- [x] T2 — Session claim `autorizoDatos` (set at sign-in, refreshed from the DB on update) + proxy gate, with unit tests for the gate decision (route: inline)
- [x] T3 — `/autorizacion` page and form (checkbox + signature) (route: inline)
- [x] T4 — Hoja de vida: authorization section with date, version and signature (route: inline)

## Acceptance criteria
- A user without a record is sent to `/autorizacion` from any page and cannot use the app until signing.
- After signing, the user lands on the home page and is never asked again, including after signing out and in again.
- The hoja de vida shows the date, the policy version and the signature, or "Pendiente" when there is none.
- `/login`, `/terminos`, `/privacidad` and sign-out keep working without the authorization.
- tsc, eslint and `npm test` green; live check in a headless browser.

## Checks
TDD: strict / user global config / `npx vitest run`. RDD: off (global). Delivery strategy: ask-on-risk; forecast ~450 authored lines.

## Progress / evidence
- T1 (commit f7eb12e). RED: test file failed to import the missing module. GREEN: 13 tests. Migration `20261009014815_autorizacion_datos` applied to dev and test DBs. Note: Prisma 7 does not regenerate the client on `migrate dev`; `npx prisma generate` was needed.
- T2. `lib/auth/gate-autorizacion.ts` (pure decision), `lib/auth/jwt-autorizacion.ts` (claim; on session update it re-reads the DB and ignores the client payload), `proxy.ts` gate before the role check. RED: both test files failed to import. GREEN: 9 new unit tests; `proxy.test.ts` updated (existing RBAC cases now run as an authorized user) plus 9 gate cases.
- T3. `app/autorizacion/page.tsx` + `_components/FormularioAutorizacion.tsx` (checkbox, then `FirmaCanvas`). After signing, `unstable_update` refreshes the token and the user lands on `/`.
- T4. `getUsuarioPorId` includes the record; hoja de vida shows date, version and signature, or "Pendiente".
- Checks: tsc and eslint clean; `npm test` 59 files / 813 tests passed.
- Live (headless Chrome, 360 px, two temporary users, deleted afterwards): a new TRABAJADOR is held on the authorization screen from `/` and `/inspecciones`; `/privacidad` opens; no canvas until the checkbox is ticked; after signing lands on home, `/autorizacion` redirects to `/`, `/inspecciones` opens; sign-out and sign-in again goes straight to home. A new ADMINISTRADOR is gated too; after signing, the hoja de vida of the signed user shows date, version and the signature image, and an unsigned user shows "Pendiente". No console errors.
- Known cosmetic detail: right after sign-in the address bar shows `/` while the authorization screen is rendered (the sign-in redirect target is redirected by Proxy). Signing from there works.
- Pending outside the code: lawyer review of the wording; ESS LTDA contact details (NIT, address, e-mail, phone) for the policy.
- Engram mirror: pending (the Engram MCP server failed to connect in this session).
