import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getSetting, CLAVE_FECHA_VIGENCIA, PLACEHOLDER_FECHA_VIGENCIA } from "@/lib/settings/queries";
import { actualizarConfiguracion } from "@/lib/settings/actions";

// Panel de configuración del Administrador (fase soporte-moto-carro, Slice
// 4, ADR A5). Hoy solo edita `formato.fechaVigencia` (usada por el PDF
// FO-SVS-23, ver lib/pdf/InspeccionPdfDocument.tsx) — el almacén AppSetting
// es genérico, así que agregar otra configuración acá solo requiere otro
// campo en este mismo formulario, no un modelo nuevo.
export default async function AdminConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const fechaVigencia = await getSetting(CLAVE_FECHA_VIGENCIA);
  const esPlaceholder = fechaVigencia === PLACEHOLDER_FECHA_VIGENCIA;

  async function actualizarAction(formData: FormData) {
    "use server";
    const valor = formData.get("fechaVigencia")?.toString() ?? "";
    try {
      await actualizarConfiguracion(CLAVE_FECHA_VIGENCIA, valor);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar la configuración.";
      redirect(`/admin/configuracion?error=${encodeURIComponent(message)}`);
    }
    redirect("/admin/configuracion?ok=1");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0B3B60]">Configuración</h1>
          <p className="text-sm text-gray-500">
            Valores editables sin necesidad de un nuevo despliegue.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/usuarios"
            className="rounded-md border border-[#0B3B60] px-3 py-2 text-sm font-medium text-[#0B3B60] hover:bg-[#0B3B60]/10"
          >
            Ver usuarios
          </Link>
          <Link
            href="/admin/vehiculos"
            className="rounded-md border border-[#0B3B60] px-3 py-2 text-sm font-medium text-[#0B3B60] hover:bg-[#0B3B60]/10"
          >
            Ver vehículos
          </Link>
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {ok && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Configuración actualizada.
        </p>
      )}

      <section className="flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-4">
        <div>
          <h2 className="text-sm font-semibold text-[#0B3B60]">Fecha vigencia del formato</h2>
          <p className="text-xs text-gray-500">
            Se muestra en el encabezado del PDF FO-SVS-23 (junto a Código y Versión). Mientras no
            se configure una fecha real, el PDF muestra un placeholder claramente marcado en vez
            de una fecha inventada.
          </p>
        </div>

        {esPlaceholder && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Todavía no se configuró una fecha real — el PDF está mostrando el placeholder
            &ldquo;{PLACEHOLDER_FECHA_VIGENCIA}&rdquo;.
          </p>
        )}

        <form action={actualizarAction} className="flex flex-col gap-3">
          <div>
            <label htmlFor="fechaVigencia" className="mb-1 block text-sm font-medium text-gray-700">
              Fecha vigencia
            </label>
            <input
              id="fechaVigencia"
              name="fechaVigencia"
              type="text"
              required
              defaultValue={esPlaceholder ? "" : fechaVigencia}
              placeholder="Ej: 30/08/2026"
              className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-[#0B3B60] px-4 py-4 text-base font-semibold text-white hover:bg-[#0B3B60]/90"
          >
            Guardar
          </button>
        </form>
      </section>
    </main>
  );
}
