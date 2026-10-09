import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, unstable_update } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import { registrarAutorizacionDatos } from "@/lib/legal/autorizacion-datos-actions";
import { tieneAutorizacionDatos } from "@/lib/legal/autorizacion-datos";
import { VERSION_POLITICA_DATOS } from "@/lib/legal/politica-datos";
import { CerrarSesionForm } from "@/app/_components/CerrarSesionForm";
import { FormularioAutorizacion } from "@/app/autorizacion/_components/FormularioAutorizacion";

export const metadata: Metadata = { title: "Autorización de tratamiento de datos" };

// Autorización del titular para el tratamiento de sus datos (Ley 1581 de
// 2012). Se muestra una única vez: Proxy manda acá a todo usuario con sesión
// que todavía no la firmó (lib/auth/gate-autorizacion.ts) y no lo deja abrir
// nada más. Después de firmar se refresca el token (`unstable_update`) para
// que Proxy lo deje pasar sin volver a iniciar sesión.
// Texto de referencia: debe validarlo un abogado antes de usarse en producción.
export default async function AutorizacionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const userId = session.user.id;

  const [usuario, yaAutorizo] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, cedula: true } }),
    tieneAutorizacionDatos(userId),
  ]);

  async function autorizar(formData: FormData) {
    "use server";
    try {
      await registrarAutorizacionDatos(formData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo registrar la autorización.";
      redirect(`/autorizacion?error=${encodeURIComponent(message)}`);
    }
    await unstable_update({});
    redirect("/");
  }

  // El registro ya existe pero el token quedó viejo (p. ej. firmó en otro
  // dispositivo): solo hace falta refrescar la sesión.
  async function continuar() {
    "use server";
    await unstable_update({});
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Autorización de tratamiento de datos personales</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Antes de usar la aplicación necesitamos su autorización. Se pide una sola vez.
          </p>
        </div>
        <CerrarSesionForm />
      </div>

      {yaAutorizo ? (
        <form action={continuar} className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
          <p className="text-sm text-ink">Su autorización ya está registrada.</p>
          <button
            type="submit"
            className="w-full rounded-md bg-[#0B3B60] px-4 py-3 text-base font-semibold text-white hover:bg-[#0B3B60]/90"
          >
            Continuar
          </button>
        </form>
      ) : (
        <>
          <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 text-sm leading-relaxed text-ink">
            <p>
              Autorizo de manera previa, expresa e informada a <strong>ESS LTDA</strong>, como
              responsable, y a <strong>Histech</strong>, como encargado, para tratar mis datos
              personales conforme a la Ley 1581 de 2012 y a la política de tratamiento de datos de
              esta aplicación.
            </p>
            <p>Esta autorización cubre:</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>mis datos de identificación y contacto, y los del vehículo que tengo asignado;</li>
              <li>las inspecciones preoperacionales que registre, sus fotografías y mi firma;</li>
              <li>
                mis declaraciones sobre si estoy en condiciones aptas para conducir, si consumí
                alcohol y si tomo medicamentos.
              </li>
            </ul>
            <p>
              Fui informado de que esas declaraciones son <strong>datos sensibles</strong>, de que se
              usan únicamente para verificar la aptitud para conducir y prevenir siniestros viales, y
              de que no estoy obligado a autorizar su tratamiento.
            </p>
            <p>
              Conozco mis derechos a conocer, actualizar, rectificar y suprimir mis datos y a revocar
              esta autorización, y que puedo ejercerlos ante ESS LTDA.{" "}
              <a
                href="/privacidad"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand underline underline-offset-2"
              >
                Leer la política completa
              </a>{" "}
              (versión {VERSION_POLITICA_DATOS}).
            </p>
          </section>

          <section className="rounded-md border border-border bg-surface p-4 text-sm text-ink">
            <p className="font-medium">{usuario?.name}</p>
            {usuario?.cedula && <p className="text-xs text-ink-muted">C.C. {usuario.cedula}</p>}
          </section>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <FormularioAutorizacion autorizarAction={autorizar} />
        </>
      )}
    </main>
  );
}
