import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ledApi } from '../../api/endpoints';
import type { EvaluateScreenRequest, LedPanel, PowerMode } from '../../api/ledTypes';

/**
 * One LED job while the user works on it: its screens, the voltage and power mode, and the server's answer.
 * Kept in this browser (not saved) until it is transferred onto a real job — that is what makes it permanent.
 */
export interface LedScreen {
  id: string;
  name: string;
  panelId?: string | null;
  columns: number;
  rows: number;
  selectedOption: number;
}

const STORAGE_KEY = 'stagetrack-led-job-v1';

interface StoredJob {
  voltage: number;
  mode: PowerMode;
  screens: LedScreen[];
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

export const newScreen = (index: number): LedScreen => ({
  id: `s${Date.now().toString(36)}${index}`,
  name: `Ekran ${index + 1}`,
  panelId: null,
  columns: 10,
  rows: 6,
  selectedOption: 0,
});

/**
 * The job and its results. Every screen the user draws is sent to the server as a whole, because the maths runs
 * there: the browser never recalculates power or processors on its own, so two screens can never disagree.
 */
export function useLedJob() {
  const [job, setJob] = useState<StoredJob>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(job));
  }, [job]);

  const panels = useQuery({ queryKey: ['led-inventory', 'Panel', undefined], queryFn: () => ledApi.panels() });
  const panelById = useMemo(
    () => new Map((panels.data ?? []).map((p: LedPanel) => [p.equipmentId, p])),
    [panels.data],
  );

  const request = useMemo(
    () => ({
      voltage: job.voltage,
      mode: job.mode,
      screens: job.screens.map<EvaluateScreenRequest>((s) => ({
        id: s.id,
        panelModelId: s.panelId ?? null,
        columns: s.columns,
        rows: s.rows,
        selectedOption: s.selectedOption,
      })),
    }),
    [job],
  );

  const evaluation = useQuery({
    queryKey: ['led-evaluate', request],
    queryFn: () => ledApi.evaluate(request),
    enabled: job.screens.length > 0,
  });

  const update = useCallback(
    (id: string, patch: Partial<LedScreen>) =>
      setJob((j) => ({ ...j, screens: j.screens.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
    [],
  );

  const add = useCallback(() => setJob((j) => ({ ...j, screens: [...j.screens, newScreen(j.screens.length)] })), []);

  const remove = useCallback(
    (id: string) => setJob((j) => ({ ...j, screens: j.screens.filter((s) => s.id !== id) })),
    [],
  );

  const setPower = useCallback((voltage: number, mode: PowerMode) => setJob((j) => ({ ...j, voltage, mode })), []);

  const clear = useCallback(() => setJob(DEFAULT_JOB), []);

  return { job, panels, panelById, request, evaluation, add, update, remove, setPower, clear };
}
