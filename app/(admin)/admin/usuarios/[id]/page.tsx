import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getUsuarioPorId } from "@/lib/admin/queries";
import { actualizarUsuario, restablecerPassword } from "@/lib/admin/user-actions";
import { leerVehiculoDeFormulario } from "@/lib/admin/hoja-de-vida";
import { getSignedReadUrl } from "@/lib/storage/s3";
import { Role, TipoVehiculo } from "@/generated/prisma/client";
import { CamposVehiculo } from "../_components/CamposVehiculo";

const ROLES: Role[] = [Role.TRABAJADOR, Role.SUPERVISOR, Role.DIRECTOR, Role.SST, Role.ADMINISTRADOR];

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

// Edición de datos y restablecimiento de contraseña son dos acciones
// separadas (dos formularios, dos server actions) — restablecer una
// contraseña no debe pisar accidentalmente el resto de los datos del
// usuario, ni viceversa.
export default async function EditarUsuarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; passwordError?: string; passwordOk?: string }>;
}) {
  const { id } = await params;
  const { error, passwordError, passwordOk } = await searchParams;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const usuario = await getUsuarioPorId(id);
  if (!usuario) {
    notFound();
  }

  // URL prefirmada de corta vida (solo se guarda el s3Key). Si falla la
  // firma, la edición sigue funcionando sin mostrar la foto actual.
  const fotoActualUrl = usuario.vehicle?.fotoS3Key
    ? await getSignedReadUrl(usuario.vehicle.fotoS3Key).catch(() => null)
    : null;
  const vehiculo = usuario.vehicle;
  const valoresVehiculo: Record<string, string> = {
    tipoVehiculo: usuario.tipoVehiculo ?? "",
    placa: vehiculo?.placa ?? "",
    marca: vehiculo?.marca ?? "",
    modelo: vehiculo?.modelo ?? "",
    color: vehiculo?.color ?? "",
    fechaVencimientoSoat: toDateInputValue(vehiculo?.fechaVencimientoSoat ?? null),
    fechaVencimientoTecnicomecanica: toDateInputValue(vehiculo?.fechaVencimientoTecnicomecanica ?? null),
  };

  async function actualizarAction(formData: FormData) {
    "use server";
    try {
      await actualizarUsuario(id, {
        name: formData.get("name")?.toString() ?? "",
        email: formData.get("email")?.toString() ?? "",
        role: formData.get("role") as Role,
        activo: formData.get("activo") === "on",
        cedula: formData.get("cedula")?.toString(),
        telefono: formData.get("telefono")?.toString(),
        cargo: formData.get("cargo")?.toString(),
        puestoAsignado: formData.get("puestoAsignado")?.toString(),
        tipoVehiculo: (formData.get("tipoVehiculo")?.toString() || null) as TipoVehiculo | null,
        vehiculo: leerVehiculoDeFormulario(formData),
        conductorActivo: formData.get("conductorActivo") === "on",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el usuario.";
      redirect(`/admin/usuarios/${id}?error=${encodeURIComponent(message)}`);
    }
    redirect("/admin/usuarios");
  }

  async function restablecerAction(formData: FormData) {
    "use server";
    const nueva = formData.get("newPassword")?.toString() ?? "";
    const confirmacion = formData.get("newPasswordConfirmacion")?.toString() ?? "";
    try {
      await restablecerPassword(id, nueva, confirmacion);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo restablecer la contraseña.";
      redirect(`/admin/usuarios/${id}?passwordError=${encodeURIComponent(message)}`);
    }
    redirect(`/admin/usuarios/${id}?passwordOk=1`);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/admin/usuarios" className="text-sm text-[#005B96] hover:underline">
          ← Usuarios
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B3B60]">{usuario.name}</h1>
        <p className="text-sm text-gray-500">{usuario.email}</p>
        <Link
          href={`/admin/usuarios/${usuario.id}/hoja-de-vida`}
          className="mt-2 inline-block text-sm text-[#005B96] hover:underline"
        >
          Ver hoja de vida
        </Link>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form
        action={actualizarAction}
        encType="multipart/form-data"
        className="flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-4"
      >
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
            Nombre completo
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={usuario.name}
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={usuario.email}
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="role" className="mb-1 block text-sm font-medium text-gray-700">
            Rol
          </label>
          <select
            id="role"
            name="role"
            required
            defaultValue={usuario.role}
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          >
            {ROLES.map((rol) => (
              <option key={rol} value={rol}>
                {rol}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="cedula" className="mb-1 block text-sm font-medium text-gray-700">
            Cédula
          </label>
          <input
            id="cedula"
            name="cedula"
            type="text"
            defaultValue={usuario.cedula ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
          {!usuario.cedula && usuario.role === Role.TRABAJADOR && (
            <p className="mt-1 text-xs font-medium text-amber-600">Pendiente de asignación.</p>
          )}
        </div>

        {/* Sección de vehículo (1:1). Siempre visible porque el rol puede
            cambiar en este mismo envío; solo aplica a TRABAJADOR y un legacy sin
            vehículo puede dejarla vacía (la validación real es la del servidor). */}
        {usuario.role === Role.TRABAJADOR && !vehiculo && (
          <p className="text-xs font-medium text-amber-600">
            Pendiente de asignación de vehículo: completa la hoja de vida del vehículo abajo.
          </p>
        )}
        <CamposVehiculo
          valores={valoresVehiculo}
          modo="edicion"
          fotoActualUrl={fotoActualUrl}
          activo={vehiculo?.activo}
        />

        <div>
          <label htmlFor="puestoAsignado" className="mb-1 block text-sm font-medium text-gray-700">
            Puesto asignado
          </label>
          <input
            id="puestoAsignado"
            name="puestoAsignado"
            type="text"
            defaultValue={usuario.puestoAsignado ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="telefono" className="mb-1 block text-sm font-medium text-gray-700">
            Teléfono
          </label>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            defaultValue={usuario.telefono ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="cargo" className="mb-1 block text-sm font-medium text-gray-700">
            Cargo
          </label>
          <input
            id="cargo"
            name="cargo"
            type="text"
            defaultValue={usuario.cargo ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="conductorActivo"
            defaultChecked={usuario.conductorActivo}
            className="h-5 w-5 rounded border-gray-300 text-[#005B96] focus:ring-[#005B96]"
          />
          Conductor activo
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={usuario.activo}
            className="h-5 w-5 rounded border-gray-300 text-[#005B96] focus:ring-[#005B96]"
          />
          Usuario activo
        </label>

        <button
          type="submit"
          className="w-full rounded-md bg-[#0B3B60] px-4 py-4 text-base font-semibold text-white hover:bg-[#0B3B60]/90"
        >
          Guardar cambios
        </button>
      </form>

      <section className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-500">Restablecer contraseña</h2>
        <p className="text-xs text-gray-500">
          Esto no afecta el resto de los datos del usuario. Comunicá la contraseña nueva por fuera del sistema.
        </p>

        {passwordError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{passwordError}</p>}
        {passwordOk && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Contraseña restablecida.</p>
        )}

        <form action={restablecerAction} className="flex flex-col gap-3">
          <input
            type="password"
            name="newPassword"
            required
            minLength={8}
            placeholder="Contraseña nueva (mínimo 8 caracteres)"
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
          <input
            type="password"
            name="newPasswordConfirmacion"
            required
            minLength={8}
            placeholder="Confirmar contraseña nueva"
            className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-[#005B96] focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-md border border-[#0B3B60] px-4 py-3 text-sm font-semibold text-[#0B3B60] hover:bg-[#0B3B60]/10"
          >
            Restablecer contraseña
          </button>
        </form>
      </section>
    </main>
  );
}
