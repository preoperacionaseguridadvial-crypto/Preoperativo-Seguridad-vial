import Link from "next/link";
import type { Atajo } from "@/lib/inicio/atajos";
import { IconoDeAtajo } from "./Iconos";

function IconoFlechaRedonda() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** SST: tarjetas grandes de acceso rápido (3 columnas en pantalla ancha, apiladas en el celular). */
export function AccesosRapidosSst({ atajos }: { atajos: Atajo[] }) {
  if (atajos.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold text-[#0B2A4A]">Accesos rápidos</h2>
        <p className="text-sm text-ink-muted">Selecciona una opción para continuar.</p>
      </div>
      <ul className="grid gap-4 lg:grid-cols-3">
        {atajos.map((atajo) => (
          <li key={`${atajo.href}-${atajo.titulo}`}>
            <Link
              href={atajo.href}
              className="group flex h-full items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <span
                aria-hidden
                className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#E3F0FB] text-[#1565D8]"
              >
                <IconoDeAtajo icono={atajo.icono} className="size-7" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-semibold text-[#0B2A4A]">{atajo.titulo}</span>
                <span className="text-sm text-ink-muted">{atajo.descripcion}</span>
              </span>
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1565D8] text-white transition-transform group-hover:translate-x-0.5"
              >
                <IconoFlechaRedonda />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
