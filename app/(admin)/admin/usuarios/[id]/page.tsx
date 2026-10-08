import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getUsuarioPorId } from "@/lib/admin/queries";
import { actualizarUsuario, restablecerPassword } from "@/lib/admin/user-actions";
import { leerVehiculoDeFormulario } from "@/lib/admin/hoja-de-vida";
import { getSignedReadUrl } from "@/lib/storage/s3";
import { Role, Sede, TipoVehiculo } from "@/generated/prisma/client";
import { etiquetaUsuario } from "@/lib/auth/etiquetas-rol";
import { EditarUsuarioForm } from "./_components/EditarUsuarioForm";
import { CampoPassword, ResumenError } from "../_components/ui-formulario";

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
  const valores: Record<string, string> = {
    ...valoresVehiculo,
    name: usuario.name,
    email: usuario.email,
    sede: usuario.sede ?? "",
    cedula: usuario.cedula ?? "",
    telefono: usuario.telefono ?? "",
    cargo: usuario.cargo ?? "",
    puestoAsignado: usuario.puestoAsignado ?? "",
  };

  async function actualizarAction(formData: FormData) {
    "use server";
    try {
      await actualizarUsuario(id, {
        name: formData.get("name")?.toString() ?? "",
        email: formData.get("email")?.toString() ?? "",
        role: formData.get("role") as Role,
        sede: (formData.get("sede")?.toString() || null) as Sede | null,
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
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <div>
        <Link
          href="/admin/usuarios"
          className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline"
        >
          ← Usuarios
        </Link>
        <h1 className="text-xl font-semibold text-ink">{usuario.name}</h1>
        <p className="text-sm text-ink-muted">
          {usuario.email} · {etiquetaUsuario(usuario.role, usuario.sede)}
        </p>
        <Link
          href={`/admin/usuarios/${usuario.id}/hoja-de-vida`}
          className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline"
        >
          Ver hoja de vida
        </Link>
      </div>

      {error && <ResumenError mensaje={error} />}

      <EditarUsuarioForm
        action={actualizarAction}
        valores={valores}
        rolInicial={usuario.role}
        conductorActivo={usuario.conductorActivo}
        usuarioActivo={usuario.activo}
        fotoActualUrl={fotoActualUrl}
        vehiculoActivo={vehiculo?.activo}
        cedulaPendiente={!usuario.cedula && usuario.role === Role.TRABAJADOR}
        vehiculoPendiente={usuario.role === Role.TRABAJADOR && !vehiculo}
      />

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-ink">Restablecer contraseña</h2>
          <p className="text-sm text-ink-muted">
            Esto no afecta el resto de los datos del usuario. Comunica la contraseña nueva por fuera del sistema.
          </p>
        </div>

        {passwordError && <ResumenError mensaje={passwordError} />}
        {passwordOk && (
          <p role="status" className="rounded-xl bg-status-ok-soft px-3 py-2 text-sm font-medium text-status-ok-ink">
            Contraseña restablecida.
          </p>
        )}

        <form action={restablecerAction} className="flex flex-col gap-3">
          <div>
            <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-ink">
              Contraseña nueva
            </label>
            <CampoPassword id="newPassword" nombre="newPassword" placeholder="Mínimo 8 caracteres" />
          </div>
          <div>
            <label htmlFor="newPasswordConfirmacion" className="mb-1 block text-sm font-medium text-ink">
              Confirmar contraseña nueva
            </label>
            <CampoPassword id="newPasswordConfirmacion" nombre="newPasswordConfirmacion" />
          </div>
          <button
            type="submit"
            className="min-h-12 w-full rounded-xl border border-brand px-4 text-sm font-semibold text-brand hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            Restablecer contraseña
          </button>
        </form>
      </section>
    </main>
  );
}
