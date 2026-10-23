import type { IconoPaso } from "@/lib/inspections/pasos-flujo";

// Los 5 pasos de la vista previa "Qué vas a revisar" del inicio del
// recorredor. El sexto paso real del flujo (confirmar y firmar) no se muestra
// acá a propósito; el orden es el de PASOS_INSPECCION (pasos-flujo.ts).

export type PasoInicio = { titulo: string; subtitulo: string; icono: IconoPaso };

export function pasosInicio(totalItems: number): PasoInicio[] {
  const items = totalItems > 0 ? ` (${totalItems} ${totalItems === 1 ? "ítem" : "ítems"})` : "";
  return [
    { titulo: "Kilometraje", subtitulo: "Registra el kilometraje actual", icono: "kilometraje" },
    { titulo: "Checklist del vehículo", subtitulo: `Documentos y revisión de cada ítem${items}`, icono: "checklist" },
    { titulo: "Declaración del conductor", subtitulo: "3 preguntas sobre tu estado", icono: "conductor" },
    { titulo: "Fotos del vehículo", subtitulo: "Foto lateral y foto de la placa", icono: "fotos" },
    { titulo: "Declaración final", subtitulo: "Si la unidad está en condiciones de operar", icono: "resultado" },
  ];
}
