"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth/config";
import { COOKIE_SESION_NAVEGADOR } from "@/lib/auth/recordarme";

export async function loginAction(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  const callbackUrl = formData.get("callbackUrl");
  // Un checkbox desmarcado no viaja en el formulario.
  const recordar = formData.get("recordar") !== null;

  // Sin Recordarme la sesión debe durar hasta cerrar el navegador: el marcador
  // no lleva vencimiento (lo borra el navegador al cerrarse) y Proxy cierra la
  // sesión si el token pide "no recordar" y el marcador ya no está.
  const jar = await cookies();
  if (recordar) {
    jar.delete(COOKIE_SESION_NAVEGADOR);
  } else {
    jar.set(COOKIE_SESION_NAVEGADOR, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  try {
    await signIn("credentials", {
      email,
      password,
      recordar: String(recordar),
      redirectTo: typeof callbackUrl === "string" && callbackUrl ? callbackUrl : "/",
    });
  } catch (error) {
    // `signIn` usa `redirect()` internamente en caso de éxito, lo cual
    // funciona lanzando una excepción especial de Next.js que NO es un
    // AuthError y debe volver a lanzarse tal cual.
    if (error instanceof AuthError) {
      redirect(`/login?error=${error.type}`);
    }
    throw error;
  }
}
