import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cliente S3-compatible genérico: funciona igual con AWS S3, Cloudflare R2 o
// MinIO sin cambiar código, configurado 100% por variables de entorno (ver
// .env.example). `S3_ENDPOINT` es opcional — solo se define para R2/MinIO;
// si no está presente, el SDK usa el endpoint público de AWS S3 según
// `S3_REGION`. `forcePathStyle` se activa junto con `S3_ENDPOINT` porque
// R2/MinIO normalmente no resuelven el estilo "virtual-hosted" (bucket como
// subdominio) que AWS S3 sí soporta.
//
// Nunca se guarda una URL pública permanente en la base de datos: solo el
// `s3Key` (ver modelo `Photo` en prisma/schema.prisma). Las URLs de lectura
// se firman on-demand con `getSignedReadUrl`.
const globalForS3 = globalThis as unknown as {
  s3Client?: S3Client;
};

function createS3Client() {
  const endpoint = process.env.S3_ENDPOINT;
  return new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
}

export const s3Client: S3Client = globalForS3.s3Client ?? createS3Client();

if (process.env.NODE_ENV !== "production") {
  globalForS3.s3Client = s3Client;
}

function getBucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error("Falta la variable de entorno S3_BUCKET.");
  }
  return bucket;
}

/**
 * Sube un objeto al bucket configurado y devuelve el `s3Key` guardado
 * (nunca una URL). Usado por `subirFotoNovedad`
 * (lib/inspections/actions.ts) para adjuntar fotos a una Novedad.
 */
export async function uploadObject(params: {
  key: string;
  body: Buffer | Uint8Array;
  contentType?: string;
}): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
  return params.key;
}

/**
 * Borra un objeto del bucket configurado. Usado como acción compensatoria
 * cuando una foto ya se subió a S3 pero la escritura en base de datos que
 * la referenciaba falla después (ej. `crearVehiculo`/`actualizarVehiculo`
 * en lib/admin/vehicle-actions.ts) — evita dejar objetos huérfanos en el
 * bucket compartido.
 */
export async function deleteObject(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

/**
 * Genera una URL de lectura firmada y temporal para un `s3Key` guardado.
 * Se usa on-demand (ej. futura pantalla de aprobación del Supervisor),
 * nunca se persiste la URL resultante.
 */
export async function getSignedReadUrl(key: string, expiresInSeconds = 900): Promise<string> {
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}
