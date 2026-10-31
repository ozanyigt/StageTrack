import type { Dil, InventoryItem } from "./types";

const LOCALES: Record<Dil, string> = { tr: "tr-TR", en: "en-US" };

/** Locale-aware number, e.g. tr: 2632 -> "2.632", 722 (1 digit) -> "722,0". */
export function formatNumber(value: number, lang: Dil, fractionDigits = 0): string {
  return value.toLocaleString(LOCALES[lang], {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** 15 -> "+15°", -2.5 -> "-2,5°", 0 -> "0°". */
function formatDegrees(value: number, signed: boolean): string {
  const text = `${String(Math.abs(value)).replace(".", ",")}°`;
  if (!signed || value === 0) return text;
  return value > 0 ? `+${text}` : `-${text}`;
}

/**
 * Curve angle range for the inventory table / export: "-10° … +15° (2,5°)".
 * "–" when any of the three values is blank, or the range is invalid (min > max, step ≤ 0).
 */
export function formatAngleRange(item: Pick<InventoryItem, "Aci_Min" | "Aci_Max" | "Aci_Adim">): string {
  const { Aci_Min: min, Aci_Max: max, Aci_Adim: step } = item;
  if (min == null || max == null || step == null || min > max || step <= 0) return "–";
  return `${formatDegrees(min, true)} … ${formatDegrees(max, true)} (${formatDegrees(step, false)})`;
}

/** "520 panel" (TR) / "520 panels", "1 panel" (EN) — number formatted for the language. */
export function panelCountText(
  count: number,
  t: (key: string, vars?: Record<string, string | number>) => string,
  lang: Dil,
): string {
  return t(count === 1 ? "inventory.panelCount.one" : "inventory.panelCount.other", { count: formatNumber(count, lang) });
}

/** Calendar date in the UI language ("12.10.2026" / "12/10/2026"). */
export function formatDate(iso: string, lang: Dil): string {
  return new Date(iso).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-GB");
}

/** Whole days from now until the date (0 = today or past). */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000));
}
