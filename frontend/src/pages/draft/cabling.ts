/**
 * How much cable the job actually needs. The circuit count has been worked out for a while; what nobody could
 * say was how many metres of it, because that depends on where the distro boxes stand - and that is a decision,
 * not a calculation. Put the boxes on the plan and the metres fall out: every consumer runs to the nearest box,
 * the run allows for going round things rather than through them, and anything hanging adds its drop twice.
 */

export interface CableConsumer {
  id: string;
  label: string;
  x: number;
  z: number;
  /** Circuits this consumer needs; each is a cable. */
  circuits: number;
  /** How high it hangs, metres; a flown bar costs its drop on the way up and the cable still comes down. */
  heightM: number;
}

export interface Distro {
  id: string;
  name: string;
  x: number;
  z: number;
  /** The box's rating, amps; only reported, never used to limit what is plugged in. */
  amps: number;
}

export interface CableRun {
  consumerId: string;
  distroId: string | null;
  /** Straight line on the floor, metres. */
  directM: number;
  /** What is actually pulled: the run with its allowance, times the circuits. */
  cableM: number;
  circuits: number;
}

export interface CablingResult {
  runs: CableRun[];
  perDistro: { distro: Distro; circuits: number; cableM: number; consumers: number }[];
  totalCableM: number;
  /** From the mains to the boxes, metres; the feeder is pulled once per box. */
  feederM: number;
  unassigned: number;
}

/** Cable never runs as the crow flies: round the deck, up a leg, through a cable ramp. */
export const SLACK = 1.25;

export function planCabling(
  consumers: CableConsumer[],
  distros: Distro[],
  mains: { x: number; z: number } | null,
): CablingResult {
  const runs: CableRun[] = consumers.map((consumer) => {
    const nearest = distros.reduce<{ distro: Distro; distance: number } | null>((best, distro) => {
      const distance = Math.hypot(consumer.x - distro.x, consumer.z - distro.z);
      return best === null || distance < best.distance ? { distro, distance } : best;
    }, null);

    if (!nearest) {
      return { consumerId: consumer.id, distroId: null, directM: 0, cableM: 0, circuits: consumer.circuits };
    }

    // Up to it and back down again: a bar at eight metres costs sixteen on top of the floor run.
    const drop = consumer.heightM > 0.5 ? consumer.heightM * 2 : 0;
    const run = (nearest.distance + drop) * SLACK;
    return {
      consumerId: consumer.id,
      distroId: nearest.distro.id,
      directM: nearest.distance,
      cableM: run * Math.max(1, consumer.circuits),
      circuits: consumer.circuits,
    };
  });

  const perDistro = distros.map((distro) => {
    const mine = runs.filter((run) => run.distroId === distro.id);
    return {
      distro,
      circuits: mine.reduce((sum, run) => sum + run.circuits, 0),
      cableM: mine.reduce((sum, run) => sum + run.cableM, 0),
      consumers: mine.length,
    };
  });

  const feederM = mains
    ? distros.reduce((sum, distro) => sum + Math.hypot(distro.x - mains.x, distro.z - mains.z) * SLACK, 0)
    : 0;

  return {
    runs,
    perDistro,
    totalCableM: runs.reduce((sum, run) => sum + run.cableM, 0),
    feederM,
    unassigned: runs.filter((run) => run.distroId === null).length,
  };
}
