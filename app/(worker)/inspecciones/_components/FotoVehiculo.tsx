"use client";

import { useState } from "react";
import { IconoCarro, IconoMoto } from "@/app/_components/inicio/Iconos";

/**
 * Foto del vehículo con respaldo: si la URL firmada no carga (objeto ausente,
 * enlace vencido, almacenamiento inalcanzable) se muestra el ícono moto/carro
 * en vez del texto alternativo roto.
 */
export function FotoVehiculo({ url, placa, esCarro }: { url: string | null; placa: string; esCarro: boolean }) {
  const [fallo, setFallo] = useState(false);

  if (!url || fallo) {
    return (
      <span
        aria-hidden
        className="flex h-32 w-full shrink-0 items-center justify-center rounded-xl bg-status-info-soft text-status-info-ink sm:h-36 sm:w-56"
      >
        {esCarro ? <IconoCarro className="size-16" /> : <IconoMoto className="size-16" />}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, no candidata a next/image remoto.
    <img
      src={url}
      alt={`Foto del vehículo ${placa}`}
      onError={() => setFallo(true)}
      className="h-44 w-full shrink-0 rounded-xl border border-border bg-page object-cover sm:h-36 sm:w-56"
    />
  );
}
