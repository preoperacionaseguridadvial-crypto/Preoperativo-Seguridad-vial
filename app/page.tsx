import { tienePermisosSst } from "@/lib/auth/permisos";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { atajosPorRol } from "@/lib/inicio/atajos";
import { rutaInicioPorRol } from "@/lib/auth/route-roles";
import { getResumenDelDia, getVehiculosConDocumentosPorVencer } from "@/lib/inicio/resumen-queries";
import { habilitacionAprobacionHasta } from "@/lib/horarios/habilitaciones";
import { getPendientesConFoto } from "@/lib/inspections/pendientes-con-foto";
import { ordenarPendientesPorAtencion } from "@/lib/inspections/partir-pendientes";
import { AppHeader } from "@/app/_components/AppHeader";
import { CerrarSesionForm } from "@/app/_components/CerrarSesionForm";
import { ActivarNotificaciones } from "@/app/_components/ActivarNotificaciones";
import { SaludoInicio } from "@/app/_components/inicio/SaludoInicio";
import { AtajosInicio } from "@/app/_components/inicio/AtajosInicio";
import { EncabezadoAprobador } from "@/app/_components/inicio/EncabezadoAprobador";
import { PendientesPorRevisar } from "@/app/_components/inicio/PendientesPorRevisar";
import { AccesosRapidosAprobador } from "@/app/_components/inicio/AccesosRapidosAprobador";
import { ResumenDelDia } from "@/app/_components/inicio/ResumenDelDia";
import { HeroInicioSst } from "@/app/_components/inicio/HeroInicioSst";
import { AccesosRapidosSst } from "@/app/_components/inicio/AccesosRapidosSst";
import { EstadoDocumentosVehiculos } from "@/app/_components/inicio/EstadoDocumentosVehiculos";
import { VencimientosVehiculos } from "@/app/_components/inicio/VencimientosVehiculos";
import { AvisoDecision } from "@/app/_components/inicio/AvisoDecision";
import { avisoDecisionFirmada } from "@/lib/inspections/aviso-decision";
import { esRolAprobador } from "@/lib/inspections/cola-aprobacion";

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
  // Red de seguridad: el proxy ya manda al TRABAJADOR a su inicio.
  const inicio = rutaInicioPorRol(rol);
  if (inicio !== "/") redirect(inicio);
  // Los dos aprobadores (Director de Operaciones y Supervisor Oleariari) tienen
  // el mismo panel: las tarjetas de SU cola y los atajos.
  const rolAprobador = esRolAprobador(rol) ? rol : null;
  // Aviso "aprobada/rechazada y firmada" al volver de firmar (solo aprobadores).
  const avisoDecision = rolAprobador ? avisoDecisionFirmada(await searchParams) : null;
  const [pendientes, resumenDia, vencimientos, habilitacionHasta] = await Promise.all([
    rolAprobador ? getPendientesConFoto(rolAprobador).then(ordenarPendientesPorAtencion) : null,
    rol === "DIRECTOR" || tienePermisosSst(rol) ? getResumenDelDia(ahora) : null,
    tienePermisosSst(rol) ? getVehiculosConDocumentosPorVencer(ahora) : null,
    rolAprobador ? habilitacionAprobacionHasta(user.id, ahora) : null,
  ]);

  if (pendientes) {
    return (
      <div className="flex flex-1 flex-col">
        {/* Sin AppHeader: el encabezado ya lleva el saludo y cerrar sesión. */}
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
          <EncabezadoAprobador nombre={user.name} rol={rol} ahora={ahora} />
          {avisoDecision && <AvisoDecision aviso={avisoDecision} />}
          <PendientesPorRevisar pendientes={pendientes} ahora={ahora} habilitacionHasta={habilitacionHasta} />
          <AccesosRapidosAprobador atajos={atajosPorRol(rol)} />
        </main>
      </div>
    );
  }

  if (tienePermisosSst(rol)) {
    return (
      <div className="flex flex-1 flex-col">
        {/* Sin AppHeader: el banner ya lleva el logo; cerrar sesión va debajo. */}
        <HeroInicioSst nombre={user.name} rol={rol} />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
          <div className="flex justify-end">
            <CerrarSesionForm destacado />
          </div>
          {resumenDia && <ResumenDelDia resumen={resumenDia} />}
          <AccesosRapidosSst atajos={atajosPorRol(rol)} />
          <ActivarNotificaciones />
          {vencimientos && <EstadoDocumentosVehiculos vehiculos={vencimientos} />}
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader enInicio />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
        <SaludoInicio nombre={user.name} rol={rol} ahora={ahora} />
        {resumenDia && <ResumenDelDia resumen={resumenDia} />}
        <AtajosInicio atajos={atajosPorRol(rol)} />
        {rolAprobador && <ActivarNotificaciones />}
        {vencimientos && <VencimientosVehiculos vehiculos={vencimientos} />}
      </main>
    </div>
  );
}
