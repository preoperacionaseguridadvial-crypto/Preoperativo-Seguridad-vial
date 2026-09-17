// Prisma 7 config (replaces the old `package.json#prisma` block). Used by
// the Prisma CLI (`generate`, `migrate`, `db seed`) — Next.js itself loads
// .env on its own and does not read this file.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
