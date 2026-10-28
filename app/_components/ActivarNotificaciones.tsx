"use client";

import { useCallback, useEffect, useState } from "react";
import {
  derivarEstado,
  esDispositivoIos,
  urlBase64ToUint8Array,
  type EstadoNotificaciones,
} from "@/lib/notificaciones/cliente";

const CLAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const ENDPOINT = "/api/notificaciones/suscripcion";

type Lectura = Pick<Parameters<typeof derivarEstado>[0], "soportado" | "esIos" | "standalone" | "permiso" | "suscrito">;

async function registroDelServiceWorker() {
  // `ready` nunca resuelve si el service worker no se registró (desarrollo);
  // getRegistration devuelve undefined y se informa como error.
  return navigator.serviceWorker.getRegistration();
}

async function leerDispositivo(): Promise<Lectura> {
  const soportado = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const esIos = esDispositivoIos(navigator.userAgent, navigator.maxTouchPoints);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  let suscrito = false;
  if (soportado) {
    const registro = await registroDelServiceWorker();
    suscrito = (await registro?.pushManager.getSubscription()) != null;
  }
  return { soportado, esIos, standalone, permiso: soportado ? Notification.permission : null, suscrito };
}

async function enviar(method: "POST" | "DELETE", cuerpo: unknown) {
  const res = await fetch(ENDPOINT, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

/**
 * Tarjeta "Notificaciones" del inicio: permite activar o desactivar los avisos
 * push en este dispositivo. El permiso hay que pedirlo con un toque del usuario
 * (lo exige iOS), por eso no se activa sola. Sin clave VAPID pública no se muestra.
 */
export function ActivarNotificaciones() {
  const [estado, setEstado] = useState<EstadoNotificaciones | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    const lectura = await leerDispositivo();
    setEstado(derivarEstado({ clavePublica: CLAVE_PUBLICA, ...lectura }));
  }, []);

  useEffect(() => {
    // Lee el navegador (no existe en el servidor); el estado inicial es null.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refrescar().catch(() => setEstado("no-soportado"));
  }, [refrescar]);

  async function activar() {
    if (!CLAVE_PUBLICA) return;
    setOcupado(true);
    setError(null);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso === "granted") {
        const registro = await registroDelServiceWorker();
        if (!registro) throw new Error("El servicio de la app aún no está listo. Recargue e intente de nuevo.");
        const suscripcion =
          (await registro.pushManager.getSubscription()) ??
          (await registro.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(CLAVE_PUBLICA),
          }));
        await enviar("POST", suscripcion.toJSON());
      }
    } catch (e) {
      setError(e instanceof Error && e.message.startsWith("El servicio") ? e.message : "No se pudieron activar las notificaciones. Intente de nuevo.");
    } finally {
      await refrescar().catch(() => {});
      setOcupado(false);
    }
  }

  async function desactivar() {
    setOcupado(true);
    setError(null);
    try {
      const registro = await registroDelServiceWorker();
      const suscripcion = await registro?.pushManager.getSubscription();
      if (suscripcion) {
        // Primero el servidor: si falla, la suscripción local sigue y se puede reintentar.
        await enviar("DELETE", { endpoint: suscripcion.endpoint });
        await suscripcion.unsubscribe();
      }
    } catch {
      setError("No se pudieron desactivar las notificaciones. Intente de nuevo.");
    } finally {
      await refrescar().catch(() => {});
      setOcupado(false);
    }
  }

  if (estado === null || estado === "oculto") return null;

  const boton =
    "flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold disabled:opacity-60 sm:w-auto";

  return (
    <section
      aria-label="Notificaciones"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm"
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold text-ink">Notificaciones</h2>
        <p className="text-sm text-ink-muted">{TEXTOS[estado]}</p>
      </div>

      {estado === "inactivas" && (
        <button type="button" onClick={activar} disabled={ocupado} className={`${boton} bg-brand text-white`}>
          {ocupado ? "Activando..." : "Activar notificaciones"}
        </button>
      )}
      {estado === "activas" && (
        <button type="button" onClick={desactivar} disabled={ocupado} className={`${boton} border border-border text-brand`}>
          {ocupado ? "Desactivando..." : "Desactivar en este dispositivo"}
        </button>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-status-crit-soft px-3 py-2 text-sm text-status-crit-ink">
          {error}
        </p>
      )}
    </section>
  );
}

const TEXTOS: Record<Exclude<EstadoNotificaciones, "oculto">, string> = {
  inactivas: "Active los avisos para enterarse de inmediato de las inspecciones, sin abrir la aplicación.",
  activas: "Las notificaciones están activas en este dispositivo.",
  bloqueadas:
    "Las notificaciones están bloqueadas. Para recibirlas, habilítelas para esta aplicación en los ajustes de notificaciones de su teléfono o navegador y vuelva a abrir esta pantalla.",
  "no-soportado": "Este dispositivo o navegador no admite notificaciones.",
  "ios-sin-instalar": "Agregue la app a la pantalla de inicio para recibir notificaciones.",
};
