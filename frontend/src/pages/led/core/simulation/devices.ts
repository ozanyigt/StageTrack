import type { EvaluateResponse } from "../../../../api/ledTypes";
import { deviceId } from "../evaluation";
import type { ExtenderRow, IslemciRow } from "../types";

/**
 * The processors Simülasyon's signal wiring is drawn on: the ones the project uses as picked on Processor & Extender
 * (the job's processor count: "MX2000 Pro × 2" = "MX2000 Pro 1" and "MX2000 Pro 2"), each with as many ports as its
 * inventory record has (Ethernet_Port) — nobody types a port count. A port's pixel limit is the one the picked
 * option works with (the CVT / extender's included), else the record's own, else the calculation's default.
 */

/** The calculation's per-port pixels when a processor has none entered (ProcessorPlanner.DefaultPixelsPerPort). */
export const DEFAULT_PIXELS_PER_PORT = 650_000;

/** A run of ports: one CVT / extender card's outputs, or the processor's own Ethernet outputs. */
export interface PortGroup {
  /** null = the processor's own outputs. */
  card: number | null;
  /** First port (0-based) and how many. */
  from: number;
  count: number;
}

export interface SignalDevice {
  /** "<processor id>#<unit>" (unit 0-based). */
  key: string;
  processorId: string;
  unit: number;
  /** "MX2000 Pro 1" */
  name: string;
  ports: number;
  pixelsPerPort: number;
  groups: PortGroup[];
  /** The CVT / extender model the ports come out of, when there is one. */
  extender: string | null;
}

export function signalDevices(evaluation: EvaluateResponse | undefined, islemciler: IslemciRow[], extenderlar: ExtenderRow[]): SignalDevice[] {
  const counts = evaluation?.job.processor.processors ?? [];
  const signals = (evaluation?.screens ?? []).flatMap((s) => (s.signal && !s.signal.locked && s.signal.processorId ? [s.signal] : []));
  return counts.flatMap(({ id, count }) => {
    const processor = islemciler.find((p) => deviceId(p) === id);
    if (!processor || count < 1) return [];
    const own = signals.filter((s) => s.processorId === id);
    const limits = own.map((s) => s.pixelsPerPort).filter((p) => p > 0);
    const pixelsPerPort = limits.length > 0 ? Math.min(...limits) : (processor.Port_Basi_Piksel ?? DEFAULT_PIXELS_PER_PORT);
    const extenderId = own.find((s) => s.extenderId)?.extenderId ?? null;
    const extender = extenderId ? extenderlar.find((e) => deviceId(e) === extenderId) : undefined;
    const ports = Math.max(1, processor.Ethernet_Port || 0);
    const groups = portGroups(ports, extender && extender.Ethernet_Port > 0 ? extender.Ethernet_Port : null);
    return Array.from({ length: Math.min(count, 50) }, (_, unit) => ({
      key: `${id}#${unit}`,
      processorId: id,
      unit,
      name: `${processor.Model} ${unit + 1}`,
      ports,
      pixelsPerPort,
      groups,
      extender: extender ? `${extender.Marka} ${extender.Model}` : null,
    }));
  });
}

/** The ports in runs of a card's size (the last run may be shorter); one run without a card. */
export function portGroups(ports: number, perCard: number | null): PortGroup[] {
  if (!perCard) return [{ card: null, from: 0, count: ports }];
  return Array.from({ length: Math.ceil(ports / perCard) }, (_, i) => ({ card: i, from: i * perCard, count: Math.min(perCard, ports - i * perCard) }));
}
