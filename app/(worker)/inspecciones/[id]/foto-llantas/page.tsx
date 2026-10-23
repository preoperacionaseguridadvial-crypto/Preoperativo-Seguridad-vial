import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import {
  getOwnInspectionOrNotFound,
  getNextStepPath,
  getPreviousStepPath,
  getFotosInspeccion,
} from "@/lib/inspections/queries";
import { getSignedReadUrl } from "@/lib/storage/s3";
import { BotonAtras } from "@/app/(worker)/inspecciones/_components/BotonAtras";
import { GuiaFoto } from "@/app/(worker)/inspecciones/_components/GuiaFoto";
import { SubirFotoInspeccion } from "@/app/(worker)/inspecciones/_components/SubirFotoInspeccion";

// Foto de las llantas (solo MOTO): paso propio del recorrido, justo después del
// ítem "Llantas" (lib/inspections/fotos-flujo.ts). Reutiliza la captura y la
// subida de las fotos diarias (`SubirFotoInspeccion` -> route handler
// `/inspecciones/[id]/fotos/llantas/subir` -> `subirFotoInspeccion`), que
// también la deja reemplazable mientras la inspección siga EN_PROCESO y
// descarta la firma del conductor si ya existía. `enviarInspeccion` vuelve a
// exigirla en el servidor.
export default async function FotoLlantasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const inspection = await getOwnInspectionOrNotFound(id, session.user.id);
  if (inspection.status !== "EN_PROCESO") {
    redirect(await getNextStepPath(id));
  }
  // El carro no toma esta foto. Un vehículo legacy sin tipo se trata como moto.
  if (inspection.vehicle.tipoVehiculo === "CARRO") {
    redirect(await getNextStepPath(id));
  }

  const { llantas } = await getFotosInspeccion(id);
  const hrefAtras = (await getPreviousStepPath(id, "foto-llantas")) ?? `/inspecciones/${id}/medidas`;
  const urlMiniatura = llantas ? await getSignedReadUrl(llantas.s3Key).catch(() => null) : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-5">
      <BotonAtras href={hrefAtras} />
      <div>
        <p className="text-xs uppercase text-gray-400">{inspection.vehicle.placa}</p>
        <h1 className="text-xl font-semibold text-[#0B3B60]">Fotografía de las llantas</h1>
        <p className="mt-1 text-sm text-gray-500">Foto obligatoria antes de continuar.</p>
      </div>

      <SubirFotoInspeccion
        inspectionId={id}
        tipo="llantas"
        titulo="Foto de las llantas"
        existe={Boolean(llantas)}
        guia={<GuiaFoto tipo="llantas" tipoVehiculo="MOTO" compacta={Boolean(llantas)} />}
        urlMiniatura={urlMiniatura}
      />

      {llantas && <ContinuarLink inspectionId={id} />}
    </main>
  );
}

async function ContinuarLink({ inspectionId }: { inspectionId: string }) {
  const next = await getNextStepPath(inspectionId);
  return (
    <Link
      href={next}
      className="block w-full rounded-md bg-[#0B3B60] px-4 py-4 text-center text-base font-semibold text-white hover:bg-[#0B3B60]/90"
    >
      Continuar
    </Link>
  );
}
