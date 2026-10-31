import type { ScreenEvaluationDto, ScreenPowerDto } from "../../../../api/ledTypes";

/**
 * 3D Sahne's counters and the selected screen's figures: read from the server's calculation (the same one every page
 * shows), never worked out here.
 */

export interface StageTotals {
  panels: number;
  areaM2: number;
  wattMax: number;
  weightKg: number;
}

/** The figures of the screens shown (hidden ones are left out); a screen without a result counts nothing. */
export function stageTotals(ids: string[], evaluation: ScreenEvaluationDto[] | undefined): StageTotals {
  const totals: StageTotals = { panels: 0, areaM2: 0, wattMax: 0, weightKg: 0 };
  for (const id of ids) {
    const power = powerOf(id, evaluation);
    if (!power) continue;
    totals.panels += power.panelCount;
    totals.areaM2 += power.areaM2;
    totals.wattMax += power.totalWattMax;
    totals.weightKg += power.totalWeightKg;
  }
  return totals;
}

export function powerOf(id: string, evaluation: ScreenEvaluationDto[] | undefined): ScreenPowerDto | null {
  return evaluation?.find((e) => e.id === id)?.power ?? null;
}

/** The screen's current: its circuits' currents as the server worked them out, amperes. */
export function screenCurrentA(power: ScreenPowerDto): number {
  return power.circuits.reduce((sum, c) => sum + c.currentA, 0);
}
