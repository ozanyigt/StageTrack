import type { PixelScreen, Rect } from "./pixelMap";
import { panelsToMeters } from "./wallSize";
import type { Dil } from "./types";
import { formatNumber } from "./format";

/**
 * Pixel Map's merged screens ("Birleştir"): two or more screens that act as one on the map and in its outputs — one
 * name label and one logo in the middle of the group, moved together, one area in the JPG / PNG / Resolume XML.
 * The members keep their own panel grid, cut-outs and place in the group; for Güç, Processor, Simülasyon and Stok
 * Durumu they stay separate screens (a group exists on Pixel Map only).
 */
export interface PixelGroup {
  id: string;
  name: string;
  /** Screen ids (shared or manual), each in one group at most. */
  members: string[];
  logo: boolean;
}

const MAX_GROUPS = 200;

/** Stored groups: anything broken is dropped; a screen stays in its first group only; a group needs 2 members. */
export function sanitizeGroups(raw: unknown): PixelGroup[] {
  if (!Array.isArray(raw)) return [];
  const taken = new Set<string>();
  const groups: PixelGroup[] = [];
  for (const g of raw.slice(0, MAX_GROUPS)) {
    if (!g || typeof g !== "object" || typeof g.id !== "string" || g.id === "" || !Array.isArray(g.members)) continue;
    const members = [...new Set((g.members as unknown[]).filter((m): m is string => typeof m === "string" && m !== ""))].filter((m) => !taken.has(m));
    if (members.length < 2) continue;
    members.forEach((m) => taken.add(m));
    groups.push({ id: g.id, name: typeof g.name === "string" ? g.name : "", members, logo: g.logo === true });
  }
  return groups;
}

/** The groups on the screens that exist now: members gone drop out, a group left with one member is undone. */
export function reconcileGroups(groups: PixelGroup[], exists: (id: string) => boolean): PixelGroup[] {
  let changed = false;
  const next = groups.flatMap((g) => {
    const members = g.members.filter(exists);
    if (members.length !== g.members.length) changed = true;
    if (members.length < 2) {
      changed = true;
      return [];
    }
    return [members.length === g.members.length ? g : { ...g, members }];
  });
  return changed ? next : groups;
}

export const groupOf = (groups: PixelGroup[], screenId: string) => groups.find((g) => g.members.includes(screenId)) ?? null;

/**
 * The picked screens merged into one group (`order`: the map's screen order, kept for the members). A picked screen
 * already in a group brings its whole group in (that group is replaced). The logo stays on when any merged screen or
 * group had it. Null when fewer than 2 screens would be in it.
 */
export function mergeScreens(groups: PixelGroup[], picked: string[], order: string[], fresh: { id: string; name: string }, logoOf: (id: string) => boolean): PixelGroup[] | null {
  const absorbed = groups.filter((g) => g.members.some((m) => picked.includes(m)));
  const ids = new Set([...picked, ...absorbed.flatMap((g) => g.members)]);
  if (ids.size < 2) return null;
  const members = [...order.filter((id) => ids.has(id)), ...[...ids].filter((id) => !order.includes(id))];
  const logo = absorbed.some((g) => g.logo) || members.some(logoOf);
  return [...groups.filter((g) => !absorbed.includes(g)), { id: fresh.id, name: fresh.name, members, logo }];
}

/** "Ayır": the group undone; its screens are single screens again where they stand. */
export const splitGroup = (groups: PixelGroup[], id: string) => groups.filter((g) => g.id !== id);

/** The smallest rectangle around the screens. */
export function boundingRect(screens: Rect[]): Rect {
  const x = Math.min(...screens.map((s) => s.x));
  const y = Math.min(...screens.map((s) => s.y));
  return {
    x,
    y,
    width: Math.max(...screens.map((s) => s.x + s.width)) - x,
    height: Math.max(...screens.map((s) => s.y + s.height)) - y,
  };
}

export interface ResolvedGroup extends PixelGroup, Rect {
  screens: PixelScreen[];
}

/** Every group with its members as drawn and its area on the map (groups without a member on the map left out). */
export function resolveGroups(groups: PixelGroup[], screens: PixelScreen[]): ResolvedGroup[] {
  return groups.flatMap((g) => {
    const members = screens.filter((s) => g.members.includes(s.id));
    return members.length >= 2 ? [{ ...g, screens: members, ...boundingRect(members) }] : [];
  });
}

/**
 * A group's size in metres: from its pixel area when every member has a panel size at the same pixel pitch (mm per
 * pixel), else the members' area added up; null when a member has no panel size.
 */
export function groupMetres(group: Pick<ResolvedGroup, "screens" | "width" | "height">): { widthM: number; heightM: number } | { areaM2: number } | null {
  const pitches = group.screens.map((s) => (s.panelSize ? { x: s.panelSize.widthMm / s.moduleW, y: s.panelSize.heightMm / s.moduleH } : null));
  if (pitches.some((p) => p === null)) return null;
  const [first] = pitches as { x: number; y: number }[];
  const same = (pitches as { x: number; y: number }[]).every((p) => Math.abs(p.x - first.x) < 1e-9 && Math.abs(p.y - first.y) < 1e-9);
  if (same) return { widthM: (group.width * first.x) / 1000, heightM: (group.height * first.y) / 1000 };
  const areaM2 = group.screens.reduce((sum, s) => sum + panelsToMeters(s.cols, s.panelSize!.widthMm) * panelsToMeters(s.rows, s.panelSize!.heightMm), 0);
  return { areaM2 };
}

/** The group's label lines: pixels, then its metres ("Metraj: 3,00 m × 1,00 m" or "Alan: 4,50 m²", or "Metraj: –"). */
export function groupLabelInfo(group: ResolvedGroup, t: (key: string, vars?: Record<string, string | number>) => string, lang: Dil): string[] {
  const metres = groupMetres(group);
  const two = (v: number) => formatNumber(v, lang, 2);
  return [
    t("pixel.label.pixels", { w: group.width, h: group.height }),
    metres === null
      ? t("pixel.label.sizeUnknown")
      : "widthM" in metres
        ? t("pixel.label.size", { size: `${two(metres.widthM)} m × ${two(metres.heightM)} m` })
        : t("pixel.label.area", { area: two(metres.areaM2) }),
  ];
}

/** The outputs' areas: each group as one (its name, its rectangle), every other screen as itself, in map order. */
export function exportAreas(screens: PixelScreen[], groups: ResolvedGroup[]): (Rect & { name: string })[] {
  const inGroup = new Map(groups.flatMap((g) => g.screens.map((s) => [s.id, g] as const)));
  const done = new Set<string>();
  return screens.flatMap((s) => {
    const g = inGroup.get(s.id);
    if (!g) return [{ name: s.name, x: s.x, y: s.y, width: s.width, height: s.height }];
    if (done.has(g.id)) return [];
    done.add(g.id);
    return [{ name: g.name, x: g.x, y: g.y, width: g.width, height: g.height }];
  });
}

/**
 * A member moved from `from` to `to`: the step the whole group takes, never past the map's top-left corner (cut so
 * the group's left-most / top-most member stops at 0).
 */
export function groupStep(members: Rect[], from: { x: number; y: number }, to: { x: number; y: number }): { dx: number; dy: number } {
  const minX = Math.min(...members.map((m) => m.x));
  const minY = Math.min(...members.map((m) => m.y));
  return { dx: Math.max(-minX, to.x - from.x), dy: Math.max(-minY, to.y - from.y) };
}
