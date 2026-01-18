export function normalizePhone(phoneStr?: string | null) {
  if (!phoneStr) return null;
  const clean = String(phoneStr).replace(/\D/g, "");
  if (clean.startsWith("48") && clean.length === 11) {
    return clean.slice(2);
  }
  if (clean.startsWith("0048") && clean.length === 13) {
    return clean.slice(4);
  }
  return clean || null;
}
