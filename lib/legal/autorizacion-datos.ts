import { prisma } from "@/lib/prisma";

/** Registro de la autorización del usuario, o `null` si todavía no autorizó. */
export function getAutorizacionDatos(userId: string) {
  return prisma.autorizacionDatos.findUnique({ where: { userId } });
}

/** `true` si el usuario ya autorizó el tratamiento de sus datos. */
export async function tieneAutorizacionDatos(userId: string): Promise<boolean> {
  return (await prisma.autorizacionDatos.count({ where: { userId } })) > 0;
}
