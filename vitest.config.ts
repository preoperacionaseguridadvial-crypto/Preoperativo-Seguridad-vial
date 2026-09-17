import path from "node:path";
import { defineConfig } from "vitest/config";

// Next.js 16 usa Turbopack para dev/build, pero Vitest corre por fuera de esa
// pipeline (no hay plugin de Vitest para Turbopack todavía) — se usa el
// motor Vite estándar de Vitest solo para tests, sin tocar la config de
// Next.js. No se necesita @vitejs/plugin-react: los tests cubren reglas de
// negocio del backend (server actions, RBAC de proxy.ts), no componentes.
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "generated/**"],
    // Los tests de integración pegan contra Postgres real (contenedor
    // Docker existente, DB separada `preoperacional_test`) — más lentos que
    // un mock, se sube el timeout por defecto.
    testTimeout: 15000,
    hookTimeout: 20000,
    // Serializado: las pruebas de integración comparten la misma base y se
    // limpian tabla por tabla entre tests (ver test/helpers/db.ts); correr
    // archivos en paralelo generaría carreras entre esas limpiezas.
    fileParallelism: false,
  },
  resolve: {
    alias: [
      // Espeja el path mapping "@/*" -> "./*" de tsconfig.json.
      { find: "@", replacement: path.resolve(__dirname) },
      // "server-only" usa el export condition "react-server" para resolver
      // a un no-op; fuera de Next.js (Vitest corre en Node plano) resuelve
      // a su entrada "default", que hace `throw` a propósito (ver
      // node_modules/server-only/index.js). Se reemplaza por un stub vacío
      // para poder importar server actions/queries directamente en tests.
      { find: "server-only", replacement: path.resolve(__dirname, "test/mocks/server-only.ts") },
    ],
  },
});
