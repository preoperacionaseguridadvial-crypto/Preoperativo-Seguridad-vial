import Image from "next/image";
import Link from "next/link";
import { IconoReloj } from "@/app/_components/inicio/Iconos";
import { INDICACION_HABILITACION, TEXTOS_BLOQUEO, type MotivoPantallaBloqueo } from "@/lib/horarios/textos-bloqueo";

// Pantalla que reemplaza la pantalla de error genérica de Next cuando la
// regla de horario (ventanas de inspección o plazo de aprobación) bloquea al
// usuario. Presentacional y sin imports de servidor: sirve desde páginas del
// servidor y desde `error.tsx`. Tema SST/ESS, pensada para celular.
export function PantallaBloqueoHorario({
  motivo,
  href,
  etiquetaBoton = "Volver al inicio",
  children,
}: {
  motivo: MotivoPantallaBloqueo;
  /** Destino del botón principal: el inicio del rol. */
  href: string;
  etiquetaBoton?: string;
  /** Acciones secundarias (p. ej. "Reintentar" en los `error.tsx`). */
  children?: React.ReactNode;
}) {
  const { titulo, mensaje } = TEXTOS_BLOQUEO[motivo];
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-8 text-center">
      <Image
        src="/logo/ess-ltda.png"
        alt="Escort Security Services"
        width={140}
        height={158}
        className="h-20 w-auto mix-blend-multiply"
      />
      <div className="flex size-16 items-center justify-center rounded-full bg-status-crit-soft text-status-crit-ink">
        <IconoReloj className="size-8" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 role="alert" className="text-xl font-semibold text-[#0B3B60]">
          {titulo}
        </h1>
        <p className="text-sm text-ink-muted">{mensaje}</p>
      </div>
      <p className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium text-ink shadow-sm">
        {INDICACION_HABILITACION}
      </p>
      <div className="flex w-full flex-col gap-3">
        <Link
          href={href}
          className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-brand px-5 text-base font-semibold text-white shadow-md transition active:opacity-90"
        >
          {etiquetaBoton}
        </Link>
        {children}
      </div>
    </main>
  );
}
