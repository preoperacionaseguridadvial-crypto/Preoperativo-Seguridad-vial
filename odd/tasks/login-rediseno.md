# Feature: login-rediseno

## Objective

Redesign the login page as a premium corporate screen matching the owner's mockup:
hero with the security team photo (left ~60%) and a floating white login card
(right ~40%), plus a working "Recordarme" and a "¿Olvidaste tu contraseña?" notice.

## Problem

`app/login/page.tsx` is a plain white card on a flat blue background. The client
wants a branded, professional entry screen for the trials.

## Product rules (owner decisions, 2026-10-21)

- Visual reference: owner mockup (desktop 16:9). Background: clean team photo
  `public/login/equipo-seguridad.png`. Logo: `public/logo/ess-ltda.png`.
- Hero copy: "Preoperacional de" / "Seguridad Vial" (bright blue), subtitle
  "Gestione inspecciones, recorridos y aprobaciones desde una sola plataforma.",
  three benefits (Inspecciones / Control operativo / Seguimiento) and footer
  "CONDUCIMOS OPERACIONES MÁS SEGURAS".
- Card: logo, "Iniciar sesión", "Accede a la plataforma de Seguridad Vial",
  email (envelope icon, "tu@empresa.com"), password (lock icon, show/hide),
  "Recordarme" checkbox (checked by default), "¿Olvidaste tu contraseña?" link,
  big blue button with arrow, divider, "Acceso seguro" info box.
- Option A: "¿Olvidaste tu contraseña?" shows "Comuníquese con el Administrador
  del sistema para restablecer su contraseña." (no email reset).
- Option A: "Recordarme" is real: checked → session lasts 30 days (current
  default); unchecked → session ends when the browser is closed.
- The app is mobile-first (workers on phones): the page must work well on phones.

## Scope

Login page UI, password toggle, forgot-password notice, real "Recordarme".
Out of scope: password reset by email, other screens.

## Constraints

- TDD: enabled (user global config). Runner `npm test` (Vitest node env, `*.test.ts`
  only: no component tests; test the remember-me logic).
- Next.js 16 with breaking changes: read `node_modules/next/dist/docs/` first.
- Auth: next-auth with JWT strategy (`lib/auth/base-config.ts`, `lib/auth/config.ts`,
  `proxy.ts`).
- UI copy in neutral Spanish. No browser available: visual result unverified.
- Branch `feat/login-rediseno` stacked on `feat/horarios-sst`; push/merge are the
  owner's decision.
- Checks: `npx tsc --noEmit`, `npx eslint app lib`, `npm test`.

## Tasks

- [x] T1 — Login visual redesign (hero + card, responsive, show/hide password,
  forgot-password notice, background asset). Route: delegated (2+ files).
- [x] T2 — Real "Recordarme" (session ends on browser close when unchecked), with
  tests. Route: delegated together with T1 (same writer), committed separately.

## Acceptance criteria

- Desktop layout matches the mockup structure; phones show a usable, branded login.
- Show/hide password works; forgot link shows the administrator notice.
- Unchecked "Recordarme": closing the browser ends the session; checked: 30 days.
- Login errors still display.

## Progress

- Branch created; background image copied to `public/login/equipo-seguridad.png`.
- T2 done: marker cookie `ess-sesion-navegador` + token `recordar`, proxy signs out when recordar=false and marker missing (`sesionExpiradaPorNavegador`); legacy tokens count as remember. RED observed. Caveat: some mobile browsers restore session cookies.
- T1 done: hero + card (next/image preload), FormularioLogin client (toggle, forgot notice, recordar checked by default), mobile compact layout. Logo is 140x158 so hero renders it white; a bigger asset would look better.
- Checks: tsc, eslint, npm test 955 green (parent spot check). NOT browser-verified.

## Next step

Owner visual review in a browser/phone. Optional: higher-resolution logo asset.
