// Crea el primer usuario ADMINISTRADOR en una base sin usuarios (por ejemplo
// producción en Railway, donde el seed no crea usuarios demo). Todo se pide de
// forma interactiva: la URL de la base y la contraseña se escriben ocultas, así
// no quedan en el historial de la terminal ni en argumentos del proceso.
//
//   npx tsx scripts/crear-admin.ts
//
// Correrlo en PowerShell o CMD: la entrada oculta necesita una terminal real
// (en Git Bash/mintty usar `winpty npx tsx scripts/crear-admin.ts`).
//
// Nunca modifica un usuario existente: si el email ya existe, se detiene.
import { createInterface } from "node:readline/promises";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../generated/prisma/client";
import {
  describirBase,
  diagnosticarUrl,
  limpiarUrlPegada,
  MIN_PASSWORD_ADMIN,
  validarDatosAdmin,
} from "./crear-admin-validacion";

const COSTO_BCRYPT = 10;

async function preguntar(texto: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(texto);
  } finally {
    rl.close();
  }
}

/** Lee una línea sin mostrarla en pantalla (requiere una terminal real). */
function preguntarOculto(texto: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    stdout.write(texto);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let valor = "";
    const alTeclear = (chunk: string) => {
      for (const caracter of chunk) {
        if (caracter === "\r" || caracter === "\n") {
          terminar();
          stdout.write("\n");
          resolve(valor);
          return;
        }
        if (caracter === "\u0003") {
          terminar();
          stdout.write("\n");
          reject(new Error("Cancelado."));
          return;
        }
        if (caracter === "\u007f" || caracter === "\b") {
          valor = valor.slice(0, -1);
        } else {
          valor += caracter;
        }
      }
    };
    const terminar = () => {
      stdin.off("data", alTeclear);
      stdin.setRawMode(false);
      stdin.pause();
    };
    stdin.on("data", alTeclear);
  });
}

async function main() {
  if (!process.stdin.isTTY) {
    throw new Error(
      "Se necesita una terminal interactiva. Usá PowerShell o CMD, o en Git Bash: winpty npx tsx scripts/crear-admin.ts",
    );
  }

  console.log("Crear el primer usuario Administrador\n");
  console.log("Pegá la URL con clic derecho (no se va a ver) y apretá Enter.");
  const url = limpiarUrlPegada(await preguntarOculto("URL de la base (DATABASE_PUBLIC_URL de Railway, oculta): "));
  const base = describirBase(url);
  if (!base) throw new Error(diagnosticarUrl(url));
  console.log(`URL recibida (${url.length} caracteres).`);

  const prisma = new PrismaClient({ adapter: new PrismaPg(url) });
  try {
    const usuarios = await prisma.user.count();
    console.log(`Base: ${base} (usuarios actuales: ${usuarios})\n`);

    const nombre = await preguntar("Nombre completo: ");
    const email = await preguntar("Email (con el que va a iniciar sesión): ");
    const cedula = await preguntar("Cédula (opcional, Enter para omitir): ");
    const password = await preguntarOculto(`Contraseña (mínimo ${MIN_PASSWORD_ADMIN} caracteres, oculta): `);
    const confirmacion = await preguntarOculto("Repetí la contraseña: ");

    const validacion = validarDatosAdmin({ nombre, email, cedula, password, confirmacion });
    if (!validacion.ok) throw new Error(validacion.error);
    const datos = validacion.datos;

    if (await prisma.user.findUnique({ where: { email: datos.email } })) {
      throw new Error(`Ya existe un usuario con el email ${datos.email}. No se modificó nada.`);
    }

    const confirmar = await preguntar(
      `\nSe va a crear ADMINISTRADOR "${datos.nombre}" <${datos.email}> en ${base}. ¿Confirmás? (s/n): `,
    );
    if (confirmar.trim().toLowerCase() !== "s") {
      console.log("Cancelado. No se creó nada.");
      return;
    }

    await prisma.user.create({
      data: {
        name: datos.nombre,
        email: datos.email,
        cedula: datos.cedula,
        role: Role.ADMINISTRADOR,
        passwordHash: await bcrypt.hash(datos.password, COSTO_BCRYPT),
        // Un Administrador no opera vehículos.
        conductorActivo: false,
      },
    });
    console.log(`\nListo: Administrador ${datos.email} creado. Ya puede iniciar sesión.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`\nError: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
