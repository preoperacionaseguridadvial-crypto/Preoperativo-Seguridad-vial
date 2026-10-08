"use client";

import { useEffect, useReducer, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { comprimirFotoEnNavegador } from "@/lib/imagenes/adaptador-navegador";
import {
  ESTADO_INICIAL_SUBIDA,
  MENSAJE_ERROR_SUBIDA,
  estaOcupada,
  interpretarRespuestaSubida,
  reducirSubida,
  textoProgreso,
} from "@/lib/imagenes/progreso-subida";

type Props = {
  inspectionId: string;
  tipo: "lateral" | "placa";
  titulo: string;
  /** Ya existe una foto de este tipo guardada en el servidor. */
  existe: boolean;
  /** URL firmada de lectura de la foto guardada (o `null` si no se pudo firmar). */
  urlMiniatura: string | null;
  /** Guía visual opcional (ver GuiaFoto), se muestra bajo el título. */
  guia?: ReactNode;
};

/**
 * Subida de una foto diaria con progreso real. Reemplaza al formulario con
 * server action (que no permite medir el avance): la foto se comprime en el
 * navegador (`comprimirFotoEnNavegador`) y se envía por `XMLHttpRequest` a
 * `POST /inspecciones/[id]/fotos/[tipo]/subir`, que sí expone
 * `upload.onprogress`. Estados: "Optimizando foto…" (indeterminado) ->
 * "Subiendo NN %" -> "✓ Foto guardada" (luego `router.refresh()` para que
 * aparezca "Continuar" cuando están las dos fotos). La lógica de estados vive
 * en lib/imagenes/progreso-subida.ts (probada); acá solo hay DOM y red.
 *
 * Sin JavaScript no hay compresión ni progreso, así que no se mantiene un
 * respaldo con server action: la app (Next.js + PWA) ya exige JS en todo el
 * flujo, y un envío sin comprimir fallaría contra el tope de 8 MB.
 */
export function SubirFotoInspeccion({ inspectionId, tipo, titulo, existe, urlMiniatura, guia }: Props) {
  const router = useRouter();
  const [estado, despachar] = useReducer(reducirSubida, ESTADO_INICIAL_SUBIDA);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [miniaturaRota, setMiniaturaRota] = useState(false);
  // Foto ya optimizada: permite "Reintentar" sin volver a comprimir.
  const [archivoListo, setArchivoListo] = useState<File | null>(null);
  // Guarda contra re-entrada síncrona (el estado se actualiza en el siguiente render).
  const enCurso = useRef(false);
  const xhrActual = useRef<XMLHttpRequest | null>(null);

  // La vista previa es un object URL: se libera al cambiarla y al desmontar.
  useEffect(() => {
    return () => {
      if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
    };
  }, [vistaPrevia]);

  useEffect(() => {
    return () => xhrActual.current?.abort();
  }, []);

  const ocupada = estaOcupada(estado);
  const guardada = estado.fase === "guardada" || existe;
  const imagen = vistaPrevia ?? (miniaturaRota ? null : urlMiniatura);

  function subir(archivo: File): Promise<void> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhrActual.current = xhr;
      const cuerpo = new FormData();
      cuerpo.set("file", archivo);

      const fallar = (mensaje: string) => {
        despachar({ tipo: "error", mensaje });
        resolve();
      };
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) despachar({ tipo: "progreso", cargado: e.loaded, total: e.total });
      };
      xhr.onload = () => {
        const resultado = interpretarRespuestaSubida(xhr.status, xhr.responseText);
        if (!resultado.ok) return fallar(resultado.error);
        despachar({ tipo: "completada" });
        // Recarga los datos del servidor: miniatura guardada y botón "Continuar".
        router.refresh();
        resolve();
      };
      xhr.onerror = () => fallar("Sin conexión: no se pudo subir la foto. Revisá tu señal e intentá de nuevo.");
      xhr.ontimeout = () => fallar("La subida tardó demasiado. Revisá tu señal e intentá de nuevo.");
      xhr.onabort = () => resolve();
      xhr.timeout = 120_000;
      xhr.open("POST", `/inspecciones/${inspectionId}/fotos/${tipo}/subir`);
      xhr.setRequestHeader("Accept", "application/json");
      xhr.send(cuerpo);
    });
  }

  async function alElegir(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const original = input.files?.[0];
    // Permite volver a elegir el mismo archivo más tarde.
    input.value = "";
    if (!original || enCurso.current) return;

    enCurso.current = true;
    despachar({ tipo: "elegida" });
    setVistaPrevia(URL.createObjectURL(original));
    setMiniaturaRota(false);
    setArchivoListo(null);
    try {
      const listo = await comprimirFotoEnNavegador(original);
      setArchivoListo(listo);
      despachar({ tipo: "optimizada" });
      await subir(listo);
    } catch {
      despachar({ tipo: "error", mensaje: MENSAJE_ERROR_SUBIDA });
    } finally {
      enCurso.current = false;
    }
  }

  async function reintentar() {
    const archivo = archivoListo;
    if (!archivo || enCurso.current) return;
    enCurso.current = true;
    despachar({ tipo: "reintentar" });
    try {
      await subir(archivo);
    } finally {
      enCurso.current = false;
    }
  }

  const texto = textoProgreso(estado);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-ink">{titulo}</h2>

      {guia}

      {imagen && (
        // eslint-disable-next-line @next/next/no-img-element -- Vista previa local (blob:) o URL firmada temporal, no candidata a next/image remoto.
        <img
          src={imagen}
          alt={titulo}
          onError={() => {
            if (!vistaPrevia) setMiniaturaRota(true);
          }}
          className="aspect-[4/3] w-full rounded-md border border-border bg-viz-track object-cover"
        />
      )}

      {ocupada && (
        <div
          role="progressbar"
          aria-label={titulo}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={estado.fase === "subiendo" ? estado.porcentaje : undefined}
          aria-valuetext={texto ?? undefined}
          className="relative h-14 w-full overflow-hidden rounded-md bg-viz-track"
        >
          <div
            className={`absolute inset-y-0 left-0 ${
              estado.fase === "optimizando"
                ? "w-full animate-pulse bg-brand/30"
                : "bg-brand/40 transition-[width] duration-200"
            }`}
            style={estado.fase === "subiendo" ? { width: `${estado.porcentaje}%` } : undefined}
          />
          <span className="relative flex h-full items-center justify-center px-4 text-base font-semibold text-ink">
            {texto}
          </span>
        </div>
      )}

      {!ocupada && estado.fase === "error" && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-md bg-status-crit-soft px-3 py-3 text-sm text-status-crit-ink"
        >
          <p>{estado.mensaje}</p>
          {archivoListo && (
            <button
              type="button"
              onClick={reintentar}
              className="min-h-14 w-full rounded-md bg-status-crit-ink px-4 py-4 text-base font-semibold text-white"
            >
              Reintentar
            </button>
          )}
        </div>
      )}

      {!ocupada && guardada && estado.fase !== "error" && (
        <p role="status" className="text-sm font-medium text-status-ok-ink">
          ✓ Foto guardada
        </p>
      )}

      {!ocupada && (
        <label
          className={`block min-h-14 w-full cursor-pointer rounded-md px-4 py-4 text-center text-base font-semibold ${
            guardada
              ? "border border-brand bg-surface text-brand hover:bg-brand/5"
              : "bg-[#2E9BD6] text-white hover:bg-[#2E9BD6]/90"
          }`}
        >
          {estado.fase === "error" ? "Tomar otra foto" : guardada ? "Cambiar foto" : "Tomar foto"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={alElegir}
          />
        </label>
      )}
    </section>
  );
}
