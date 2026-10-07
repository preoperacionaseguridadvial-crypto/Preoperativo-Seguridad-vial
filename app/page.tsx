import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { atajosPorRol } from "@/lib/inicio/atajos";
import { getDatosInicioTrabajador } from "@/lib/inicio/trabajador-queries";
import { AppHeader } from "@/app/_components/AppHeader";
import { SaludoInicio } from "@/app/_components/inicio/SaludoInicio";
import { AtajosInicio } from "@/app/_components/inicio/AtajosInicio";
import { PanelTrabajador } from "@/app/_components/inicio/PanelTrabajador";

// Inicio por rol (contenedor): lee la sesión y arma el panel. Los paneles
// específicos de cada rol viven en app/_components/inicio/ y los datos en
// lib/. Proxy ya manda a /login a quien no tiene sesión; el link de abajo es
// solo la red de seguridad si se renderiza sin usuario.
export default async function Home() {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-ink">Preoperacional Seguridad Vial</h1>
        <Link
          href="/login"
          className="flex min-h-12 items-center rounded-xl bg-brand px-6 text-sm font-medium text-white"
        >
          Iniciar sesión
        </Link>
      </main>
    );
  }

  const ahora = new Date();
  const esTrabajador = user.role === "TRABAJADOR";
  const datosTrabajador = esTrabajador ? await getDatosInicioTrabajador(user.id) : null;

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader enInicio />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
        <SaludoInicio nombre={user.name} rol={user.role} ahora={ahora} />
        {datosTrabajador ? (
          <PanelTrabajador datos={datosTrabajador} ahora={ahora} />
        ) : (
          <AtajosInicio atajos={atajosPorRol(user.role)} />
        )}
      </main>
    </div>
  );
}
