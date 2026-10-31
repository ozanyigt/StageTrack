import type { SiteVenue } from '../../api/siteTypes';

/** Metres per degree of latitude; longitude shrinks with the cosine of the latitude. */
const M_PER_DEG = 111_320;

/**
 * The room drawn on the map. Inside and outside have been two unrelated drawings - a satellite picture of a
 * field and a floor of local metres - and the only thing needed to make them one story is where the room's
 * origin sits on earth and which way it faces. Then the hall is a shape on the site plan, with the generators,
 * the trucks and the cable routes around it, and stepping inside is a click rather than a different product.
 *
 * Scene metres: x across, z towards the audience, the stage at z = 0. A rotation of 0 points the audience north.
 */
export function venueFootprint(venue: SiteVenue, podiumBack: number): [number, number][] | null {
  if (venue.originLat == null || venue.originLng == null) return null;

  const minZ = podiumBack - venue.behindStageM;
  const corners: [number, number][] = [
    [venue.stageOffsetXM - venue.widthM / 2, minZ],
    [venue.stageOffsetXM + venue.widthM / 2, minZ],
    [venue.stageOffsetXM + venue.widthM / 2, minZ + venue.depthM],
    [venue.stageOffsetXM - venue.widthM / 2, minZ + venue.depthM],
  ];

  return corners.map(([x, z]) => toLatLng(venue.originLat!, venue.originLng!, venue.mapRotationDeg, x, z));
}

/** A point of the scene floor as a place on earth. */
export function toLatLng(originLat: number, originLng: number, rotationDeg: number, x: number, z: number): [number, number] {
  const angle = (rotationDeg * Math.PI) / 180;
  // Turning the floor before laying it down: +z is the way the audience looks, which is north at 0 degrees.
  const east = x * Math.cos(angle) + z * Math.sin(angle);
  const north = -x * Math.sin(angle) + z * Math.cos(angle);
  const lat = originLat + north / M_PER_DEG;
  const lng = originLng + east / (M_PER_DEG * Math.cos((originLat * Math.PI) / 180));
  return [lat, lng];
}
