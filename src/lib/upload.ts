export const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_PHOTO_BYTES = 200 * 1024;

export type UploadResult = { ok: true; value: string | null } | { ok: false; error: string };

/** Reads an uploaded image into a data-URI, or null when no file was sent. */
export async function readImageFile(
  input: FormDataEntryValue | null,
  opts: { label: string; maxBytes: number; types: readonly string[] },
): Promise<UploadResult> {
  if (!(input instanceof File) || input.size === 0) return { ok: true, value: null };
  if (input.size > opts.maxBytes) {
    return {
      ok: false,
      error: `${opts.label} must be ${Math.round(opts.maxBytes / 1024)}KB or smaller.`,
    };
  }
  if (!opts.types.includes(input.type)) {
    return { ok: false, error: `${opts.label} must be a PNG, JPG or WebP file.` };
  }
  const buffer = Buffer.from(await input.arrayBuffer());
  return { ok: true, value: `data:${input.type};base64,${buffer.toString("base64")}` };
}
