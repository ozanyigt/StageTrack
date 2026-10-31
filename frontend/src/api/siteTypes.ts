// Mirrors StageTrack.Application.Contracts/Sites. Enums are sent as strings.
import type { Guid } from './types';

export const SITE_BASE_LAYERS = ['Satellite', 'Street'] as const;
export type SiteBaseLayer = (typeof SITE_BASE_LAYERS)[number];

export const SITE_ZONE_KINDS = ['Area', 'Route', 'Barrier'] as const;
export type SiteZoneKind = (typeof SITE_ZONE_KINDS)[number];

export interface SitePlanItem {
  id: Guid;
  /** The real equipment standing here; null for a plain marker. */
  equipmentId?: Guid | null;
  equipmentCode?: string | null;
  equipmentName?: string | null;
  /** Owned pieces, against what the plan puts on the ground. */
  equipmentStock: number;
  label?: string | null;
  quantity: number;
  lat: number;
  lng: number;
  rotationDeg: number;
  layer?: string | null;
  notes?: string | null;
  lightHeightM?: number | null;
  lightIntensity?: number | null;
  /** What the night view uses: entered, or worked out from the height. */
  lightRadiusM?: number | null;
  isLight: boolean;
}

export interface SitePlanZone {
  id: Guid;
  name: string;
  kind: SiteZoneKind;
  /** [lat, lng] pairs. */
  points: [number, number][];
  color: string;
  layer?: string | null;
  areaM2?: number | null;
  lengthM?: number | null;
}

/**
 * The room the job is built in. A satellite picture answers everything on a field and nothing inside a hall, so
 * indoors this is the ground truth: how wide, how deep, and how much clear height there is over the rig.
 * Scene metres - x across, z towards the audience, screens at z = 0 - the same floor the 3D stage uses.
 */
export interface SiteVenue {
  widthM: number;
  depthM: number;
  /** What the rig has to clear; 0 = nobody entered one. */
  clearHeightM: number;
  stageOffsetXM: number;
  behindStageM: number;
  rakeDeg: number;
  /** The venue's own layout drawing (an attachment of the job), and what one of its pixels is worth. */
  planAttachmentId?: Guid | null;
  planMetresPerPixel?: number | null;
  planOriginXM: number;
  planOriginZM: number;
  planRotationDeg: number;
  originLat?: number | null;
  originLng?: number | null;
  mapRotationDeg: number;
}

export interface SetSiteVenueInput {
  widthM: number;
  depthM: number;
  clearHeightM: number;
  stageOffsetXM: number;
  behindStageM: number;
  rakeDeg: number;
}

export interface SetSiteVenuePlanInput {
  planAttachmentId?: Guid | null;
  planMetresPerPixel?: number | null;
  planOriginXM: number;
  planOriginZM: number;
  planRotationDeg: number;
}

export interface SetSiteVenueMapInput {
  originLat?: number | null;
  originLng?: number | null;
  mapRotationDeg: number;
}

export interface SitePlan {
  id: Guid;
  projectId: Guid;
  projectNumber: number;
  projectName: string;
  venueName?: string | null;
  name: string;
  centreLat: number;
  centreLng: number;
  zoom: number;
  baseLayer: SiteBaseLayer;
  nightMode: boolean;
  /** The room, when the job is indoors; null on an open field. */
  venue?: SiteVenue | null;
  items: SitePlanItem[];
  zones: SitePlanZone[];
  layers: string[];
}

export interface CreateSitePlanInput {
  projectId: Guid;
  name?: string | null;
  centreLat: number;
  centreLng: number;
}

export interface SitePlanViewInput {
  centreLat: number;
  centreLng: number;
  zoom: number;
  baseLayer: SiteBaseLayer;
  nightMode: boolean;
}

export interface AddSitePlanItemInput {
  equipmentId?: Guid | null;
  label?: string | null;
  quantity: number;
  lat: number;
  lng: number;
  layer?: string | null;
}

export interface MoveSitePlanItemInput {
  lat: number;
  lng: number;
  rotationDeg: number;
}

export interface UpdateSitePlanItemInput {
  label?: string | null;
  quantity: number;
  layer?: string | null;
  notes?: string | null;
  /** Set to make the item a light; all null turns it back into an ordinary one. */
  lightHeightM?: number | null;
  lightIntensity?: number | null;
  lightRadiusM?: number | null;
}

export interface SaveSitePlanZoneInput {
  name: string;
  kind: SiteZoneKind;
  points: [number, number][];
  color: string;
  layer?: string | null;
}

export interface SitePowerLine {
  equipmentId: Guid;
  code: string;
  name: string;
  count: number;
  isLight: boolean;
  weightKg: number;
  watt: number;
  currentA: number;
  circuits: number;
}

export interface SitePower {
  lines: SitePowerLine[];
  totalWeightKg: number;
  totalWatt: number;
  totalCurrentA: number;
  totalCircuits: number;
  lightingWatt: number;
  lightingCircuits: number;
  /** Equipment on the plan whose power is not entered, so the figures are short. */
  missingWatt: string[];
}

export interface SiteToJobInput {
  sectionId?: Guid | null;
  sectionName?: string;
  /** Add to what the section already holds instead of replacing it. */
  append: boolean;
  /** Only these layers; empty = everything on the plan. */
  layers: string[];
}

export interface SiteToJobLine {
  equipmentId: Guid;
  code: string;
  name: string;
  quantity: number;
  stock: number;
  added: boolean;
  problem?: string | null;
}

export interface SiteToJobResult {
  projectId: Guid;
  sectionId?: Guid | null;
  sectionName: string;
  lines: SiteToJobLine[];
}
