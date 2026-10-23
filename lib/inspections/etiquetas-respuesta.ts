// Etiquetas de pantalla de las respuestas del checklist. Único lugar donde se
// decide cómo se "lee" cada valor guardado (feature checklist-bueno-malo):
// el binario OK/FALLA se muestra como "Bueno"/"Malo" y los fluidos conservan
// "Bueno"/"Bajo". Los valores guardados NO cambian (OK/FALLA/BUENO/BAJO/MALO);
// esto es solo presentación.
//
// Sin "server-only" y sin importar el cliente de Prisma: lo usan componentes
// de cliente (botones de respuesta) y de servidor (detalle, PDF, motivos).

export type ValorRespuesta = "OK" | "FALLA" | "BUENO" | "BAJO" | "MALO";

const ETIQUETA: Record<ValorRespuesta, string> = {
  OK: "Bueno",
  FALLA: "Malo",
  BUENO: "Bueno",
  BAJO: "Bajo",
  MALO: "Malo",
};

/** Etiqueta legible del valor guardado: OK -> "Bueno", FALLA -> "Malo", BAJO -> "Bajo". */
export function etiquetaRespuesta(valor: ValorRespuesta): string {
  return ETIQUETA[valor];
}

/** Igual que `etiquetaRespuesta` con el símbolo ✓ (conforme) o ✕ (crea novedad). */
export function etiquetaRespuestaConIcono(valor: ValorRespuesta): string {
  const conforme = valor === "OK" || valor === "BUENO";
  return `${conforme ? "✓" : "✕"} ${ETIQUETA[valor]}`;
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

// Ítems de la moto que no todas las motos tienen: se avisa con "(si aplica)",
// pero el trabajador igual responde Bueno/Bajo (no hay opción "No aplica").
const ITEMS_SI_APLICA_MOTO = new Set(["nivel liquido de frenos", "nivel refrigerante"]);

/**
 * Pista informativa "(si aplica)" bajo el nombre del ítem: solo MOTO y solo
 * líquido de frenos / refrigerante. Un vehículo legacy sin tipo es MOTO.
 */
export function pistaSiAplica(
  tipoVehiculo: "MOTO" | "CARRO" | null | undefined,
  nombreItem: string,
): string | null {
  const esMoto = tipoVehiculo !== "CARRO";
  return esMoto && ITEMS_SI_APLICA_MOTO.has(normalizar(nombreItem)) ? "(si aplica)" : null;
}
