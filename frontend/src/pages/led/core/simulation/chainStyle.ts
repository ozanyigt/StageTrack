/**
 * How Simülasyon tells its chains apart (power circuits H1, H2, … and data ports P1, P2, …): a fill colour and a
 * line pattern each. Colours alone fail for colour-blind eyes, so the pattern changes too — solid, dashed, dotted,
 * dash-dot — and with 10 colours and 4 patterns the first 20 chains never share both. The route line and the arrows
 * are drawn in INK over the fill, so every colour is light enough for INK to read on it (checked by the tests).
 */

/** Ordered so that neighbouring chains (H1 / H2) differ in hue as much as possible. */
export const CHAIN_COLORS = [
  "#60a5fa", // blue
  "#fbbf24", // amber
  "#f472b6", // pink
  "#4ade80", // green
  "#c084fc", // violet
  "#fb923c", // orange
  "#2dd4bf", // teal
  "#f87171", // red
  "#a3e635", // lime
  "#a5b4fc", // indigo
] as const;

/** The dark ink of lines, arrows and numbers drawn over a chain's fill (the app's darkest surface). */
export const CHAIN_INK = "#0b0c10";

export type ChainPattern = "solid" | "dashed" | "dotted" | "dashdot";
export const CHAIN_PATTERNS: readonly ChainPattern[] = ["solid", "dashed", "dotted", "dashdot"];

export function chainColor(index: number): string {
  return CHAIN_COLORS[((index % CHAIN_COLORS.length) + CHAIN_COLORS.length) % CHAIN_COLORS.length];
}

export function chainPattern(index: number): ChainPattern {
  return CHAIN_PATTERNS[((index % CHAIN_PATTERNS.length) + CHAIN_PATTERNS.length) % CHAIN_PATTERNS.length];
}

/** The SVG dash array of a pattern for a line `width` wide (dots need a round line cap); undefined = solid. */
export function dashArray(pattern: ChainPattern, width: number): string | undefined {
  const w = width;
  switch (pattern) {
    case "dashed":
      return `${w * 4} ${w * 2.5}`;
    case "dotted":
      return `${w * 0.01} ${w * 2.2}`;
    case "dashdot":
      return `${w * 5} ${w * 2} ${w * 0.01} ${w * 2}`;
    default:
      return undefined;
  }
}

/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
