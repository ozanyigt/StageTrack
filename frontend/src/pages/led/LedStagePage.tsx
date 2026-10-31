import { Button, Card, Checkbox, Col, Empty, Flex, InputNumber, Row, Segmented, Select, Space, Statistic, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ledApi } from '../../api/endpoints';
import type { LedStageSettings } from '../../api/ledTypes';
import { useErrorToast } from '../../utils/errors';
import { useBomLines } from './components/CarrierFacts';
import StageViewport, { type StageView } from './components/StageViewport';
import { CAMERA_PRESETS, type CameraPreset } from './core/stage3d/camera';
import { carrierLabel, carriers, totalBom } from './core/stage3d/carriers';
import { sanitizePlacements, type Placements } from './core/stage3d/placements';
import { sceneLayout } from './core/stage3d/scene';
import { stage3dScreens } from './core/stage3d/screens';
import { STAGE_LIMITS, STAGE_STEPS, clampSetting, type StageSettings } from './core/stage3d/settings';
import { stageTotals } from './core/stage3d/totals';
import { usePixelMap } from './usePixelMap';
import { useLedJob } from './useLedJob';

const PLACEMENTS_KEY = 'stagetrack-led-stage-placements-v1';
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
 */
export function LedStagePage() {
  const { t } = useTranslation();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const { job, walls, nameOf, evaluation } = useLedJob();
  const { state: mapState } = usePixelMap(walls, nameOf);

  const [placements, setPlacements] = useState<Placements>(() => {
    try {
      return sanitizePlacements(JSON.parse(localStorage.getItem(PLACEMENTS_KEY) ?? 'null'));
    } catch {
      return {};
    }
  });
  const [view, setView] = useState<StageView>(() => {
    try {
      return { ...DEFAULT_VIEW, ...(JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null') ?? {}) };
    } catch {
      return DEFAULT_VIEW;
    }
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preset, setPreset] = useState<CameraPreset>('perspective');
  const [presetKey, setPresetKey] = useState(0);

  useEffect(() => localStorage.setItem(PLACEMENTS_KEY, JSON.stringify(placements)), [placements]);
  useEffect(() => localStorage.setItem(VIEW_KEY, JSON.stringify(view)), [view]);

  const stored = useQuery({ queryKey: ['led-stage'], queryFn: () => ledApi.stage() });

  const save = useMutation({
    mutationFn: (next: LedStageSettings) => ledApi.saveStage(next),
    onSuccess: (next) => queryClient.setQueryData(['led-stage'], next),
    onError: showError,
  });

  /** The server's DTO and the ported library share field names and enum values, so no mapping is needed. */
  const settings = (stored.data ?? null) as StageSettings | null;

  const layout = useMemo(() => {
    if (!settings) return null;
    const built = stage3dScreens(walls, mapState, evaluation.data?.screens, nameOf, true);
    return built.screens.length > 0 ? sceneLayout(built.screens, settings, placements) : null;
  }, [walls, mapState, evaluation.data, nameOf, settings, placements]);

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

  if (job.screens.length === 0) {
    return (
      <>
        <Typography.Title level={3} style={{ marginTop: 0 }}>{t('led.stageTitle')}</Typography.Title>
        <Card><Empty description={t('led.noScreensForStage')} /></Card>
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
        <Typography.Title level={3}>{t('led.stageTitle')}</Typography.Title>
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
                carriers={rig}
                carrierLabel={label}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMove={(id, at) => setPlacements((p) => ({ ...p, [id]: { ...(p[id] ?? { x: 0, z: 0, rotationDeg: 0 }), ...at } }))}
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
          <Card size="small" title={t('led.stage.settings')} loading={stored.isLoading}>
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
