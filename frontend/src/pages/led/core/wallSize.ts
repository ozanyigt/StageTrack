/**
 * Screen size in panels and metres — the one conversion every screen card uses (Güç / Processor, Simülasyon,
 * Pixel Map). The panel count is what is stored; metres are always derived from it.
 */

/** Metres of `panels` panels of `mm` each (the panel count is what is stored; metres are always derived). */
export function panelsToMeters(panels: number, mm: number): number {
  return (mm * panels) / 1000;
}

/** A panel count: whole, at least 1 (and at most `max`). Metres typed in are turned into panels with this too. */
export function wholePanels(v: number, max = Infinity): number {
  return Math.min(max, Math.max(1, Math.round(v)));
}

/** The panel count nearest to `meters` with panels of `mm`. */
export function metersToPanels(meters: number, mm: number, max = Infinity): number {
  return wholePanels((meters * 1000) / mm, max);
}
