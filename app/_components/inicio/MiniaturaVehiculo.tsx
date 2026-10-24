"use client";

import { useState } from "react";
import { IconoCarro, IconoMoto } from "./Iconos";

/** Miniatura del vehículo con respaldo al ícono moto/carro si no hay foto o no carga. */
export function MiniaturaVehiculo({ url, placa, esCarro }: { url: string | null; placa: string; esCarro: boolean }) {
  const [fallo, setFallo] = useState(false);

  if (!url || fallo) {
    return (
      <span
        aria-hidden
        className="flex size-24 shrink-0 items-center justify-center rounded-xl bg-status-info-soft text-status-info-ink sm:size-28"
      >
        {esCarro ? <IconoCarro className="size-12" /> : <IconoMoto className="size-12" />}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, no candidata a next/image remoto.
    <img
      src={url}
      alt={`Foto del vehículo ${placa}`}
      loading="lazy"
      onError={() => setFallo(true)}
      className="size-24 shrink-0 rounded-xl border border-border bg-page object-cover sm:size-28"
    />
  );
}
