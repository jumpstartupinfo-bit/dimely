/** A percentage between 0 and 100, otherwise the standard default. Never trust a stored value blindly. */
export function percentOrDefault(raw: string | null, fallback: number): number {
  if (raw === null) return fallback
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : fallback
}

/** A number inside [min, max], otherwise the fallback. Used for settings that come from the database. */
export function numberInRange(raw: string | null, min: number, max: number, fallback: number): number {
  if (raw === null) return fallback
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback
}
