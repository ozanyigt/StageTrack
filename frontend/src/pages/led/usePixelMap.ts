import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_PIXEL_MAP_STATE,
  moveOnMap,
  reconcilePixelMap,
  resolvePixelScreens,
  sanitizePixelMapState,
  sharedSources,
  type PixelMapState,
  type PixelScreen,
} from './core/pixelMap';
import { resolveGroups, type ResolvedGroup } from './core/pixelGroups';
import type { WallConfig } from './core/types';

const STORAGE_KEY = 'stagetrack-led-pixelmap-v1';

/**
 * Where each screen sits in the media server's composition. Kept beside the job (same browser, not saved on the
 * server): it is a layout decision, not inventory, and it only becomes permanent once the job is transferred.
 *
 * The map reconciles itself against the job on every change — a screen that was removed drops off, a resized one
 * keeps its position — which is why the state is stored rather than derived.
 */
export function usePixelMap(walls: WallConfig[], nameOf: (wall: WallConfig) => string) {
  const { t } = useTranslation();
  const [state, setState] = useState<PixelMapState>(() => {
    try {
      return sanitizePixelMapState(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
    } catch {
      return DEFAULT_PIXEL_MAP_STATE;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const sources = useMemo(() => sharedSources(walls, nameOf), [walls, nameOf]);

  // A screen the job no longer has must leave the map, and a resized one must keep its place.
  useEffect(() => {
    setState((current) => reconcilePixelMap(current, sources, sources.map((s) => s.id)));
  }, [sources]);

  const screens: PixelScreen[] = useMemo(() => resolvePixelScreens(state, sources), [state, sources]);
  const groups: ResolvedGroup[] = useMemo(() => resolveGroups(state.groups, screens), [state.groups, screens]);

  const move = useCallback((id: string, x: number, y: number) => setState((s) => moveOnMap(s, id, x, y)), []);

  const setView = useCallback(
    (patch: Partial<PixelMapState['view']>) => setState((s) => ({ ...s, view: { ...s.view, ...patch } })),
    [],
  );

  const setLayout = useCallback(
    (id: string, patch: Partial<PixelMapState['layouts'][string]>) =>
      setState((s) => (s.layouts[id] ? { ...s, layouts: { ...s.layouts, [id]: { ...s.layouts[id], ...patch } } } : s)),
    [],
  );

  const reset = useCallback(() => setState(DEFAULT_PIXEL_MAP_STATE), []);

  return { state, setState, screens, groups, move, setView, setLayout, reset, t };
}
