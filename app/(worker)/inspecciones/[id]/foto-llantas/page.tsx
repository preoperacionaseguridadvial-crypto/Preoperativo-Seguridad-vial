import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import {
  getOwnInspectionOrNotFound,
  getNextStepPath,
  getPreviousStepPath,
  getFotosInspeccion,
} from "@/lib/inspections/queries";
import type { TipoFotoGuiaLlanta } from "@/lib/inspections/guia-foto";
import { getSignedReadUrl } from "@/lib/storage/s3";
import { BotonAtras } from "@/app/(worker)/inspecciones/_components/BotonAtras";
import { GuiaFoto } from "@/app/(worker)/inspecciones/_components/GuiaFoto";
import { SubirFotoInspeccion } from "@/app/(worker)/inspecciones/_components/SubirFotoInspeccion";

// Fotos de las llantas: paso propio del recorrido, justo después del ítem de
// llantas (lib/inspections/fotos-flujo.ts). Una foto por llanta: 2 en MOTO
// (delantera, trasera) y 4 en CARRO (delantera/trasera, izquierda/derecha; el
// repuesto no se fotografía). Reutiliza la captura y la subida de las fotos
// diarias (`SubirFotoInspeccion` -> route handler
// `/inspecciones/[id]/fotos/[tipo]/subir` -> `subirFotoInspeccion`), que también
// las deja reemplazables mientras la inspección siga EN_PROCESO y descarta la
// firma del conductor si ya existía. `enviarInspeccion` vuelve a exigirlas en el
// servidor.
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

  const { llantas } = await getFotosInspeccion(id);
  const hrefAtras = (await getPreviousStepPath(id, "foto-llantas")) ?? `/inspecciones/${id}/medidas`;

  // URL firmada de cada foto guardada para la miniatura. Si la firma falla la
  // página igual carga, solo que sin miniatura.
  const urls = await Promise.all(
    llantas.map(({ foto }) => (foto ? getSignedReadUrl(foto.s3Key).catch(() => null) : null)),
  );

  // Vehículo legacy sin tipo se trata como MOTO (lo resuelve guiaDeFoto).
  const tipoVehiculo = inspection.vehicle.tipoVehiculo;
  const todasCompletas = llantas.every(({ foto }) => foto !== null);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-5">
      <BotonAtras href={hrefAtras} />
      <div>
        <p className="text-xs uppercase text-gray-400">{inspection.vehicle.placa}</p>
        <h1 className="text-xl font-semibold text-[#0B3B60]">Fotografía de las llantas</h1>
        <p className="mt-1 text-sm text-gray-500">
          {llantas.length === 1 ? "Una foto obligatoria" : `${llantas.length} fotos obligatorias`} antes de continuar:
          una por cada llanta.
        </p>
      </div>

      {llantas.map(({ tipo, etiqueta, foto }, indice) => {
        // El tipo de foto en minúscula es también el segmento de la URL de subida.
        const clave = tipo.toLowerCase() as TipoFotoGuiaLlanta;
        return (
          <SubirFotoInspeccion
            key={tipo}
            inspectionId={id}
            tipo={clave}
            titulo={`${indice + 1}. ${etiqueta}`}
            existe={Boolean(foto)}
            guia={<GuiaFoto tipo={clave} tipoVehiculo={tipoVehiculo} compacta={Boolean(foto)} />}
            urlMiniatura={urls[indice]}
          />
        );
      })}

      {todasCompletas && <ContinuarLink inspectionId={id} />}
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
