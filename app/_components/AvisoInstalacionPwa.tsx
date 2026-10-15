"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  CLAVE_DESCARTE,
  debeMostrarAviso,
  detectarPlataforma,
  type Plataforma,
} from "@/app/_components/instalacion-pwa";

/** Evento no estándar de Chrome/Edge en Android; TypeScript no lo trae. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function leerDescarte(): number | null {
  try {
    const valor = window.localStorage.getItem(CLAVE_DESCARTE);
    return valor ? Number(valor) : null;
  } catch {
    return null;
  }
}

function guardarDescarte() {
  try {
    window.localStorage.setItem(CLAVE_DESCARTE, String(Date.now()));
  } catch {
    // Modo incógnito o almacenamiento bloqueado: el aviso volverá a salir.
  }
}

function estaInstalada(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari en iOS no soporta display-mode; expone navigator.standalone.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Plataforma si corresponde mostrar el aviso, o null. Se calcula una vez por
 * carga (las condiciones no cambian mientras la página está abierta); en el
 * servidor es null para que el HTML inicial no incluya el banner.
 */
function leerPlataformaAMostrar(): Plataforma | null {
  const plataforma = detectarPlataforma(window.navigator.userAgent);
  const mostrar = debeMostrarAviso({
    plataforma,
    instalada: estaInstalada(),
    descartadoEn: leerDescarte(),
    ahora: Date.now(),
  });
  return mostrar ? plataforma : null;
}

const sinSuscripcion = () => () => {};

/**
 * Banner inferior que invita a instalar la PWA desde el celular (se monta una
 * sola vez en app/layout.tsx). En Android usa el diálogo nativo del navegador
 * (`beforeinstallprompt`); en iPhone, donde Apple no permite ese diálogo,
 * explica cómo hacerlo con "Compartir → Agregar a inicio". No aparece en
 * escritorio, con la app ya instalada ni durante unos días tras cerrarlo.
 */
export function AvisoInstalacionPwa() {
  const plataforma = useSyncExternalStore(sinSuscripcion, leerPlataformaAMostrar, () => null);
  const [eventoInstalar, setEventoInstalar] = useState<BeforeInstallPromptEvent | null>(null);
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    if (plataforma !== "android") return;
    function alPoderInstalar(evento: Event) {
      evento.preventDefault();
      setEventoInstalar(evento as BeforeInstallPromptEvent);
    }
    function alInstalar() {
      setCerrado(true);
    }
    window.addEventListener("beforeinstallprompt", alPoderInstalar);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alPoderInstalar);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, [plataforma]);

  // En Android se espera a que el navegador confirme que se puede instalar;
  // en iOS no hay evento: se muestran las instrucciones de una vez.
  const visible = plataforma !== null && !cerrado && (plataforma !== "android" || eventoInstalar !== null);
  if (!visible) return null;

  function cerrar() {
    guardarDescarte();
    setCerrado(true);
  }

  async function instalar() {
    if (!eventoInstalar) return;
    await eventoInstalar.prompt();
    const { outcome } = await eventoInstalar.userChoice;
    if (outcome === "dismissed") guardarDescarte();
    setEventoInstalar(null);
    setCerrado(true);
  }

  return (
    <div
      role="dialog"
      aria-labelledby="aviso-instalacion-titulo"
      className="fixed inset-x-0 bottom-0 z-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex max-w-md items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element -- ícono estático del manifest */}
        <img src="/icons/icon-192.png" alt="" width={44} height={44} className="rounded-lg" />
        <div className="flex-1 text-sm text-ink">
          <p id="aviso-instalacion-titulo" className="font-semibold">
            Instala la aplicación
          </p>
          {plataforma === "android" && (
            <p className="mt-0.5 text-ink-muted">Ábrela desde tu pantalla de inicio, como cualquier app.</p>
          )}
          {plataforma === "ios" && (
            <p className="mt-0.5 text-ink-muted">
              Toca <span className="font-semibold text-ink">Compartir</span> (el cuadro con la flecha) y luego{" "}
              <span className="font-semibold text-ink">Agregar a inicio</span>.
            </p>
          )}
          {plataforma === "ios-otro-navegador" && (
            <p className="mt-0.5 text-ink-muted">
              Abre esta página en <span className="font-semibold text-ink">Safari</span> y toca Compartir →
              Agregar a inicio.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            {plataforma === "android" && (
              <button
                type="button"
                onClick={instalar}
                className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-brand px-3 font-semibold text-white active:opacity-90"
              >
                Instalar
              </button>
            )}
            <button
              type="button"
              onClick={cerrar}
              className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-border px-3 font-medium text-ink-muted active:bg-page"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
