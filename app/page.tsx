import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { atajosPorRol } from "@/lib/inicio/atajos";
import { getDatosInicioTrabajador } from "@/lib/inicio/trabajador-queries";
import { getResumenDelDia, getVehiculosConDocumentosPorVencer } from "@/lib/inicio/resumen-queries";
import { getPendientesConFoto } from "@/lib/inspections/pendientes-con-foto";
import { ordenarPendientesPorAtencion } from "@/lib/inspections/partir-pendientes";
import { AppHeader } from "@/app/_components/AppHeader";
import { SaludoInicio } from "@/app/_components/inicio/SaludoInicio";
import { AtajosInicio } from "@/app/_components/inicio/AtajosInicio";
import { PanelTrabajador } from "@/app/_components/inicio/PanelTrabajador";
import { ResumenSupervisor } from "@/app/_components/inicio/ResumenSupervisor";
import { ResumenDelDia } from "@/app/_components/inicio/ResumenDelDia";
import { VencimientosVehiculos } from "@/app/_components/inicio/VencimientosVehiculos";
import { AvisoDecision } from "@/app/_components/inicio/AvisoDecision";
import { avisoDecisionFirmada } from "@/lib/inspections/aviso-decision";

// Inicio por rol (contenedor): lee la sesión, consulta solo lo que el rol va
// a ver y arma el panel. Los paneles viven en app/_components/inicio/ y los
// datos en lib/inicio/. Proxy ya manda a /login a quien no tiene sesión; el
// link de abajo es solo la red de seguridad si se renderiza sin usuario.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ decision?: string; placa?: string }>;
}) {
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
  const rol = user.role;
  // Aviso "aprobada/rechazada y firmada" al volver de firmar (solo Supervisor).
  const avisoDecision = rol === "SUPERVISOR" ? avisoDecisionFirmada(await searchParams) : null;
  const [datosTrabajador, pendientes, resumenDia, vencimientos] = await Promise.all([
    rol === "TRABAJADOR" ? getDatosInicioTrabajador(user.id) : null,
    rol === "SUPERVISOR" ? getPendientesConFoto().then(ordenarPendientesPorAtencion) : null,
    rol === "DIRECTOR" || rol === "SST" ? getResumenDelDia(ahora) : null,
    rol === "ADMINISTRADOR" || rol === "SST" ? getVehiculosConDocumentosPorVencer(ahora) : null,
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader enInicio />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
        <SaludoInicio nombre={user.name} rol={rol} sede={datosTrabajador?.sede} ahora={ahora} />
        {avisoDecision && <AvisoDecision aviso={avisoDecision} />}
        {datosTrabajador ? (
          <PanelTrabajador datos={datosTrabajador} ahora={ahora} />
        ) : (
          <>
            {pendientes && <ResumenSupervisor pendientes={pendientes} ahora={ahora} />}
            {resumenDia && <ResumenDelDia resumen={resumenDia} />}
            <AtajosInicio atajos={atajosPorRol(rol)} />
            {vencimientos && <VencimientosVehiculos vehiculos={vencimientos} />}
          </>
        )}
      </main>
    </div>
  );
}
