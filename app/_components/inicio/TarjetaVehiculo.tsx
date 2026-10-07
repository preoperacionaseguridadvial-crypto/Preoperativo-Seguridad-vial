import type { TipoVehiculo } from "@/generated/prisma/client";
import { CLASES_TONO } from "@/lib/inicio/accion-trabajador";
import { chipsDocumentosVehiculo, type FechasVehiculo } from "@/lib/inicio/vencimientos-vehiculo";
import { IconoCarro, IconoMoto } from "./Iconos";

type Props = {
  placa: string;
  tipoVehiculo: TipoVehiculo | null;
  marca?: string | null;
  modelo?: string | null;
  color?: string | null;
  /** URL firmada de la foto; null/undefined cae al ícono moto/carro. */
  fotoUrl?: string | null;
  vencimientos: FechasVehiculo;
  ahora: Date;
};

/**
 * Tarjeta del vehículo del trabajador: foto (o ícono), placa estilo placa
 * amarilla, tipo, marca/modelo/color y chips de SOAT y tecnomecánica. La usan
 * el inicio del trabajador y la pantalla de inicio de inspección, para que
 * se vean igual. Mismo lenguaje visual que la lista de aprobaciones.
 */
export function TarjetaVehiculo({ placa, tipoVehiculo, marca, modelo, color, fotoUrl, vencimientos, ahora }: Props) {
  const esCarro = tipoVehiculo === "CARRO";
  const descripcion = [marca, modelo, color].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 shadow-sm">
      <div className="flex items-center gap-3">
        {fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, no candidata a next/image remoto.
          <img
            src={fotoUrl}
            alt={`Foto del vehículo ${placa}`}
            className="size-20 shrink-0 rounded-lg border border-border bg-page object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-status-info-soft text-status-info-ink"
          >
            {esCarro ? <IconoCarro /> : <IconoMoto />}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-ink/20 bg-[#fde047] px-2 py-0.5 font-mono text-base font-bold tracking-wider text-ink">
              {placa}
            </span>
            <span className="text-xs text-ink-muted">{esCarro ? "Carro" : "Moto"}</span>
          </div>
          {descripcion && <span className="truncate text-sm text-ink">{descripcion}</span>}
        </div>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {chipsDocumentosVehiculo(vencimientos, ahora).map((chip) => (
          <li key={chip.documento}>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CLASES_TONO[chip.tono]}`}>
              {chip.texto}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
