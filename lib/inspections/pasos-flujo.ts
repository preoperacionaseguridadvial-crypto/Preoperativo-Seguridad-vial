// Pasos del flujo guiado de la inspección del trabajador, en el orden real en
// que `getNextStepPath` (lib/inspections/queries.ts) lleva al trabajador. Es
// solo la vista previa de la pantalla de inicio: si cambia el orden del
// flujo, se cambia acá y en ese test.

export type IconoPaso = "kilometraje" | "checklist" | "conductor" | "fotos" | "resultado" | "firma";

export const PASOS_INSPECCION: readonly {
  clave: "medidas" | "checklist" | "estado-conductor" | "fotos" | "resultado" | "confirmar";
  titulo: string;
  descripcion: string;
  icono: IconoPaso;
}[] = [
  { clave: "medidas", titulo: "Kilometraje", descripcion: "Registra el kilometraje actual", icono: "kilometraje" },
  {
    clave: "checklist",
    titulo: "Checklist del vehículo",
    descripcion: "Documentos y revisión de cada ítem",
    icono: "checklist",
  },
  {
    clave: "estado-conductor",
    titulo: "Declaración del conductor",
    descripcion: "3 preguntas sobre tu estado",
    icono: "conductor",
  },
  { clave: "fotos", titulo: "Fotos del vehículo", descripcion: "Foto lateral y foto de la placa", icono: "fotos" },
  {
    clave: "resultado",
    titulo: "Declaración final",
    descripcion: "Si la unidad está en condiciones de operar",
    icono: "resultado",
  },
  { clave: "confirmar", titulo: "Confirmar y firmar", descripcion: "Revisa el resumen y firma el envío", icono: "firma" },
];
