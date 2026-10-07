import Link from "next/link";
import type { Atajo } from "@/lib/inicio/atajos";
import { IconoDeAtajo } from "./Iconos";

/** Atajos del rol: baldosas de 2 columnas en el celular. */
export function AtajosInicio({ atajos, titulo = "Accesos" }: { atajos: Atajo[]; titulo?: string }) {
  if (atajos.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{titulo}</h2>
      <ul className="grid grid-cols-2 gap-3">
        {atajos.map((atajo) => (
          <li key={`${atajo.href}-${atajo.titulo}`}>
            <Link
              href={atajo.href}
              className="flex h-full min-h-28 flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-sm transition-colors active:bg-page"
            >
              <span
                aria-hidden
                className="flex size-10 items-center justify-center rounded-lg bg-status-info-soft text-status-info-ink"
              >
                <IconoDeAtajo icono={atajo.icono} />
              </span>
              <span className="text-sm font-semibold text-ink">{atajo.titulo}</span>
              <span className="text-xs text-ink-muted">{atajo.descripcion}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
