// Constantes de la foto del vehículo compartidas entre el servidor
// (lib/admin/hoja-de-vida.ts, que valida) y el cliente (el formulario, que
// avisa antes de subir). Módulo sin dependencias de servidor a propósito:
// hoja-de-vida.ts importa S3 y `node:crypto` y no puede ir al navegador.

/**
 * Tamaño máximo de la foto. Debe quedar por debajo de
 * `experimental.serverActions.bodySizeLimit` (next.config.ts), que limita el
 * cuerpo completo de la request (foto + campos + overhead multipart).
 */
export const MAX_FOTO_BYTES = 8 * 1024 * 1024;

/** Tipos MIME aceptados (mismo allow-list que valida el servidor). */
export const TIPOS_FOTO_ACEPTADOS = ["image/jpeg", "image/png", "image/webp"] as const;
