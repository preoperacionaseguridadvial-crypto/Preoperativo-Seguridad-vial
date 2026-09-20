// Marca los errores de dominio cuyo mensaje (en español) está pensado para
// mostrarse tal cual al usuario del panel: validaciones de campos, duplicados,
// hoja de vida incompleta. Cualquier otro error (Prisma, S3, un bug) NO lleva
// esta marca, así que las pantallas pueden distinguirlos y mostrar un mensaje
// genérico en vez de filtrar texto interno (tablas, columnas, buckets).
//
// Vive fuera de `user-actions.ts` porque un archivo "use server" solo puede
// exportar funciones async — no clases.
export class ErrorDeUsuario extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorDeUsuario";
  }
}

export function esErrorDeUsuario(err: unknown): err is ErrorDeUsuario {
  return err instanceof ErrorDeUsuario;
}
