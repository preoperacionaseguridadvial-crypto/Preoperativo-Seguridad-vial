"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// setTimeout guarda el retardo en 32 bits con signo: más de esto dispara de inmediato.
const MAX_RETARDO_MS = 2 ** 31 - 1;

/**
 * Aviso que aparece solo (sin recargar) cuando se cierra el horario de la
 * inspección en curso. Recibe los milisegundos restantes calculados en el
 * servidor para no depender del reloj del dispositivo. El layout de `[id]`
 * persiste entre pasos, así que el temporizador sigue corriendo al navegar.
 */
export function AvisoCierreHorario({ msRestantes, hora }: { msRestantes: number; hora: string }) {
  const [vencido, setVencido] = useState(msRestantes <= 0);
  const pathname = usePathname();

  useEffect(() => {
    if (msRestantes <= 0) return;
    const temporizador = setTimeout(() => setVencido(true), Math.min(msRestantes, MAX_RETARDO_MS));
    return () => clearTimeout(temporizador);
  }, [msRestantes]);

  // Tras enviar, el layout puede quedar en caché: la pantalla final no lleva aviso.
  if (!vencido || pathname.endsWith("/enviada")) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-20 border-b-2 border-red-700 bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-md"
    >
      Superó el horario de las {hora} para realizar la inspección. Comuníquese con la Administradora SST
      para que la habilite y pueda enviarla fuera de horario.
    </div>
  );
}
