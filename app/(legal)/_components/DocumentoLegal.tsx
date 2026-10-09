import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Marco común de los textos legales (términos y política de datos): título,
 * versión y un "Volver" al inicio. Son páginas públicas (ver
 * lib/auth/public-paths.ts), así que no usan el encabezado con sesión.
 */
export function DocumentoLegal({
  titulo,
  version,
  children,
}: {
  titulo: string;
  version: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <Link href="/" className="text-sm text-brand underline-offset-2 hover:underline">
        ← Volver
      </Link>
      <header>
        <h1 className="text-xl font-semibold text-ink">{titulo}</h1>
        <p className="mt-1 text-xs text-ink-muted">{version}</p>
      </header>
      {children}
    </main>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 text-sm leading-relaxed text-ink">
      <h2 className="text-base font-semibold text-ink">{titulo}</h2>
      {children}
    </section>
  );
}

export function Lista({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1 pl-5">{children}</ul>;
}
