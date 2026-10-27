import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getOwnInspectionOrNotFound } from "@/lib/inspections/queries";
import { habilitacionVigente, puedeContinuarInspeccion } from "@/lib/horarios/habilitaciones";
import { PantallaBloqueoHorario } from "@/app/_components/PantallaBloqueoHorario";
import { cierreDelAviso } from "@/lib/horarios/aviso-cierre";
import { formatHora } from "@/lib/fechas/formato";
import { TipoHabilitacion } from "@/generated/prisma/client";
import { AvisoCierreHorario } from "./_components/AvisoCierreHorario";

// Los layouts persisten entre las pantallas hijas (no se vuelven a renderizar
// al navegar entre pasos), por eso el temporizador del aviso sigue corriendo
// mientras el trabajador avanza por la inspección. Solo se muestra mientras la
// inspección está EN_PROCESO; el servidor ya bloquea las acciones fuera de horario.
export default async function InspeccionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const inspection = await getOwnInspectionOrNotFound(id, session.user.id);
  if (inspection.status !== "EN_PROCESO") return <>{children}</>;

  const ahora = new Date();
  // Misma regla que aplican las acciones del servidor: si ya no puede
  // continuar, en vez de dejarla fallar paso a paso se muestra el bloqueo.
  if (!(await puedeContinuarInspeccion(inspection, ahora))) {
    return <PantallaBloqueoHorario motivo="CONTINUAR" href="/inspecciones" />;
  }
  const habilitacion = await habilitacionVigente(inspection.workerId, TipoHabilitacion.RECORREDOR, ahora);
  const { cierre, hora } = cierreDelAviso({
    startedAt: inspection.startedAt,
    ahora,
    habilitacionHasta: habilitacion?.hasta ?? null,
  });

  return (
    <>
      <AvisoCierreHorario msRestantes={cierre.getTime() - ahora.getTime()} hora={formatHora(hora)} />
      {children}
    </>
  );
}
