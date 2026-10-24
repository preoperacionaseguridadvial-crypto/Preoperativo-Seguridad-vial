import Link from "next/link";
import type { Atajo } from "@/lib/inicio/atajos";
import { IconoDeAtajo, IconoFlecha } from "./Iconos";
import { IconoCuadricula } from "./IconosAprobador";

/** Aprobadores: accesos rápidos del rol en tarjetas (ícono, título y descripción, chevron). */
export function AccesosRapidosAprobador({ atajos }: { atajos: Atajo[] }) {
  if (atajos.length === 0) return null;
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-10 items-center justify-center rounded-xl bg-[#E3F0FB] text-[#1565D8]">
          <IconoCuadricula />
        </span>
        <div>
          <h2 className="text-lg font-bold text-[#0B2A4A]">Accesos rápidos</h2>
          <p className="text-sm text-ink-muted">Gestiona tus inspecciones de manera ágil y segura.</p>
        </div>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {atajos.map((atajo) => (
          <li key={`${atajo.href}-${atajo.titulo}`}>
            <Link
              href={atajo.href}
              className="flex h-full items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <span
                aria-hidden
                className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#E3F0FB] text-[#1565D8]"
              >
                <IconoDeAtajo icono={atajo.icono} className="size-7" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-bold text-[#0B2A4A]">{atajo.titulo}</span>
                <span className="text-sm text-ink-muted">{atajo.descripcion}</span>
              </span>
              <IconoFlecha />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
