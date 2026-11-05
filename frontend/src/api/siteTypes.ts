import type { Guid } from './types';

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

/** The job's room record: one per job, carrying the venue above. */
export interface SitePlan {
  id: Guid;
  projectId: Guid;
  projectNumber: number;
  projectName: string;
  /** The job's venue as text ("Ankara Congresium"); the room itself is `venue`. */
  venueName?: string | null;
  name: string;
  /** The room, when the job is indoors; null on an open field. */
  venue?: SiteVenue | null;
}

export interface CreateSitePlanInput {
  projectId: Guid;
  name?: string | null;
}
