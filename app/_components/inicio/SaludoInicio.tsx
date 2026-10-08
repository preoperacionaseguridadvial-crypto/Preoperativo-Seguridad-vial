import type { Role, Sede } from "@/generated/prisma/client";
import { etiquetaUsuario } from "@/lib/auth/etiquetas-rol";
import { fechaLegible, primerNombre } from "@/lib/inicio/atajos";

/** Saludo de la pantalla de inicio: nombre, rol legible (con sede para el Recorredor) y fecha de hoy. */
export function SaludoInicio({
  nombre,
  rol,
  sede,
  ahora,
}: {
  nombre: string | null | undefined;
  rol: Role;
  /** Sede del Recorredor (solo aplica a TRABAJADOR). */
  sede?: Sede | null;
  ahora: Date;
}) {
  const primero = primerNombre(nombre);
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold text-ink">{primero ? `Hola, ${primero}` : "Hola"}</h1>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
        <span className="rounded-full bg-status-info-soft px-2 py-0.5 text-xs font-semibold text-status-info-ink">
          {etiquetaUsuario(rol, sede)}
        </span>
        <span>{fechaLegible(ahora)}</span>
      </p>
    </header>
  );
}
