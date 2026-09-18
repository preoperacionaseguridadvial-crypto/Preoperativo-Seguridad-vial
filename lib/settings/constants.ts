// Constantes puras (sin Prisma, sin "server-only") del almacén de
// configuración `AppSetting` (fase soporte-moto-carro, Slice 4, ADR A5).
// Separadas de lib/settings/queries.ts (que sí importa "server-only") para
// que prisma/seed.ts pueda importarlas sin arrastrar esa dependencia — el
// seed usa su propio PrismaClient/adapter y no importa nada más de `lib/`
// (ver prisma/seed.ts). Única fuente de verdad: queries.ts reexporta desde
// acá en vez de redeclarar los valores.

export const CLAVE_FECHA_VIGENCIA = "formato.fechaVigencia";

// Placeholder sembrado por prisma/seed.ts cuando ningún Administrador
// definió todavía la fecha real (spec: "Vigencia no configurada" — MUST
// mostrar un placeholder claramente marcado, nunca una fecha inventada).
// También sirve de resguardo defensivo si la fila llegara a faltar (ej. un
// deploy que corrió la migración pero no el seed) o si la consulta a
// `AppSetting` falla (ver lib/inspections/pdf-queries.ts).
export const PLACEHOLDER_FECHA_VIGENCIA = "Pendiente de definir";
