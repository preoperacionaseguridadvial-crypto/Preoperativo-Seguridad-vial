import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { authConfig } from "@/lib/auth/base-config";
import { jwtConAutorizacion } from "@/lib/auth/jwt-autorizacion";
import { tieneAutorizacionDatos } from "@/lib/legal/autorizacion-datos";

// Config completa de NextAuth (Node.js runtime): extiende authConfig con el
// Credentials provider, que depende de bcrypt y Prisma Client — por eso NO
// se usa directamente en middleware.ts (Edge Runtime). Ver
// lib/auth/base-config.ts para el detalle de por qué está separado así.
//
// `unstable_update` refresca el token desde el servidor: lo usa
// app/autorizacion después de registrar la firma, para que Proxy deje pasar
// al usuario sin obligarlo a iniciar sesión de nuevo.
export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    jwt: (params) => jwtConAutorizacion(params, tieneAutorizacionDatos),
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : undefined;
        const password = typeof credentials?.password === "string" ? credentials.password : undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.activo) return null;

        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          autorizoDatos: await tieneAutorizacionDatos(user.id),
        };
      },
    }),
  ],
  events: {
    // Prueba de concepto del audit log: registra cada login exitoso con la
    // hora del servidor. Los futuros eventos auditables (envío/aprobación/
    // rechazo de inspecciones, etc.) se enganchan de la misma forma.
    async signIn({ user }) {
      if (!user.id) return;
      await logAudit({
        userId: user.id,
        action: "LOGIN",
        entityType: "User",
        entityId: user.id,
      });
    },
  },
});
