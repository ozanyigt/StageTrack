import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ledApi } from '../../api/endpoints';
import type { EvaluateScreenRequest, LedPanel, PowerMode } from '../../api/ledTypes';
import { currentLocation, toInventoryItem } from './core/adapter';
import { buildEvaluateRequest } from './core/evaluation';
import { screenDisplayName } from './core/screenName';
import type { Cutout, PowerLayout, ScreenCorner, ScreenCurve, SignalLayout, WallConfig } from './core/types';

/**
 * One LED job while the user works on it: its screens, the voltage and power mode, and the server's answer.
 * Kept in this browser (not saved) until it is transferred onto a real job — that is what makes it permanent.
 *
 * The screens are the shape the ported drawing code speaks (WallConfig), with the panel resolved from the LED
 * inventory on every read: the stored job only keeps the panel's equipment id, so renaming or re-pricing a panel
 * never leaves a stale copy behind.
 */
export interface StoredScreen {
  id: string;
  /** null while the user has not named it; the shown name is then made from its place in the list. */
  name: string | null;
  panelId: string | null;
  widthPanels: number;
  heightPanels: number;
  cutouts?: Cutout[];
  /** Corner columns, as the corner panel's equipment id. */
  corners?: { afterColumn: number; panelId: string }[];
  /** How the panels are chained into circuits; missing = the default (columns from the bottom left). */
  powerLayout?: PowerLayout;
  /** The order of the data chains; missing = the power wiring's order. */
  signalLayout?: SignalLayout;
  /** A curved wall: the server fits the joint angles to the panel. */
  curve?: ScreenCurve;
  selectedOption: number;
}

const STORAGE_KEY = 'stagetrack-led-job-v2';

interface StoredJob {
  voltage: number;
  mode: PowerMode;
  screens: StoredScreen[];
}

const DEFAULT_JOB: StoredJob = { voltage: 220, mode: 'Max', screens: [] };

function load(): StoredJob {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_JOB;
    const parsed = JSON.parse(raw) as StoredJob;
    return { ...DEFAULT_JOB, ...parsed, screens: Array.isArray(parsed.screens) ? parsed.screens : [] };
  } catch {
    return DEFAULT_JOB;
  }
}

export const newStoredScreen = (): StoredScreen => ({
  id: `s${Date.now().toString(36)}${Math.round(Math.random() * 1e6).toString(36)}`,
  name: null,
  panelId: null,
  widthPanels: 10,
  heightPanels: 6,
  selectedOption: 0,
});

/**
 * The job and its results. Every screen is sent to the server as a whole, because the maths runs there: the
 * browser never recalculates power or processors on its own, so two screens can never disagree.
 */
export function useLedJob({ wiring = false }: { wiring?: boolean } = {}) {
  const { t } = useTranslation();
  const [job, setJob] = useState<StoredJob>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(job));
  }, [job]);

  const panels = useQuery({ queryKey: ['led-inventory', 'Panel', undefined], queryFn: () => ledApi.panels() });

  const panelById = useMemo(
    () => new Map((panels.data ?? []).map((p: LedPanel) => [p.equipmentId, p])),
    [panels.data],
  );

  const location = useMemo(() => currentLocation(t('led.inventoryTitle')), [t]);

  /** The screens as the drawing and wiring code wants them, with the panel resolved from the inventory. */
  const walls = useMemo<WallConfig[]>(
    () =>
      job.screens.map((s, index) => {
        const panel = s.panelId ? panelById.get(s.panelId) : undefined;
        const corners = (s.corners ?? [])
          .map((c) => {
            const cornerPanel = panelById.get(c.panelId);
            return cornerPanel ? { afterColumn: c.afterColumn, panel: toInventoryItem(cornerPanel, location) } : null;
          })
          .filter((c): c is ScreenCorner => c !== null);

        return {
          id: s.id,
          name: { index: index + 1, custom: s.name },
          panel: panel ? toInventoryItem(panel, location) : null,
          widthPanels: s.widthPanels,
          heightPanels: s.heightPanels,
          cutouts: s.cutouts,
          corners: corners.length > 0 ? corners : undefined,
          powerLayout: s.powerLayout,
          signalLayout: s.signalLayout,
          curve: s.curve,
        };
      }),
    [job.screens, panelById, location],
  );

  const nameOf = useCallback(
    (wall: WallConfig) => screenDisplayName(wall.name, (key, vars) => String(t(key, vars as never))),
    [t],
  );

  /** Built by the ported helper, so the request the drawing code implies is exactly the one that is sent. */
  const request = useMemo(
    () =>
      buildEvaluateRequest(
        walls,
        job.voltage,
        job.mode === 'Max' ? 'max' : 'ort',
        { perScreenRecommendationChoice: Object.fromEntries(job.screens.map((s) => [s.id, s.selectedOption])) },
        true,
        { wiring },
      ),
    [walls, job.voltage, job.mode, job.screens, wiring],
  );

  const evaluation = useQuery({
    queryKey: ['led-evaluate', request],
    queryFn: () => ledApi.evaluate(request as unknown as { voltage: number; mode: PowerMode; screens: EvaluateScreenRequest[] }),
    enabled: job.screens.length > 0,
  });

  const update = useCallback(
    (id: string, patch: Partial<StoredScreen>) =>
      setJob((j) => ({ ...j, screens: j.screens.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
    [],
  );

  const add = useCallback(() => setJob((j) => ({ ...j, screens: [...j.screens, newStoredScreen()] })), []);

  const remove = useCallback(
    (id: string) => setJob((j) => ({ ...j, screens: j.screens.filter((s) => s.id !== id) })),
    [],
  );

  const setPower = useCallback((voltage: number, mode: PowerMode) => setJob((j) => ({ ...j, voltage, mode })), []);

  const clear = useCallback(() => setJob(DEFAULT_JOB), []);

  return { job, walls, nameOf, panels, panelById, location, request, evaluation, add, update, remove, setPower, clear };
}
