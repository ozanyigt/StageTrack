import type { LedExtender, LedPanel, LedProcessor } from '../../../api/ledTypes';
import type { ExtenderRow, InventoryItem, IslemciRow, Konum, PanelTipi } from './types';

/**
 * The seam between StageTrack's inventory and the screens ported from Panelyze. Those screens were written
 * against row shapes with Turkish field names (one Excel row per panel per location); rather than rewrite five
 * thousand lines of drawing and wiring code, the rows are built here from StageTrack equipment.
 *
 * The only real difference is location: Panelyze kept one row per panel per warehouse, StageTrack scopes every
 * record to a firm location already, so each panel becomes exactly one row.
 */

const PANEL_TYPE_LABELS: Record<LedPanel['panelType'], PanelTipi> = {
  Flat: 'Flat',
  Curve: 'Curve',
  SuperCurve: 'Super Curve',
  CurveCorner: 'Curve/Corner',
  Corner: 'Corner',
  Flexi: 'Flexi',
  Floor: 'Floor',
};

/** The firm location the screens work in; a single place, because StageTrack already split the data by location. */
export const currentLocation = (name: string): Konum => ({ id: 'company', name, countryCode: '' });

export function toInventoryItem(panel: LedPanel, location: Konum): InventoryItem {
  return {
    PanelModelId: panel.equipmentId,
    Marka: panel.brand ?? '',
    Model: `${panel.code} · ${panel.name}`,
    Pitch_mm: panel.pitchMm,
    Panel_Boyut: `${panel.widthMm}x${panel.heightMm}`,
    Tip: PANEL_TYPE_LABELS[panel.panelType],
    Grup: panel.group,
    Konum: location,
    Adet: panel.stock,
    Piksel_G: panel.pixelWidth,
    Piksel_Y: panel.pixelHeight,
    Agirlik_kg: panel.weightKg ?? 0,
    Watt_Max: panel.wattMax ?? null,
    Watt_Ort: panel.wattAvg ?? null,
    Max_Atlama: panel.maxLink ?? null,
    Ort_Atlama: panel.avgLink ?? null,
    Uyumlu_Islemci: panel.hasExclusiveProcessors ? panel.compatibleProcessorIds : undefined,
    Aci_Min: panel.angleMin ?? null,
    Aci_Max: panel.angleMax ?? null,
    Aci_Adim: panel.angleStep ?? null,
    Receiving_Kart: panel.receivingCard ?? null,
    PWM_Hz: panel.pwmHz ?? null,
  };
}

export const toProcessorRow = (p: LedProcessor): IslemciRow => ({
  Id: p.equipmentId,
  Marka: p.brand ?? '',
  Model: `${p.code} · ${p.name}`,
  Toplam_Piksel: p.totalPixels,
  Ethernet_Port: p.ethernetPorts,
  Port_Basi_Piksel: p.pixelsPerPort ?? null,
  OPT_Port: p.optPorts,
  Adet: p.stock,
});

export const toExtenderRow = (e: LedExtender): ExtenderRow => ({
  Id: e.equipmentId,
  Marka: e.brand ?? '',
  Model: `${e.code} · ${e.name}`,
  Ethernet_Port: e.ethernetPorts,
  Fiber_Port: e.fiberPorts,
  Max_Piksel: e.maxPixels,
  Adet: e.stock,
});
