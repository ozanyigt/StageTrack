import type { Equipment, EquipmentDiscipline } from '../../api/types';
import type { JobLine } from '../led/useLedJob';

/**
 * What a group of a non-LED trade looks like on the stage. A LED wall has a shape the calculation knows - so many
 * panels wide, so many high - but a sound or lighting rig is a count of products, so it is drawn from the product's
 * own measurements: a K3 box is 1.3 x 0.4 x 0.3 m because the firm entered that, not because we modelled a K3.
 * Nothing here needs a 3D asset pipeline, and a firm that fills in its dimensions gets a truer picture for free.
 */
export interface StageProp {
  /** The job line this came from; also what a placement is stored under. */
  id: string;
  trade: EquipmentDiscipline;
  label: string;
  count: number;
  /** Bodies actually drawn (a group of forty fixtures reads as a cluster, not forty things to place by hand). */
  bodies: number;
  /** One product, metres. */
  size: { w: number; h: number; d: number };
  x: number;
  z: number;
  /** Floor height the group stands on (the podium, or the trim height when it hangs). */
  y: number;
  rotationDeg: number;
  /** Lighting gets a beam so the dark corners of a plan are visible from above. */
  beam: boolean;
}

export interface PropPlacement {
  x: number;
  z: number;
  rotationDeg: number;
  /** Hung from the rig rather than standing on the deck. */
  flown?: boolean;
}

export type PropPlacements = Record<string, PropPlacement>;

/** Most shown at once; beyond this the cluster stops growing and the count stays in the label. */
const MAX_BODIES = 8;

/** When the firm has not measured a product, something of the right order rather than nothing. */
const DEFAULT_SIZE: Record<EquipmentDiscipline, { w: number; h: number; d: number }> = {
  Led: { w: 0.5, h: 0.5, d: 0.08 },
  Sound: { w: 0.6, h: 0.9, d: 0.5 },
  Light: { w: 0.3, h: 0.5, d: 0.3 },
  Truss: { w: 0.3, h: 0.3, d: 3 },
  Scaff: { w: 1, h: 0.2, d: 2 },
};

/** The colours of the trade tabs, so a layer list and the scene agree at a glance. */
export const TRADE_COLOR: Record<EquipmentDiscipline, string> = {
  Led: '#a78bfa',
  Sound: '#38bdf8',
  Light: '#f59e0b',
  Truss: '#a1a1aa',
  Scaff: '#84cc16',
};

const cm = (value: number | null | undefined) => (value == null || value <= 0 ? null : Number(value) / 100);

export function sizeOf(item: Equipment | undefined, trade: EquipmentDiscipline) {
  const fallback = DEFAULT_SIZE[trade];
  return {
    w: cm(item?.widthCm) ?? fallback.w,
    h: cm(item?.heightCm) ?? fallback.h,
    d: cm(item?.lengthCm) ?? fallback.d,
  };
}

/**
 * The groups to draw. A group with no product picked is left out: there is nothing to size it by, and an empty
 * box standing on the stage would be a lie about what the job holds.
 */
export function stageProps(
  lines: JobLine[],
  equipment: Map<string, Equipment>,
  placements: PropPlacements,
  deckHeight: number,
  flownHeight: number,
  labelOf: (line: JobLine, item: Equipment | undefined) => string,
): StageProp[] {
  return lines
    .filter((line) => line.equipmentId)
    .map((line, index) => {
      const item = equipment.get(line.equipmentId!);
      const size = sizeOf(item, line.discipline);
      const placement = placements[line.id];
      const flown = placement?.flown ?? false;
      return {
        id: line.id,
        trade: line.discipline,
        label: labelOf(line, item),
        count: line.count,
        bodies: Math.max(1, Math.min(MAX_BODIES, line.count)),
        size,
        // A group nobody has placed yet lines up off to the side of the deck rather than inside the screens.
        x: placement?.x ?? -4 - (index % 4) * 1.5,
        z: placement?.z ?? 3 + Math.floor(index / 4) * 2,
        y: flown ? flownHeight : deckHeight,
        rotationDeg: placement?.rotationDeg ?? 0,
        beam: line.discipline === 'Light',
      };
    });
}

/** Placements read back from storage, with anything malformed dropped. */
export function sanitizePropPlacements(raw: unknown): PropPlacements {
  if (!raw || typeof raw !== 'object') return {};
  const out: PropPlacements = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const p = (value ?? {}) as Record<string, unknown>;
    const num = (v: unknown, limit: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-limit, Math.min(limit, v)) : 0);
    out[id.slice(0, 64)] = {
      x: num(p.x, 200),
      z: num(p.z, 200),
      rotationDeg: num(p.rotationDeg, 360),
      flown: p.flown === true,
    };
  }
  return out;
}
