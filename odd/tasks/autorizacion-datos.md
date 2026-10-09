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
- [ ] T1 — Model `AutorizacionDatos` + migration (dev and test DBs) + server action `registrarAutorizacionDatos` + query, with integration tests (route: inline; one writer already holding the full context)
- [ ] T2 — Session claim `autorizoDatos` (set at sign-in, refreshed from the DB on update) + proxy gate, with unit tests for the gate decision (route: inline)
- [ ] T3 — `/autorizacion` page and form (checkbox + signature) (route: inline)
- [ ] T4 — Hoja de vida: authorization section with date, version and signature (route: inline)

## Acceptance criteria
- A user without a record is sent to `/autorizacion` from any page and cannot use the app until signing.
- After signing, the user lands on the home page and is never asked again, including after signing out and in again.
- The hoja de vida shows the date, the policy version and the signature, or "Pendiente" when there is none.
- `/login`, `/terminos`, `/privacidad` and sign-out keep working without the authorization.
- tsc, eslint and `npm test` green; live check in a headless browser.

## Checks
TDD: strict / user global config / `npx vitest run`. RDD: off (global). Delivery strategy: ask-on-risk; forecast ~450 authored lines.

## Progress / evidence
See the commits on `feat/autorizacion-datos`. Engram mirror: pending (the Engram MCP server failed to connect in this session).
