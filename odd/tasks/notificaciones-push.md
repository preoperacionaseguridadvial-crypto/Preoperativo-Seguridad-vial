# Notificaciones push de inspecciones

## Objective
Web Push notifications (installed PWA, Android + iPhone iOS 16.4+) for inspection movements:
- Worker submits -> the approver(s) of the pending stage (Bogota/legacy: SUPERVISOR "Director de Operaciones"; Oleariari stage 1: SUPERVISOR_OLEARIARI; Oleariari stage 2 after supervisor review: SUPERVISOR).
- Approved / rejected -> the worker (recorredor) who did it.
- Administrador SST (role SST) -> ALL movements: submitted, Oleariari stage-1 review, approved, rejected.

## Problem / why
User request 2026-10-28: approvers must know a new inspection arrived without opening the app; workers must know the decision; SST wants full visibility.

## Decisions (parent, reversible)
- Standard Web Push with VAPID via `web-push` npm lib (3.6.7). No Firebase, no paid service.
- New Prisma model for push subscriptions (user, endpoint unique, keys, createdAt); one user may have several devices. Delete subscription on 404/410 from push service.
- Explicit "Activar notificaciones" button (user gesture required on iOS) visible to TRABAJADOR, SUPERVISOR, SUPERVISOR_OLEARIARI, SST; shows state (activas / bloqueadas / no soportado; on iOS not installed -> hint to add to home screen).
- Service worker (`app/sw.ts`, Serwist) handles `push` (show notification) and `notificationclick` (focus/open target URL: approver detail, worker inspection result, SST consulta detail).
- Sending never breaks or delays the business action: after the DB write succeeds, best-effort, errors logged, not thrown. Feature disabled gracefully when VAPID env vars are missing (local dev/tests).
- Env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:). Documented in `.env.example` and `docs/despliegue-railway.md`.
- In-app inbox remains the source of truth (push delivery is not guaranteed).

## Constraints
- Strict TDD; `npm test` (vitest), `npx tsc --noEmit`, `npm run lint`. Prisma: `npx prisma generate`, migration applied to test DB (`npm run prisma:migrate:test`) and dev DB.
- Next.js 16.3.1 has breaking changes: read `node_modules/next/dist/docs/` before using route handlers / server actions / `after`.
- Delivery strategy: ask-on-risk; forecast > 400 lines -> PR slicing decided with user at PR time; one work-unit commit per task.

## Tasks
- [x] T1 - Subscription model + migration + subscribe/unsubscribe endpoint + server send module (VAPID, cleanup 404/410) + tests. Route: delegated writer. Commit 52f08ca.
- [x] T2 - Service worker push/notificationclick + "Activar notificaciones" UI component + tests for pure parts. Route: delegated writer. Commit 6a5ab76.
- [x] T3 - Recipients + messages per event, wired into submit / Oleariari review / approve / reject actions (best-effort after success) + tests. Route: delegated writer. Commit 92e17b7.
- [x] T4 - Env/docs, parent spot check. Route: inline. Spot check found SSRF-lite risk (any https endpoint accepted, server POSTs to it) -> POST now only accepts push service hosts (fcm.googleapis.com, push.apple.com, push.services.mozilla.com, notify.windows.com). RED observed (2 failing), GREEN. Railway doc updated. `.env.example` not updated (read denied by local permission rule).

## Progress / evidence
- Branch `feat/notificaciones-push` from `main` @ ecdeebe.
- Migration `20261028130000_suscripciones_push` applied to test and dev DBs.
- Writer RED per task: T1/T2 import failures (missing modules), T3 6 wiring tests failing.
- Final checks (parent): `npm test` 88 files / 1153 green, `tsc --noEmit` clean, `npm run lint` clean. `npx serwist build` OK (writer).
- Deviation (accepted as more correct): Oleariari Director is notified when the stage-1 supervisor SIGNS (`guardarFirmaSupervisor`, event PENDIENTE_DIRECTOR), because the Director's queue only shows it after the signature; stage-1 approval notifies SST only.
- All active SUPERVISOR get Bogota/legacy submissions (queue has no sede filter). Worker URL `/inspecciones/<id>/enviada`.
- NOT verified: real push on Android/iPhone, permission flow in browser, production SW in browser, card rendering per home; no component test for ActivarNotificaciones; in dev the SW isn't registered so activating errors.
- Size: well above 400 lines across 4 commits; PR slicing decision with user at PR time.
- RDD: not run (review mode not assessed in this session).

## Next step
User: generate VAPID keys, set Railway vars, deploy, each user taps "Activar notificaciones", real-device test Android + iPhone.
