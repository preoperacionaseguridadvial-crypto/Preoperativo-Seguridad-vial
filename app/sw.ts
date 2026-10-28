/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Service worker source for Serwist (built by `serwist build` into
// public/sw.js — see serwist.config.js and the "build" script in
// package.json). Registered client-side by <SerwistProvider> in app/layout.tsx.
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// Notificaciones push (ver lib/notificaciones/push.ts, que arma el payload
// `{ titulo, cuerpo, url, tag? }`). Se lee de forma defensiva: un payload
// ilegible igual muestra una notificación genérica, porque con
// `userVisibleOnly` el navegador exige mostrar algo por cada push.
type PayloadPush = { titulo?: string; cuerpo?: string; url?: string; tag?: string };

self.addEventListener("push", (event) => {
  let payload: PayloadPush = {};
  try {
    payload = (event.data?.json() ?? {}) as PayloadPush;
  } catch {
    payload = { cuerpo: event.data?.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.titulo || "Preoperacional ESS", {
      body: payload.cuerpo,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag,
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(
    (event.notification.data as { url?: string } | null)?.url || "/",
    self.location.origin,
  );

  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Solo ventanas de esta misma app: si hay una abierta se reutiliza.
      const existente = ventanas.find((v) => new URL(v.url).origin === destino.origin);
      if (existente) {
        await existente.focus();
        if ("navigate" in existente) await existente.navigate(destino.href);
        return;
      }
      await self.clients.openWindow(destino.href);
    })(),
  );
});
