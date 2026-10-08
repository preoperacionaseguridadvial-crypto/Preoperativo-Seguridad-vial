import { afterEach, describe, expect, it } from "vitest";
import { getSignedReadUrl } from "@/lib/storage/s3";

// `getSignedReadUrl` solo firma de forma local (no hace red): alcanza con leer
// el host de la URL resultante para saber qué cliente se usó.
const ORIGINAL = process.env.S3_PUBLIC_ENDPOINT;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.S3_PUBLIC_ENDPOINT;
  else process.env.S3_PUBLIC_ENDPOINT = ORIGINAL;
});

describe("getSignedReadUrl — endpoint de lectura", () => {
  it("sin S3_PUBLIC_ENDPOINT firma contra S3_ENDPOINT", async () => {
    delete process.env.S3_PUBLIC_ENDPOINT;
    const url = new URL(await getSignedReadUrl("fotos/a.jpg"));
    expect(url.origin).toBe(new URL(process.env.S3_ENDPOINT!).origin);
  });

  it("con S3_PUBLIC_ENDPOINT firma contra ese endpoint (path-style, mismo bucket)", async () => {
    process.env.S3_PUBLIC_ENDPOINT = "http://192.168.1.7:9010";
    const url = new URL(await getSignedReadUrl("fotos/a.jpg"));
    expect(url.origin).toBe("http://192.168.1.7:9010");
    expect(url.pathname).toBe(`/${process.env.S3_BUCKET}/fotos/a.jpg`);
    expect(url.searchParams.get("X-Amz-Credential")).toContain(process.env.S3_ACCESS_KEY_ID);
  });

  it("si la variable cambia, el cliente de firma la sigue", async () => {
    process.env.S3_PUBLIC_ENDPOINT = "http://10.0.0.5:9010";
    const url = new URL(await getSignedReadUrl("fotos/a.jpg"));
    expect(url.origin).toBe("http://10.0.0.5:9010");
  });
});
