import { signOut } from "@/lib/auth/config";

/**
 * Botón de cerrar sesión (server action): vuelve siempre a /login.
 * `destacado`: botón sólido con sombra, para ubicarlo sobre el banner de inicio.
 */
export function CerrarSesionForm({ destacado = false }: { destacado?: boolean }) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className={
          destacado
            ? "flex min-h-10 items-center gap-2 rounded-full bg-[#0B2A4A] px-4 text-sm font-semibold text-white shadow-lg ring-1 ring-white/40 hover:bg-[#123a63] active:bg-[#0B2A4A]"
            : "flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-brand active:bg-page"
        }
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4M10 8l-4 4 4 4M6 12h10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Cerrar sesión
      </button>
    </form>
  );
}
