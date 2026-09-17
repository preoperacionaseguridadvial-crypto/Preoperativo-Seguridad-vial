import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getOwnInspectionOrNotFound, getNextStepPath } from "@/lib/inspections/queries";

// Página "router": no renderiza nada, solo decide a qué paso del flujo
// guiado corresponde mandar al trabajador (ver `getNextStepPath`). Sirve
// como URL estable para "retomar" una inspección desde la lista.
export default async function InspeccionRouterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  await getOwnInspectionOrNotFound(id, session.user.id);
  redirect(await getNextStepPath(id));
}
