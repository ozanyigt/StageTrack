import { Button, Card, Checkbox, Col, Empty, Flex, InputNumber, Row, Segmented, Select, Space, Statistic, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ledApi, projectApi } from '../../api/endpoints';
import type { LedStageSettings } from '../../api/ledTypes';
import { StagePropsPanel } from '../draft/StagePropsPanel';
import { usePlanTexture } from '../draft/usePlanTexture';
import { usePlanImage } from '../draft/useVenue';
import { useStageScene } from '../draft/useStageScene';
import { RiggingCard } from '../draft/RiggingCard';
import { VenueCard } from '../draft/VenueCard';
import { useErrorToast } from '../../utils/errors';
import { useBomLines } from './components/CarrierFacts';
import StageViewport, { type StageView } from './components/StageViewport';
import { CAMERA_PRESETS, type CameraPreset } from './core/stage3d/camera';
import { carrierLabel, carriers, totalBom } from './core/stage3d/carriers';
import { STAGE_LIMITS, STAGE_STEPS, clampSetting } from './core/stage3d/settings';
import { stageTotals } from './core/stage3d/totals';
import { useLedJob } from './useLedJob';

const VIEW_KEY = 'stagetrack-led-stage-view-v1';

const DEFAULT_VIEW: StageView = {
  showGrid: true,
  showPodium: true,
  showRig: true,
  showDimensions: true,
  showLabels: true,
  showCurveAngles: true,
};

/**
 * The 3D stage: the job's walls standing where they will stand, on their towers or hung from a truss, with the
 * podium around them. It reads the Pixel Map for where the screens sit relative to each other — a wall placed to
 * the right of another on the map stands to its right here — so the two screens cannot tell different stories.
 *
 * The stage and mounting values live on the server (one row per firm location), because they describe the firm's
 * own rig, not this job; where each screen stands on the floor is per job and stays in this browser.
 *
 * The other trades stand here too - the sound groups, the fixtures, the truss and the decking - drawn from each
 * product's own measurements and put down by hand, because nothing in an inventory knows where a speaker should
 * go. That is the designer's call, and this is where they make it.
 */
export function LedStagePage() {
  const { t } = useTranslation();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const {
    job,
    settings,
    loadingSettings,
    equipmentById,
    layout,
    placements,
    setPlacements,
    propPlacements,
    setPropPlacements,
    sceneProps,
    venue,
    room,
    rigHeightM,
    evaluation,
  } = useStageScene();
  const { setProject } = useLedJob();

  const [view, setView] = useState<StageView>(() => {
    try {
      return { ...DEFAULT_VIEW, ...(JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null') ?? {}) };
    } catch {
      return DEFAULT_VIEW;
    }
  });
  const [armedId, setArmedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preset, setPreset] = useState<CameraPreset>('perspective');
  const [presetKey, setPresetKey] = useState(0);

  useEffect(() => localStorage.setItem(VIEW_KEY, JSON.stringify(view)), [view]);

  /** Which job this draft is for: the room hangs off it, and so will the transfer. */
  const jobs = useQuery({
    queryKey: ['projects', 'draft-picker'],
    queryFn: () => projectApi.list({ statuses: ['Draft', 'Pending', 'Confirmed', 'Prepped', 'OnLocation'], maxResultCount: 300, sorting: 'planStart' }),
  });

  const planUrl = usePlanImage(venue?.planAttachmentId);
  const planTexture = usePlanTexture(planUrl, venue?.planMetresPerPixel);

  const save = useMutation({
    mutationFn: (next: LedStageSettings) => ledApi.saveStage(next),
    onSuccess: (next) => queryClient.setQueryData(['led-stage'], next),
    onError: showError,
  });

  const moveProp = (id: string, at: { x: number; z: number }) =>
    setPropPlacements((p) => ({ ...p, [id]: { rotationDeg: p[id]?.rotationDeg ?? 0, flown: p[id]?.flown, ...at } }));

  /** Where a group is now - its placement, or where it was parked before anyone placed it. */
  const placementOf = (id: string) => {
    const existing = propPlacements[id];
    if (existing) return existing;
    const parked = sceneProps.find((p) => p.id === id);
    return { x: parked?.x ?? 0, z: parked?.z ?? 0, rotationDeg: parked?.rotationDeg ?? 0 };
  };

  const placeProp = (id: string, at: { x?: number; z?: number; rotationDeg?: number }) =>
    setPropPlacements((p) => ({ ...p, [id]: { ...placementOf(id), ...at } }));

  /** The same distance the other way across the centre line, which is how a second hang is usually described. */
  const mirrorProp = (id: string) => {
    const current = placementOf(id);
    placeProp(id, { x: -current.x, rotationDeg: (360 - current.rotationDeg) % 360 });
  };

  /** This trade's placed groups, spaced evenly across the stage at the depth they already share. */
  const spreadTrade = (trade: string) => {
    const of = sceneProps.filter((p) => p.trade === trade);
    if (of.length < 2 || !settings) return;
    const half = settings.stageWidthM / 2;
    const z = of.reduce((sum, p) => sum + p.z, 0) / of.length;
    setPropPlacements((p) => {
      const next = { ...p };
      of.forEach((prop, index) => {
        const x = -half + ((index + 0.5) * (half * 2)) / of.length;
        next[prop.id] = { ...placementOf(prop.id), x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 };
      });
      return next;
    });
  };

  // Arrow keys nudge the selected group: 10 cm, or a metre with Shift. Not while a field has the focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId || !propPlacements[selectedId]) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const step = e.shiftKey ? 1 : 0.1;
      const by: Record<string, { x?: number; z?: number }> = {
        ArrowLeft: { x: -step },
        ArrowRight: { x: step },
        ArrowUp: { z: -step },
        ArrowDown: { z: step },
      };
      const delta = by[e.key];
      if (!delta) return;
      e.preventDefault();
      const current = propPlacements[selectedId];
      setPropPlacements((p) => ({
        ...p,
        [selectedId]: {
          ...current,
          x: Math.round((current.x + (delta.x ?? 0)) * 100) / 100,
          z: Math.round((current.z + (delta.z ?? 0)) * 100) / 100,
        },
      }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, propPlacements]);

  const rig = useMemo(() => (layout && settings ? carriers(layout, settings) : []), [layout, settings]);
  const label = useMemo(() => (layout && settings ? carrierLabel(layout, settings, rig) : null), [layout, settings, rig]);
  const bom = useMemo(() => totalBom(rig), [rig]);
  const bomLines = useBomLines();
  const totals = useMemo(
    () => stageTotals(layout?.screens.map((s) => s.screen.id) ?? [], evaluation.data?.screens),
    [layout, evaluation.data],
  );

  const setNumber = (key: keyof typeof STAGE_LIMITS, value: number | null) => {
    if (!settings || value == null) return;
    save.mutate({ ...settings, [key]: clampSetting(key, value) } as LedStageSettings);
  };

  if (job.screens.length === 0 && sceneProps.length === 0) {
    // Nothing to stand in the room yet - but the room itself can be entered now, and usually is entered first.
    return (
      <>
        <div className="page-header">
          <Typography.Title level={3} style={{ margin: 0 }}>{t('led.stageTitle')}</Typography.Title>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 260 }}
            placeholder={t('draft.pickJob')}
            value={job.projectId ?? undefined}
            loading={jobs.isLoading}
            onChange={(value) => setProject(value ?? null)}
            options={(jobs.data?.items ?? []).map((j) => ({ value: j.id, label: `${j.number} · ${j.name}` }))}
          />
        </div>
        <Row gutter={[12, 12]}>
          <Col xs={24} xl={17}>
            <Card><Empty description={t('draft.nothingForStage')} /></Card>
          </Col>
          <Col xs={24} xl={7}>
            <VenueCard projectId={job.projectId} rigHeightM={rigHeightM} />
          </Col>
        </Row>
      </>
    );
  }

  /** Only the metre fields have limits; the mount and carrier are pickers. */
  type MetreKey = keyof typeof STAGE_LIMITS;

  const numberField = (key: MetreKey, labelKey: string) => (
    <Col xs={12} md={8} key={key}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t(labelKey)}</Typography.Text>
      <InputNumber
        size="small"
        style={{ width: '100%' }}
        min={STAGE_LIMITS[key].min}
        max={STAGE_LIMITS[key].max}
        step={STAGE_STEPS[key]}
        value={settings?.[key]}
        onChange={(v) => setNumber(key, v)}
        addonAfter="m"
      />
    </Col>
  );

  return (
    <>
      <div className="page-header">
        <Space align="center" wrap>
          <Typography.Title level={3} style={{ margin: 0 }}>{t('led.stageTitle')}</Typography.Title>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 260 }}
            placeholder={t('draft.pickJob')}
            value={job.projectId ?? undefined}
            loading={jobs.isLoading}
            onChange={(value) => setProject(value ?? null)}
            options={(jobs.data?.items ?? []).map((j) => ({ value: j.id, label: `${j.number} · ${j.name}` }))}
          />
        </Space>
        <Space size="large" wrap>
          <Statistic title={t('led.screens')} value={layout?.screens.length ?? 0} valueStyle={{ fontSize: 18 }} />
          <Statistic title={t('led.weight')} value={Math.round(totals.weightKg)} suffix="kg" valueStyle={{ fontSize: 18 }} />
          <Statistic title={t('led.totalWatt')} value={Math.round(totals.wattMax)} suffix="W" valueStyle={{ fontSize: 18 }} />
        </Space>
      </div>

      <Row gutter={[12, 12]}>
        <Col xs={24} xl={17}>
          <Card size="small" styles={{ body: { padding: 0, height: 560 } }}>
            {layout ? (
              <StageViewport
                layout={layout}
                props={sceneProps}
                carriers={rig}
                carrierLabel={label}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMove={(id, at) => setPlacements((p) => ({ ...p, [id]: { ...(p[id] ?? { x: 0, z: 0, rotationDeg: 0 }), ...at } }))}
                onMoveProp={moveProp}
                room={room}
                roomPlan={
                  planTexture && venue
                    ? {
                        texture: planTexture.texture,
                        widthM: planTexture.widthM,
                        depthM: planTexture.depthM,
                        originXM: venue.planOriginXM,
                        originZM: venue.planOriginZM,
                        rotationDeg: venue.planRotationDeg,
                      }
                    : null
                }
                onDropAt={(at) => {
                  // Whatever was picked up - dragged from the list or armed with the crosshair - lands here.
                  if (armedId) {
                    moveProp(armedId, at);
                    setSelectedId(armedId);
                    setArmedId(null);
                  }
                }}
                preset={preset}
                presetKey={presetKey}
                view={view}
              />
            ) : (
              <Flex align="center" justify="center" style={{ height: '100%' }}>
                <Empty description={t('led.stageNeedsMap')} />
              </Flex>
            )}
          </Card>

          <Flex gap={8} wrap style={{ marginTop: 8 }}>
            <Segmented
              value={preset}
              onChange={(v) => {
                setPreset(v as CameraPreset);
                setPresetKey((k) => k + 1);
              }}
              options={CAMERA_PRESETS.map((p) => ({ value: p, label: t(`led.stage.camera.${p}`) }))}
            />
            <Button size="small" onClick={() => setPresetKey((k) => k + 1)}>{t('led.stage.reframe')}</Button>
            {Object.keys(placements).length > 0 && (
              <Button size="small" onClick={() => setPlacements({})}>{t('led.stage.resetPlacements')}</Button>
            )}
          </Flex>
        </Col>

        <Col xs={24} xl={7}>
          <Card size="small" title={t('led.stage.settings')} loading={loadingSettings}>
            {settings && (
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Segmented
                  block
                  value={settings.mount}
                  onChange={(v) => save.mutate({ ...settings, mount: v as 'Ground' | 'Flown' } as LedStageSettings)}
                  options={[
                    { value: 'Ground', label: t('enums.ledStageMount.Ground') },
                    { value: 'Flown', label: t('enums.ledStageMount.Flown') },
                  ]}
                />
                {settings.mount === 'Ground' && (
                  <Select
                    size="small"
                    style={{ width: '100%' }}
                    value={settings.carrier}
                    onChange={(carrier) => save.mutate({ ...settings, carrier } as LedStageSettings)}
                    options={[
                      { value: 'Scaff', label: t('enums.ledStageCarrier.Scaff') },
                      { value: 'LedFrame', label: t('enums.ledStageCarrier.LedFrame') },
                    ]}
                  />
                )}

                <Row gutter={[8, 8]}>
                  {numberField('stageWidthM', 'led.stage.stageWidth')}
                  {numberField('stageDepthM', 'led.stage.stageDepth')}
                  {numberField('stageHeightM', 'led.stage.stageHeight')}
                  {numberField('frontGapM', 'led.stage.frontGap')}
                  {settings.mount === 'Ground' ? (
                    <>
                      {numberField('bottomM', 'led.stage.bottom')}
                      {settings.carrier === 'Scaff' && numberField('legDepthM', 'led.stage.legDepth')}
                    </>
                  ) : (
                    <>
                      {numberField('trussHeightM', 'led.stage.trussHeight')}
                      {numberField('hangAllowanceM', 'led.stage.hangAllowance')}
                    </>
                  )}
                </Row>

                {settings.mount === 'Ground' && (
                  <>
                    <Checkbox
                      checked={settings.groundSupport}
                      onChange={(e) => save.mutate({ ...settings, groundSupport: e.target.checked } as LedStageSettings)}
                    >
                      {t('led.stage.groundSupport')}
                    </Checkbox>
                    {settings.groundSupport && (
                      <Row gutter={[8, 8]}>{numberField('groundSupportHeightM', 'led.stage.groundSupportHeight')}</Row>
                    )}
                  </>
                )}
              </Space>
            )}
          </Card>

          <div style={{ marginTop: 12 }}>
            <VenueCard projectId={job.projectId} rigHeightM={rigHeightM} />
          </div>

          <div style={{ marginTop: 12 }}>
            <RiggingCard
              flownScreenKg={totals.weightKg}
              flown={settings?.mount === 'Flown'}
              props={sceneProps}
              lines={job.lines}
              equipmentById={equipmentById}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <StagePropsPanel
              props={sceneProps}
              placements={propPlacements}
              selectedId={selectedId}
              armedId={armedId}
              onArm={setArmedId}
              onSelect={setSelectedId}
              onFlown={(id, flown) =>
                setPropPlacements((p) => {
                  const current = p[id] ?? { x: sceneProps.find((x) => x.id === id)?.x ?? 0, z: sceneProps.find((x) => x.id === id)?.z ?? 0, rotationDeg: 0 };
                  return { ...p, [id]: { ...current, flown } };
                })
              }
              onRotate={(id, degrees) =>
                setPropPlacements((p) => {
                  const current = p[id] ?? { x: sceneProps.find((x) => x.id === id)?.x ?? 0, z: sceneProps.find((x) => x.id === id)?.z ?? 0, rotationDeg: 0 };
                  return { ...p, [id]: { ...current, rotationDeg: (current.rotationDeg + degrees) % 360 } };
                })
              }
              onReset={(id) =>
                setPropPlacements((p) => {
                  const next = { ...p };
                  delete next[id];
                  return next;
                })
              }
              onPlaceAt={placeProp}
              onMirror={mirrorProp}
              onSpread={spreadTrade}
            />
          </div>

          <Card size="small" title={t('led.stage.view')} style={{ marginTop: 12 }}>
            <Space direction="vertical">
              {(['showGrid', 'showPodium', 'showRig', 'showDimensions', 'showLabels', 'showCurveAngles'] as const).map((key) => (
                <Checkbox key={key} checked={view[key]} onChange={(e) => setView((v) => ({ ...v, [key]: e.target.checked }))}>
                  {t(`led.stage.${key}`)}
                </Checkbox>
              ))}
            </Space>
          </Card>

          {bom && (
            <Card size="small" title={t('led.stage.bom')} style={{ marginTop: 12 }}>
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                {bomLines(bom).map(([name, amount]) => (
                  <Flex key={name} justify="space-between" gap={8}>
                    <Typography.Text type="secondary">{name}</Typography.Text>
                    <Typography.Text>{amount}</Typography.Text>
                  </Flex>
                ))}
              </Space>
            </Card>
          )}

          {label && (
            <Card size="small" style={{ marginTop: 12 }}>
              <Tag color="geekblue">
                {t(`led.stage.carrierLabel.${label.kind}`, { m: label.valueM.toFixed(2) })}
              </Tag>
            </Card>
          )}
        </Col>
      </Row>
    </>
  );
}
