import type { ScreenName, WallConfig } from "./types";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** Default name for the n-th screen, when the user hasn't named it. */
export function defaultScreenName(index: number): ScreenName {
  return { index, custom: null };
}

/**
 * The name shown for a screen. A default name is generated in the current
 * language on every call (TR "Ana Ekran" / "Ekran 2", EN "Main Screen" /
 * "Screen 2"); a custom name is returned exactly as the user typed it.
 */
export function screenDisplayName(name: ScreenName, t: Translate): string {
  if (name.custom !== null) return name.custom;
  return name.index === 1 ? t("screen.default.main") : t("screen.default.n", { n: name.index });
}

/**
 * Applies text the user typed into the name field. Blank -> back to the
 * default name; the current language's default text -> stays default;
 * anything else -> custom name, fixed across language changes.
 * The sequence number is always kept, so a cleared name returns to "Ekran 3" etc.
 */
export function renameScreen(name: ScreenName, typed: string, t: Translate): ScreenName {
  const text = typed.trim() === "" ? "" : typed;
  if (text === "" || text === screenDisplayName(defaultScreenName(name.index), t)) {
    return defaultScreenName(name.index);
  }
  return { index: name.index, custom: text };
}

/** Next sequence number for a new screen (never reuses a number still on screen). */
export function nextScreenIndex(screens: Pick<WallConfig, "name">[]): number {
  return Math.max(0, ...screens.map((s) => s.name.index)) + 1;
}

// Default names older versions stored as plain text, in either language.
const LEGACY_MAIN = /^(Ana Ekran|Main Screen)$/;
const LEGACY_NUMBERED = /^(?:Ekran|Screen) (\d+)$/;

/**
 * Reads a screen name from a share link. New links carry `{ index, custom }`;
 * older links carry plain text, where the old default names ("Ana Ekran",
 * "Ekran 2", ...) are treated as default names and anything else as custom.
 */
export function parseStoredScreenName(raw: unknown, fallbackIndex: number): ScreenName {
  if (typeof raw === "object" && raw !== null && "index" in raw) {
    const { index, custom } = raw as { index: unknown; custom?: unknown };
    const safeIndex = typeof index === "number" && Number.isInteger(index) && index > 0 ? index : fallbackIndex;
    return typeof custom === "string" && custom.trim() !== "" ? { index: safeIndex, custom } : defaultScreenName(safeIndex);
  }
  if (typeof raw !== "string" || raw.trim() === "") return defaultScreenName(fallbackIndex);
  const text = raw.trim();
  if (LEGACY_MAIN.test(text)) return defaultScreenName(1);
  const numbered = LEGACY_NUMBERED.exec(text);
  if (numbered) return defaultScreenName(Number(numbered[1]));
  return { index: fallbackIndex, custom: raw };
}
