import type { Role } from "@/generated/prisma/client";
import { etiquetaRol, fechaLegible, primerNombre } from "@/lib/inicio/atajos";

/** Saludo de la pantalla de inicio: nombre, rol legible y fecha de hoy. */
export function SaludoInicio({
  nombre,
  rol,
  ahora,
}: {
  nombre: string | null | undefined;
  rol: Role;
  ahora: Date;
}) {
  const primero = primerNombre(nombre);
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold text-ink">{primero ? `Hola, ${primero}` : "Hola"}</h1>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
        <span className="rounded-full bg-status-info-soft px-2 py-0.5 text-xs font-semibold text-status-info-ink">
          {etiquetaRol(rol)}
        </span>
        <span>{fechaLegible(ahora)}</span>
      </p>
    </header>
  );
}
