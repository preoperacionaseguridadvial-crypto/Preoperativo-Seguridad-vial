import type { Role } from "@/generated/prisma/client";
import { etiquetaUsuario } from "@/lib/auth/etiquetas-rol";
import { fechaLegible } from "@/lib/inicio/atajos";
import { CerrarSesionForm } from "@/app/_components/CerrarSesionForm";
import { IconoCalendario, IconoPersonas } from "./IconosAprobador";

/** Inicio de aprobadores: saludo con nombre completo, rol y fecha, y cerrar sesión destacado. */
export function EncabezadoAprobador({
  nombre,
  rol,
  ahora,
}: {
  nombre: string | null | undefined;
  rol: Role;
  ahora: Date;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-3">
        <h1 className="text-3xl font-bold leading-tight text-[#0B2A4A] sm:text-4xl">
          Hola, {nombre?.trim() || "Usuario"}
        </h1>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#E3F0FB] px-3 py-1.5 font-semibold text-[#1565D8]">
            <IconoPersonas />
            {etiquetaUsuario(rol)}
          </span>
          <span className="inline-flex items-center gap-2">
            <IconoCalendario />
            {fechaLegible(ahora)}
          </span>
        </p>
      </div>
      <div className="shrink-0">
        <CerrarSesionForm destacado />
      </div>
    </header>
  );
}
