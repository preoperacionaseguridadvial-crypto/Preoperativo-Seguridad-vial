import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { PantallaBloqueoHorario } from "@/app/_components/PantallaBloqueoHorario";

// Destino de `iniciarAction` / `cancelarAction` cuando la regla de horario las
// bloquea (ver app/(worker)/inspecciones/page.tsx). Solo informa; la regla la
// sigue aplicando el servidor en cada acción.
export default async function FueraDeHorarioPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return <PantallaBloqueoHorario motivo="INICIO" href="/inspecciones" />;
}
