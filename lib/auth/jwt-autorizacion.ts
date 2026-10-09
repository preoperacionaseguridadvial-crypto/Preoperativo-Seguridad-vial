import type { JWT } from "next-auth/jwt";
import type { Role } from "@/generated/prisma/client";

type ParametrosJwt = {
  token: JWT;
  user?: { id?: string; role?: Role; autorizoDatos?: boolean } | null;
  trigger?: "signIn" | "signUp" | "update";
  // Lo que envía el cliente en una actualización de sesión: se ignora a propósito.
  session?: unknown;
};

/**
 * Callback `jwt` de la config completa (lib/auth/config.ts). Mantiene en el
 * token si el usuario ya autorizó el tratamiento de sus datos, que es lo que
 * lee Proxy para la barrera (lib/auth/gate-autorizacion.ts) sin consultar la
 * base en cada request.
 *
 * En una actualización de sesión (`trigger === "update"`) el valor se vuelve a
 * leer de la base con `consultar` y nunca se toma de `session`: esa
 * actualización también se puede pedir desde el navegador, y aceptar su
 * contenido dejaría saltarse la firma.
 */
export async function jwtConAutorizacion(
  { token, user, trigger }: ParametrosJwt,
  consultar: (userId: string) => Promise<boolean>,
): Promise<JWT> {
  if (user) {
    if (user.id) token.id = user.id;
    if (user.role) token.role = user.role;
    token.autorizoDatos = user.autorizoDatos === true;
  }
  if (trigger === "update" && token.id) {
    token.autorizoDatos = await consultar(token.id);
  }
  return token;
}
