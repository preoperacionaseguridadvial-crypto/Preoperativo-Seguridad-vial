"use client";

import { useState } from "react";

const PLACEHOLDER_SRC = "/checklist/_placeholder.svg";

/**
 * Muestra la foto de referencia de un ítem del checklist (o de una medida
 * directa como kilometraje/combustible/presión) para que el trabajador
 * asocie visualmente sobre qué parte de la moto se le está preguntando
 * (feedback del dueño de producto: la pantalla de ítem le parecía "muy
 * básica" sin apoyo visual).
 *
 * Las fotos reales las sube el usuario más adelante a public/checklist/
 * (ver README ahí). Mientras un archivo no exista, `onError` hace fallback
 * automático a un placeholder SVG neutro — sin este fallback la pantalla se
 * rompe con el ícono de imagen rota del navegador, porque algunos slugs de
 * `ChecklistItem.imagenesUrl` apuntan a archivos que todavía no existen.
 *
 * Se usa <img> nativo (no next/image): el catálogo de imágenes es dinámico
 * (0-N por ítem vía `imagenesUrl`, ver GaleriaReferencia) y el fallback de
 * carga con onError es más directo así, sin depender de la config de
 * optimización de imágenes.
 */
export function ImagenReferencia({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [currentSrc, setCurrentSrc] = useState(src);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- src dinámico por ítem con fallback onError; ver comentario del componente.
    <img
      src={currentSrc}
      alt={alt}
      onError={() => {
        if (currentSrc !== PLACEHOLDER_SRC) {
          setCurrentSrc(PLACEHOLDER_SRC);
        }
      }}
      className={`w-full rounded-lg border border-[#D9E2EA] bg-white object-contain ${className}`}
    />
  );
}
