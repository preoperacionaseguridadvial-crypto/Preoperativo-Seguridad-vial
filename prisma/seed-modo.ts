// Decide qué hace `prisma/seed.ts` según el entorno. Módulo puro (sin Prisma)
// para poder probarlo sin base de datos.
//
// Modo producción (`NODE_ENV=production` o `SEED_MODO=produccion`): solo
// catálogo del checklist y configuración. Nunca crea los usuarios/vehículos
// demo (contraseña conocida) y nunca corre la limpieza de datos de prueba,
// que borra TODAS las fotos, novedades y respuestas de checklist.
// `SEED_MODO` solo puede endurecer el modo, nunca habilitar datos demo en
// producción.

export type ModoSeed = {
  produccion: boolean;
  /** Usuarios y vehículos demo (contraseña de desarrollo). */
  datosDemo: boolean;
  /** Borrado de fotos, novedades y respuestas de catálogos anteriores. */
  limpiarDatosPrueba: boolean;
};

export function resolverModoSeed(env: Record<string, string | undefined>): ModoSeed {
  const modo = env.SEED_MODO?.trim().toLowerCase();
  const produccion = env.NODE_ENV === "production" || modo === "produccion";
  return { produccion, datosDemo: !produccion, limpiarDatosPrueba: !produccion };
}
