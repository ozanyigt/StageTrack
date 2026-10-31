import type { LedTransportKind } from '../../../api/ledTypes';

/**
 * The loading plan groups and colours its cases. Panelyze grouped by the workspace's own kinds of equipment
 * ("Işık", "Ses", "Truss"); StageTrack has no such kinds, so the natural grouping left is how a model travels —
 * in flight cases or on dollies — which is also what decides how it stacks.
 */
export interface TransportKindInfo {
  id: LedTransportKind;
  name: string;
  color: string;
  sortOrder: number;
  /** Panels are counted as panels; anything else is counted in units. */
  template: 'LedPanel' | 'General';
}

export const FALLBACK_KIND_COLOR = '#64748b';

/** Built with translated names by the page; the ids and colours are fixed. */
export const transportKinds = (name: (kind: LedTransportKind) => string): TransportKindInfo[] => [
  { id: 'Case', name: name('Case'), color: '#4f46e5', sortOrder: 0, template: 'LedPanel' },
  { id: 'Dolly', name: name('Dolly'), color: '#0d9488', sortOrder: 1, template: 'General' },
];

export const kindById = (kinds: readonly TransportKindInfo[] | undefined, id: string | undefined) =>
  kinds?.find((k) => k.id === id);
