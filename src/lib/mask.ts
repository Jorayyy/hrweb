/** Masks all but the last 4 digits, preserving separators: "123-456-789-012" -> "***-***-***-012". */
export function maskId(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return null;
  if (digits.length <= 4) return "*".repeat(digits.length);
  let toMask = digits.length - 4;
  return value.replace(/\d/g, () => (toMask-- > 0 ? "*" : ""));
}
