import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

let cachedKey: Buffer | null = null;
let warned = false;

function dataKey(): Buffer | null {
  const secret = process.env.DATA_ENCRYPTION_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATA_ENCRYPTION_KEY is required in production");
    }
    if (!warned) {
      console.warn("DATA_ENCRYPTION_KEY not set — statutory IDs stored in plaintext (dev only)");
      warned = true;
    }
    return null;
  }
  if (!cachedKey) cachedKey = createHash("sha256").update(secret).digest();
  return cachedKey;
}

/** AES-256-GCM. Returns plaintext when no key is configured (dev only). */
export function encryptField(value: string | null): string | null {
  if (value == null || value === "") return value;
  const key = dataKey();
  if (!key) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return PREFIX + [iv, cipher.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
}

/** Legacy plaintext (no prefix) passes through; re-encrypted on next write. */
export function decryptField(value: string | null): string | null {
  if (value == null || !value.startsWith(PREFIX)) return value;
  const key = dataKey();
  if (!key) throw new Error("DATA_ENCRYPTION_KEY is required to read encrypted data");
  const parts = value.slice(PREFIX.length).split(".");
  if (parts.length !== 3) return value;
  const [iv, tag, ct] = parts.map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function isEncrypted(value: string | null): boolean {
  return value?.startsWith(PREFIX) ?? false;
}
