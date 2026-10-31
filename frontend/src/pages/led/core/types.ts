// Panel physical/electrical size string like "500x1000"
export type PanelBoyut = string;

/** A built-in inventory group (the four every workspace has). */
export type BuiltInGrup = "Indoor" | "Outdoor" | "Poster" | "Other";
/**
 * Inventory group (Envanter / Stok Durumu sections, filters, exports); never used in a calculation. A built-in group's
 * name or a custom group's id (see lib/panelGroups).
 */
export type Grup = BuiltInGrup | (string & {});
/**
 * Inventory location (warehouse) from the API. Compare locations by `id`; `name` is shown as is
 * in every language, `countryCode` (ISO, e.g. "TR", "AE") picks the flag.
 */
export interface Konum {
  id: string;
  name: string;
  countryCode: string;
}
/** Panel shape as shown in tables (API enum → display text, e.g. CurveCorner → "Curve/Corner"). */
export type PanelTipi = "Flat" | "Curve" | "Super Curve" | "Curve/Corner" | "Corner" | "Flexi" | "Floor";

/**
 * One panel model in one location, with that location's stock (Adet) — the shape the
 * calculations were built on (formerly one Excel row), now built from the API by lib/inventoryAdapter.
 */
export interface InventoryItem {
  /** API id of the panel model (the same model in two locations has the same id). */
  PanelModelId: string;
  /** The panel's kind (an LED-panel one); missing in old test fixtures. */
  KindId?: string;
  /** The kind's own fields' values, by field id. */
  CustomValues?: Record<string, string>;
  Marka: string;
  Model: string;
  Pitch_mm: number;
  Panel_Boyut: PanelBoyut;
  Tip: PanelTipi;
  Grup: Grup;
  /** The custom group's name; null / missing for a built-in group. */
  GrupAdi?: string | null;
  Konum: Konum;
  Adet: number;
  Piksel_G: number;
  Piksel_Y: number;
  Agirlik_kg: number;
  Not?: string;
  /** Watt per panel at max / average power. null/missing = blank in Excel (no power figures). */
  Watt_Max?: number | null;
  Watt_Ort?: number | null;
  /**
   * Fixed number of panels linked on one 16A CEE connection, at max / average
   * power (Excel: Max_Atlama / Ort_Atlama). null/missing = blank in Excel ->
   * computed from the panel current instead.
   */
  Max_Atlama?: number | null;
  Ort_Atlama?: number | null;
  /**
   * "Özel işlemcisi var": the processors this panel only works with, as "Marka Model". Missing = not exclusive, any
   * processor may be used.
   */
  Uyumlu_Islemci?: string[];
  /**
   * Curve angle range in degrees (Excel: Aci_Min / Aci_Max / Aci_Adim).
   * null/missing = blank (non-curve panels). Shown only in the inventory table and its export.
   */
  Aci_Min?: number | null;
  Aci_Max?: number | null;
  Aci_Adim?: number | null;
  /**
   * Receiving card model ("Novastar A8s") and PWM frequency (Hz). Info only: shown in the inventory tables, exports
   * and the screen report, never used in a calculation. null/missing = blank ("—").
   */
  Receiving_Kart?: string | null;
  PWM_Hz?: number | null;
}

export type HesapModu = "max" | "ort";
export type ActiveTab = "inventory" | "power" | "processor" | "pixelmap" | "stock" | "simulation" | "stage-3d" | "logistics";
export type Voltaj = 110 | 220 | 230 | 240;
export type Dil = "tr" | "en";

export interface DistributionOption {
  id: string;
  labelKey: string;
  ampsPerPhase: number;
  socapexOutputs: number;
}

export interface Settings {
  powerFactor: number;
  fuseAmpere: number;
  deratingPercent: number;
  circuitsPerSocapex: number;
  distributionOptions: DistributionOption[];
}

/**
 * A screen's name. `custom` is null while the user hasn't named it — the
 * shown name is then generated from `index` in the current language
 * (see lib/screenName.ts); a custom name never changes with the language.
 */
export interface ScreenName {
  index: number;
  custom: string | null;
}

export interface WallConfig {
  id: string;
  name: ScreenName;
  panel: InventoryItem | null;
  /** Columns, corner columns included. */
  widthPanels: number;
  heightPanels: number;
  /** Areas cut out of the screen (Simülasyon; Pro / Team). */
  cutouts?: Cutout[];
  /** Corner columns (Simülasyon; Pro / Team). */
  corners?: ScreenCorner[];
  /** How the panels are chained into power circuits (Simülasyon; Pro / Team). Missing = the default. */
  powerLayout?: PowerLayout;
  /** The order of the data chains (Simülasyon; Pro / Team). Missing = the power wiring's order. */
  signalLayout?: SignalLayout;
  /** A curved screen (Simülasyon): the server fits the joint angles to the panel. Missing = flat. */
  curve?: ScreenCurve;
}

/** A curve as asked for: the whole arc in degrees, or the radius in metres; concave (ends towards the audience) or convex. */
export interface ScreenCurve {
  mode: "Arc" | "Radius";
  value: number;
  direction: "Concave" | "Convex";
}

/**
 * A screen's power wiring: the cable snakes along the columns or the rows, starting at a corner (seen from the
 * audience). keepLinesWhole: a column / row starts a new circuit unless all of it still fits on the current one.
 * The default (columns from the bottom left, lines not kept whole) is the order the CEE count has always assumed.
 */
export interface PowerLayout {
  direction: "Columns" | "Rows";
  start: "BottomLeft" | "BottomRight" | "TopLeft" | "TopRight";
  keepLinesWhole: boolean;
  /** Every other line turns back (zigzag); missing = on. */
  serpentine?: boolean;
}

/** The data chains' order through the panels: like a power layout, without keeping lines whole. */
export interface SignalLayout {
  direction: PowerLayout["direction"];
  start: PowerLayout["start"];
  serpentine: boolean;
}

/** A cut-out in panels: size and distance from the screen's left and bottom edge. */
export interface Cutout {
  width: number;
  height: number;
  left: number;
  bottom: number;
}

/** A corner column: after how many columns it stands (it is that column, 0-based) and its corner panel. */
export interface ScreenCorner {
  afterColumn: number;
  panel: InventoryItem;
}

export interface PanelSize {
  widthMm: number;
  heightMm: number;
}

export interface CircuitInfo {
  id: string;
  panelCount: number;
  currentA: number;
  screenId: string;
  screenName: string;
}

export interface PhaseAssignment {
  phase: "L1" | "L2" | "L3";
  circuits: CircuitInfo[];
  totalCurrentA: number;
}

export interface DistributionRecommendation {
  option: DistributionOption;
  unitsNeeded: number;
}

/**
 * Per-screen power result: phase distribution and distribution-box
 * recommendation computed from ONLY this screen's own circuits.
 */
export interface ScreenPowerBlock {
  screenId: string;
  screenName: string;
  panelLabel: string;
  /** The panel's receiving card / PWM, for the report (info only). */
  receivingCard?: string | null;
  pwmHz?: number | null;
  /** Location of the screen's panel — shown as a flag in the print report. */
  konum?: Konum;
  output: ScreenCalcOutputLike;
  phases: PhaseAssignment[];
  perPhaseMaxA: number;
  distribution: DistributionRecommendation[];
}

/**
 * Job-wide power summary. totalSocapex is the SUM of each screen's own
 * socapexNeeded (screens never share a socapex cable). phases/distribution
 * combine every screen's circuits, since a single distribution box can feed
 * multiple screens across L1/L2/L3.
 */
export interface JobPowerSummary {
  totalWattMax: number;
  totalWattAvg: number;
  totalCurrentA: number;
  totalCircuits: number;
  totalSocapex: number;
  phases: PhaseAssignment[];
  perPhaseMaxA: number;
  distribution: DistributionRecommendation[];
}

/** Minimal shape calc.ts's ScreenCalcOutput satisfies (avoids a circular import). */
export interface ScreenCalcOutputLike {
  panelCount: number;
  widthMm: number;
  heightMm: number;
  /** The LED area: the panels used (cut-outs left out), m². */
  areaM2: number;
  resolutionX: number;
  resolutionY: number;
  totalWeightKg: number;
  totalWattMax: number;
  totalWattAvg: number;
  totalPixels: number;
  panelCurrentA: number;
  panelsPerCircuit: number;
  /** Where panelsPerCircuit comes from: the panel's atlama value for the mode, or the current (blank). */
  panelsPerCircuitSource: PanelsPerCircuitSource;
  circuitsNeeded: number;
  socapexNeeded: number;
  circuits: CircuitInfo[];
  /** The panel has no watt value for the selected power mode. */
  wattMissing: boolean;
}

/** "fixed" = the panel's Max_Atlama / Ort_Atlama (by power mode); "current" = computed (that value blank). */
export type PanelsPerCircuitSource = "fixed" | "current";

export interface IslemciRow {
  /** API id (calculation results refer to it); test fixtures may leave it out — then "Marka|Model" is used. */
  Id?: string;
  /** The processor's kind; missing in old test fixtures. */
  KindId?: string;
  CustomValues?: Record<string, string>;
  Marka: string;
  Model: string;
  Toplam_Piksel: number;
  Ethernet_Port: number;
  /** null = not entered; the calculation assumes 650.000 px per port. */
  Port_Basi_Piksel: number | null;
  /** 0 = direct connection: the processor drives the panels itself, no CVT / extender. */
  OPT_Port: number;
  /** Stock in one location (inventory page); null on the location-independent list the calculation uses. */
  Adet: number | null;
  Not?: string;
}

export interface ExtenderRow {
  /** API id (calculation results refer to it); test fixtures may leave it out — then "Marka|Model" is used. */
  Id?: string;
  /** The extender's kind; missing in old test fixtures. */
  KindId?: string;
  CustomValues?: Record<string, string>;
  Marka: string;
  Model: string;
  Ethernet_Port: number;
  Fiber_Port: number;
  Max_Piksel: number;
  /** Stock in one location (inventory page); null on the location-independent list the calculation uses. */
  Adet: number | null;
  Not?: string;
}

export interface ScreenProcessorBlock {
  screenId: string;
  screenName: string;
  konum?: Konum;
  /** The screen's own info, for the export / PDF ("Inficolor P1.9 500x500, 4x3"). */
  panelLabel: string;
  receivingCard?: string | null;
  pwmHz?: number | null;
  panelCount: number;
  widthMm: number;
  heightMm: number;
  /** The LED area: the panels used (cut-outs left out), m². */
  areaM2: number;
  totalWeightKg: number;
  islemci: IslemciRow;
  /** null = direct connection (processor OPT_Port 0), no extender. */
  extender: ExtenderRow | null;
  resolutionX: number;
  resolutionY: number;
  totalPixels: number;
  extenders: number;
  processors: number;
  utilizationPercent: number;
}

export interface JobProcessorSummary {
  totalPixels: number;
  totalExtenders: number;
  totalProcessors: number;
}

export interface ProcessorPrefs {
  /** screenId -> selected option card index. */
  perScreenRecommendationChoice: Record<string, number>;
}

/** One candidate combo the auto-recommendation engine proposes for a screen (or the pooled job). */
export interface ProcessorRecommendation {
  islemci: IslemciRow;
  units: number;
  /** null = direct connection: the processor has no OPT outputs (OPT_Port 0), so no CVT / extender. */
  extender: ExtenderRow | null;
  extenderUnits: number;
  /** Internal only — never shown in the UI or reports. */
  portsUsed: number;
  pixelsUsed: number;
  pixelsCapacity: number;
  utilizationPercent: number;
}

/** Job total: every screen's selected card summed per processor model and per extender model. */
export interface JobAutoSummary {
  totalPixels: number;
  processors: { islemci: IslemciRow; count: number }[];
  extenders: { extender: ExtenderRow; count: number }[];
  totalProcessors: number;
  totalExtenders: number;
  infeasibleScreenCount: number;
}
