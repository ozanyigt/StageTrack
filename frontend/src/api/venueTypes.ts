import type { Guid } from './types';

/**
 * The room the job is built in. A satellite picture answers everything on a field and nothing inside a hall, so
 * indoors this is the ground truth: how wide, how deep, and how much clear height there is over the rig.
 * Scene metres - x across, z towards the audience, screens at z = 0 - the same floor the 3D stage uses.
 */
export interface VenueRoom {
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

export interface SetVenueRoomInput {
  widthM: number;
  depthM: number;
  clearHeightM: number;
  stageOffsetXM: number;
  behindStageM: number;
  rakeDeg: number;
}

export interface SetVenuePlanInput {
  planAttachmentId?: Guid | null;
  planMetresPerPixel?: number | null;
  planOriginXM: number;
  planOriginZM: number;
  planRotationDeg: number;
}

/** The job's venue record: one per job, carrying the room above. */
export interface ProjectVenue {
  id: Guid;
  projectId: Guid;
  projectNumber: number;
  projectName: string;
  /** The job's venue as text ("Ankara Congresium"); the room itself is `room`. */
  venueName?: string | null;
  name: string;
  /** The room, when the job is indoors; null on an open field. */
  room?: VenueRoom | null;
}
