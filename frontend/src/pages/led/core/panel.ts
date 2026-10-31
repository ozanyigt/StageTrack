import type { HesapModu, InventoryItem, PanelSize, WallConfig } from "./types";

// What the pages show about a panel model itself (size, watt, current, names). The job calculation
// (circuits, distribution, processor options) runs on the server: POST /api/calc/evaluate, lib/evaluation.ts.

/** Parse "500x1000" -> { widthMm: 500, heightMm: 1000 } */
export function parsePanelBoyut(boyut: string): PanelSize {
  const match = /^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)$/i.exec(boyut.trim());
  if (!match) {
    throw new Error(`Geçersiz panel boyutu: "${boyut}"`);
  }
  return { widthMm: Number(match[1]), heightMm: Number(match[2]) };
}

/** Watt per panel for the power mode (Watt_Max / Watt_Ort); null when that cell is blank. */
export function panelWatt(panel: Pick<InventoryItem, "Watt_Max" | "Watt_Ort">, mode: HesapModu): number | null {
  const value = mode === "max" ? panel.Watt_Max : panel.Watt_Ort;
  return value != null && Number.isFinite(value) ? value : null;
}

/** I = P / (V x power factor) */
export function wattToCurrent(watts: number, voltage: number, powerFactor: number): number {
  if (voltage <= 0) throw new Error("Voltaj sıfırdan büyük olmalı");
  if (powerFactor <= 0) throw new Error("Güç faktörü sıfırdan büyük olmalı");
  return watts / (voltage * powerFactor);
}

/** Current per panel for the power mode at the given voltage; null when the watt value is blank. */
export function panelCurrent(
  panel: Pick<InventoryItem, "Watt_Max" | "Watt_Ort">,
  mode: HesapModu,
  voltage: number,
  powerFactor: number,
): number | null {
  const watt = panelWatt(panel, mode);
  return watt === null ? null : wattToCurrent(watt, voltage, powerFactor);
}

/** Panel name for buttons and reports, e.g. "Inficolor P1.9 500x500". */
export function panelDisplayName(panel: Pick<InventoryItem, "Marka" | "Model" | "Panel_Boyut">): string {
  return `${panel.Marka} ${panel.Model} ${panel.Panel_Boyut}`;
}

/** A screen's panel and size for the Excel export / PDF, e.g. "Inficolor P1.9 500x500, 4x3" (screen must have a panel). */
export function panelLabel(wall: WallConfig): string {
  return `${panelDisplayName(wall.panel!)}, ${wall.widthPanels}x${wall.heightPanels}`;
}
