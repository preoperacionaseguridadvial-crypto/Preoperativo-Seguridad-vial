import Link from "next/link";
import Image from "next/image";
import { CerrarSesionForm } from "@/app/_components/CerrarSesionForm";

/**
 * Encabezado compartido por los tres roles con flujo propio (trabajador,
 * supervisor, gestión/dirección): logo ESS LTDA + link de vuelta al inicio.
 * Vive en un solo lugar para que los tres layouts (`app/(worker)/inspecciones`,
 * `app/(supervisor)`, `app/(gestion)`) se vean exactamente igual — antes solo
 * existía inline en el layout del trabajador, por eso Supervisor/Director no
 * lo tenían.
 *
 * En la pantalla de inicio (`enInicio`) el link "← Inicio" no tiene sentido:
 * en su lugar va el botón de cerrar sesión.
 */
export function AppHeader({ enInicio = false }: { enInicio?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#D9E2EA] bg-white px-4 py-2">
      <Image
        src="/logo/ess-ltda.png"
        alt="ESS LTDA"
        width={140}
        height={158}
        className="h-7 w-auto object-contain"
        priority
      />
      {enInicio ? (
        <CerrarSesionForm />
      ) : (
        <Link href="/" className="text-sm text-[#005B96] hover:underline">
          ← Inicio
        </Link>
      )}
    </div>
  );
}
