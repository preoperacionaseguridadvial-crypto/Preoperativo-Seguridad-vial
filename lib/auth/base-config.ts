import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/client";

/**
 * Config compartida entre proxy.ts (antes "middleware.ts") y la config
 * completa de NextAuth (lib/auth/config.ts).
 *
 * IMPORTANTE: este archivo NO debe importar bcrypt, Prisma Client, ni
 * ningún módulo nativo de Node. proxy.ts se mantiene liviano a propósito
 * (evita cargar el Credentials provider completo en cada request que pasa
 * por Proxy) — `providers` se deja vacío acá. lib/auth/config.ts agrega el
 * Credentials provider (que sí necesita bcrypt + Prisma) para el resto de
 * la app.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
};
