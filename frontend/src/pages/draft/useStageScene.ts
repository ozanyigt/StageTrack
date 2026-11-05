import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { equipmentApi, draftApi } from '../../api/endpoints';
import { usePixelMap } from '../led/usePixelMap';
import { useDraftJob } from './useDraftJob';
import { sceneLayout } from '../led/core/stage3d/scene';
import { stage3dScreens } from '../led/core/stage3d/screens';
import { sanitizePlacements, type Placements } from '../led/core/stage3d/placements';
import type { StageSettings } from '../led/core/stage3d/settings';
import { sanitizePropPlacements, stageProps, type PropPlacements } from './stageProps';
import { useVenue } from './useVenue';
import { roomBox } from './venueObjects';

export const PLACEMENTS_KEY = 'stagetrack-led-stage-placements-v1';
export const PROP_PLACEMENTS_KEY = 'stagetrack-stage-prop-placements-v1';

/**
 * The scene as it currently stands: the screens where they were put, the other trades' groups where they were
 * put, and the room around them. One place builds it so that every screen reading it - the 3D view, the
 * sightline plan, the printed drawing - is looking at the same stage rather than its own idea of one.
 */
export function useStageScene() {
  const { t } = useTranslation();
  const { job, walls, nameOf, evaluation } = useDraftJob();
  const { state: mapState } = usePixelMap(walls, nameOf);

  const [placements, setPlacements] = useState<Placements>(() => {
    try {
      return sanitizePlacements(JSON.parse(localStorage.getItem(PLACEMENTS_KEY) ?? 'null'));
    } catch {
      return {};
    }
  });

  const [propPlacements, setPropPlacements] = useState<PropPlacements>(() => {
    try {
      return sanitizePropPlacements(JSON.parse(localStorage.getItem(PROP_PLACEMENTS_KEY) ?? 'null'));
    } catch {
      return {};
    }
  });

  useEffect(() => localStorage.setItem(PLACEMENTS_KEY, JSON.stringify(placements)), [placements]);
  useEffect(() => localStorage.setItem(PROP_PLACEMENTS_KEY, JSON.stringify(propPlacements)), [propPlacements]);

  const stored = useQuery({ queryKey: ['led-stage'], queryFn: () => draftApi.stage() });

  /** The server's DTO and the ported library share field names and enum values, so no mapping is needed. */
  const settings = (stored.data ?? null) as StageSettings | null;

  const catalogue = useQuery({
    queryKey: ['equipment', 'for-stage'],
    queryFn: () => equipmentApi.list({ maxResultCount: 1000, sorting: 'code' }),
    enabled: job.lines.some((l) => l.equipmentId),
  });

  const equipmentById = useMemo(
    () => new Map((catalogue.data?.items ?? []).map((e) => [e.id, e])),
    [catalogue.data],
  );

  const layout = useMemo(() => {
    if (!settings) return null;
    const built = stage3dScreens(walls, mapState, evaluation.data?.screens, nameOf, true);
    return built.screens.length > 0 ? sceneLayout(built.screens, settings, placements) : null;
  }, [walls, mapState, evaluation.data, nameOf, settings, placements]);

  const { venue } = useVenue(job.projectId);

  const room = useMemo(() => (venue && layout ? roomBox(venue, layout.podium.back) : null), [venue, layout]);

  const sceneProps = useMemo(
    () =>
      stageProps(
        job.lines,
        equipmentById,
        propPlacements,
        layout?.podium.height ?? 0,
        settings?.trussHeightM ?? (layout?.podium.height ?? 0) + 6,
        (line, item) => (item ? `${line.name} · ${item.code}` : line.name),
      ),
    [job.lines, equipmentById, propPlacements, layout, settings],
  );

  /** How high the rig reaches: the truss when the screens hang, otherwise the tallest screen's top edge. */
  const rigHeightM = useMemo(
    () =>
      Math.max(
        settings?.mount === 'Flown' ? settings.trussHeightM : 0,
        ...(layout?.screens.map((p) => p.bottom + p.screen.heightM) ?? [0]),
      ),
    [settings, layout],
  );

  return {
    t,
    job,
    walls,
    nameOf,
    evaluation,
    settings,
    loadingSettings: stored.isLoading,
    layout,
    placements,
    setPlacements,
    propPlacements,
    setPropPlacements,
    sceneProps,
    equipmentById,
    venue,
    room,
    rigHeightM,
  };
}
