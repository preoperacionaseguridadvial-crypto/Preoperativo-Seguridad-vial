// Lógica pura del estado de subida de una foto (sin DOM): la usa el componente
// cliente de app/(worker)/inspecciones/[id]/fotos para mostrar la barra de
// progreso ("Optimizando foto…" -> "Subiendo NN %" -> "✓ Foto guardada") y se
// prueba en aislamiento. El componente solo traduce eventos del navegador
// (compresión, XMLHttpRequest) a estos eventos.

export type FaseSubida = "reposo" | "optimizando" | "subiendo" | "guardada" | "error";

export type EstadoSubida = {
  fase: FaseSubida;
  /** 0..100; solo significativo en `subiendo` y `guardada`. */
  porcentaje: number;
  mensaje: string | null;
};

export type EventoSubida =
  | { tipo: "elegida" }
  | { tipo: "optimizada" }
  | { tipo: "progreso"; cargado: number; total: number }
  | { tipo: "completada" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "reintentar" };

export const ESTADO_INICIAL_SUBIDA: EstadoSubida = { fase: "reposo", porcentaje: 0, mensaje: null };

export const MENSAJE_ERROR_SUBIDA = "No se pudo guardar la foto. Intentá de nuevo.";

export function calcularPorcentaje(cargado: number, total: number): number {
  if (!Number.isFinite(cargado) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((cargado / total) * 100)));
}

export function estaOcupada(estado: EstadoSubida): boolean {
  return estado.fase === "optimizando" || estado.fase === "subiendo";
}

export function reducirSubida(estado: EstadoSubida, evento: EventoSubida): EstadoSubida {
  switch (evento.tipo) {
    case "elegida":
      // Doble toque / otra foto mientras hay una subida en curso: se ignora.
      if (estaOcupada(estado)) return estado;
      return { fase: "optimizando", porcentaje: 0, mensaje: null };
    case "optimizada":
      if (estado.fase !== "optimizando") return estado;
      return { fase: "subiendo", porcentaje: 0, mensaje: null };
    case "progreso": {
      if (estado.fase !== "subiendo") return estado;
      const porcentaje = Math.max(estado.porcentaje, calcularPorcentaje(evento.cargado, evento.total));
      return porcentaje === estado.porcentaje ? estado : { ...estado, porcentaje };
    }
    case "completada":
      if (estado.fase !== "subiendo") return estado;
      return { fase: "guardada", porcentaje: 100, mensaje: null };
    case "error":
      return { fase: "error", porcentaje: 0, mensaje: evento.mensaje };
    case "reintentar":
      if (estado.fase !== "error") return estado;
      return { fase: "subiendo", porcentaje: 0, mensaje: null };
  }
}

/** Texto de la barra para la fase actual, o `null` en reposo/error (los muestra otra parte de la UI). */
export function textoProgreso(estado: EstadoSubida): string | null {
  switch (estado.fase) {
    case "optimizando":
      return "Optimizando foto…";
    case "subiendo":
      // Con el 100 % de los bytes enviados falta que el servidor termine de guardar.
      return estado.porcentaje >= 100 ? "Guardando…" : `Subiendo ${estado.porcentaje} %`;
    case "guardada":
      return "✓ Foto guardada";
    default:
      return null;
  }
}

/**
 * Interpreta la respuesta del route handler de subida. Una respuesta que no es
 * JSON (p. ej. el proxy redirigió al login y XHR siguió la redirección) se
 * trata como sesión vencida en vez de como éxito.
 */
export function interpretarRespuestaSubida(
  status: number,
  cuerpo: string,
): { ok: true } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(cuerpo);
  } catch {
    return status >= 200 && status < 300
      ? { ok: false, error: "Tu sesión venció: volvé a iniciar sesión e intentá de nuevo." }
      : { ok: false, error: MENSAJE_ERROR_SUBIDA };
  }
  const dato = json as { ok?: unknown; error?: unknown };
  if (status >= 200 && status < 300 && dato.ok === true) return { ok: true };
  return {
    ok: false,
    error: typeof dato.error === "string" && dato.error ? dato.error : MENSAJE_ERROR_SUBIDA,
  };
}
