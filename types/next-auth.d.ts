import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/client";

declare module "next-auth" {
  interface User {
    id: string;
    role: Role;
    // Autorización de tratamiento de datos ya firmada (lib/legal).
    autorizoDatos: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      autorizoDatos: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    autorizoDatos: boolean;
  }
}
