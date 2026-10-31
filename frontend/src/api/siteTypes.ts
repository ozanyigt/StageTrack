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

export interface SitePlan {
  id: Guid;
  projectId: Guid;
  projectNumber: number;
  projectName: string;
  venue?: string | null;
  name: string;
  centreLat: number;
  centreLng: number;
  zoom: number;
  baseLayer: SiteBaseLayer;
  nightMode: boolean;
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
