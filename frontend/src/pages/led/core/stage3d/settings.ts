/**
 * 3D Sahne's stage and mounting values (metres). Kept per workspace on the server (stage 5); the same shape and
 * bounds on both sides.
 */

export type MountType = "Ground" | "Flown";
/** Yerden montajın taşıyıcısı: scaff kuleleri ya da LED demiri. */
export type CarrierType = "Scaff" | "LedFrame";

export interface StageSettings {
  /** Podium. */
  stageWidthM: number;
  stageDepthM: number;
  stageHeightM: number;
  /** From the screens' face to the podium's front edge. */
  frontGapM: number;
  mount: MountType;
  carrier: CarrierType;
  /** Scaff only: how deep the towers behind the screen are. */
  legDepthM: number;
  /** Ground: the screen's bottom edge above the podium (without the ground support). */
  bottomM: number;
  groundSupport: boolean;
  groundSupportHeightM: number;
  /** Flown: the truss's height above the floor, and the space between the truss and the screen's top edge. */
  trussHeightM: number;
  hangAllowanceM: number;
}

export const DEFAULT_STAGE_SETTINGS: StageSettings = {
  stageWidthM: 12,
  stageDepthM: 8,
  stageHeightM: 1.2,
  frontGapM: 1,
  mount: "Ground",
  carrier: "LedFrame",
  legDepthM: 1.5,
  bottomM: 0.5,
  groundSupport: false,
  groundSupportHeightM: 0.2,
  trussHeightM: 9,
  hangAllowanceM: 0.5,
};

type NumberKey = { [K in keyof StageSettings]: StageSettings[K] extends number ? K : never }[keyof StageSettings];

/** What each value may be (metres). */
export const STAGE_LIMITS: Record<NumberKey, { min: number; max: number }> = {
  stageWidthM: { min: 1, max: 100 },
  stageDepthM: { min: 1, max: 50 },
  stageHeightM: { min: 0, max: 5 },
  frontGapM: { min: 0, max: 20 },
  legDepthM: { min: 0.5, max: 5 },
  bottomM: { min: 0, max: 20 },
  groundSupportHeightM: { min: 0.05, max: 1 },
  trussHeightM: { min: 1, max: 50 },
  hangAllowanceM: { min: 0, max: 10 },
};

/** What the − / + buttons change each value by: lengths 10 cm, the ground support 5 cm. */
export const STAGE_STEPS: Record<NumberKey, number> = {
  stageWidthM: 0.1,
  stageDepthM: 0.1,
  stageHeightM: 0.1,
  frontGapM: 0.1,
  legDepthM: 0.1,
  bottomM: 0.1,
  groundSupportHeightM: 0.05,
  trussHeightM: 0.1,
  hangAllowanceM: 0.1,
};

/** Within its bounds, to the centimetre. */
export function clampSetting(key: NumberKey, value: number): number {
  const { min, max } = STAGE_LIMITS[key];
  if (!Number.isFinite(value)) return DEFAULT_STAGE_SETTINGS[key];
  return Math.round(Math.min(max, Math.max(min, value)) * 100) / 100;
}

/** A stored / received value made safe: unknown fields dropped, numbers clamped, missing ones defaulted. */
export function sanitizeStageSettings(raw: unknown): StageSettings {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_STAGE_SETTINGS };
  for (const key of Object.keys(STAGE_LIMITS) as NumberKey[]) {
    const v = r[key];
    if (typeof v === "number") out[key] = clampSetting(key, v);
  }
  if (r.mount === "Ground" || r.mount === "Flown") out.mount = r.mount;
  if (r.carrier === "Scaff" || r.carrier === "LedFrame") out.carrier = r.carrier;
  if (typeof r.groundSupport === "boolean") out.groundSupport = r.groundSupport;
  return out;
}

/**
 * The screens' bottom edge above the floor (the hall floor, y = 0), metres. `compositionHeightM` = the screens'
 * height together (as on the Pixel Map).
 * - Yerden: sahne üst kotu + alt kot (+ aparat yüksekliği when there is a ground support).
 * - Asılı: üst kenar = truss kotu − askı payı.
 */
export function screenBottomM(s: StageSettings, compositionHeightM: number): number {
  if (s.mount === "Ground") return s.stageHeightM + s.bottomM + (s.groundSupport ? s.groundSupportHeightM : 0);
  return s.trussHeightM - s.hangAllowanceM - compositionHeightM;
}

/** A screen's bottom / top edge above the podium's top (what "alt kot" / "üst kot" say), metres. */
export function screenLevels(s: StageSettings, bottomAboveFloorM: number, heightM: number): { bottomM: number; topM: number } {
  const bottom = bottomAboveFloorM - s.stageHeightM;
  return { bottomM: bottom, topM: bottom + heightM };
}
