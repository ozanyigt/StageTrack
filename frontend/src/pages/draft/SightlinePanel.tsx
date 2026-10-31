import { Alert, Card, Col, Empty, Flex, Progress, Row, Slider, Statistic, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLedJob } from '../led/useLedJob';
import { analyseSightlines, EYE_HEIGHT_M, MAX_OFF_AXIS_DEG, MAX_SCREEN_HEIGHTS, type SightObstacle, type SightScreen, type SightVerdict } from './sightlines';
import { SightlineView, VERDICT_COLOUR } from './SightlineView';
import { useStageScene } from './useStageScene';

const VERDICTS: SightVerdict[] = ['Good', 'TooClose', 'TooSteep', 'TooFar', 'Blocked'];

/**
 * What the audience sees. The design already knows where the screens stand, how big they are and what pitch
 * their panels have; the room says how far back the last row is and how the floor rises. Put together they
 * answer the only question a client ever asks about a screen - "can they see it from the back?" - before
 * anybody drives to the venue.
 */
export function SightlinePanel() {
  const { t } = useTranslation();
  const { job, layout, sceneProps, venue, room } = useStageScene();
  const { panelById } = useLedJob();
  const [eyeHeight, setEyeHeight] = useState(EYE_HEIGHT_M);

  const screens: SightScreen[] = useMemo(
    () =>
      (layout?.screens ?? []).map((placed) => {
        const stored = job.screens.find((s) => s.id === placed.screen.id);
        const panel = stored?.panelId ? panelById.get(stored.panelId) : undefined;
        return {
          id: placed.screen.id,
          x: placed.x,
          z: placed.z,
          rotationDeg: placed.rotationDeg,
          widthM: placed.screen.widthM,
          heightM: placed.screen.heightM,
          bottomM: placed.bottom,
          pitchMm: panel?.pitchMm ?? null,
        };
      }),
    [layout, job.screens, panelById],
  );

  const obstacles: SightObstacle[] = useMemo(
    () =>
      sceneProps.map((prop) => ({
        x: prop.x,
        z: prop.z,
        widthM: prop.size.w * prop.bodies,
        depthM: prop.size.d,
        heightM: prop.size.h,
        flown: prop.y > (layout?.podium.height ?? 0) + 0.5,
      })),
    [sceneProps, layout],
  );

  const area = useMemo(() => {
    if (room) return { minX: room.minX, maxX: room.maxX, minZ: (layout?.podium.front ?? 0) + 1, maxZ: room.maxZ };
    const podium = layout?.podium;
    if (!podium) return null;
    // Without a room, a sensible stretch of open ground in front of the stage rather than nothing at all.
    return { minX: -podium.width, maxX: podium.width, minZ: podium.front + 1, maxZ: podium.front + 40 };
  }, [room, layout]);

  const result = useMemo(
    () => (area && screens.length > 0 ? analyseSightlines(area, screens, obstacles, { cellM: 1, rakeDeg: venue?.rakeDeg ?? 0, eyeHeightM: eyeHeight }) : null),
    [area, screens, obstacles, venue, eyeHeight],
  );

  if (screens.length === 0 || !layout || !result) {
    return <Card><Empty description={t('draft.noScreensForSightlines')} /></Card>;
  }

  const unpitched = screens.filter((s) => s.pitchMm === null).length;

  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} xl={16}>
        {!room && <Alert type="info" showIcon style={{ marginBottom: 8 }} message={t('draft.noRoomForSightlines')} />}
        {unpitched > 0 && (
          <Alert type="warning" showIcon style={{ marginBottom: 8 }} message={t('draft.unpitchedScreens', { count: unpitched })} />
        )}
        <Card size="small" styles={{ body: { padding: 8 } }}>
          <SightlineView result={result} screens={screens} podium={layout.podium} room={room} />
        </Card>
      </Col>

      <Col xs={24} xl={8}>
        <Card size="small" title={t('draft.sightlines')}>
          <Statistic
            title={t('draft.goodShare')}
            value={Math.round(result.goodShare * 100)}
            suffix="%"
            valueStyle={{ color: result.goodShare > 0.8 ? '#16a34a' : result.goodShare > 0.5 ? '#d97706' : '#dc2626' }}
          />
          <Progress percent={Math.round(result.goodShare * 100)} showInfo={false} strokeColor={VERDICT_COLOUR.Good} />

          <Flex vertical gap={4} style={{ marginTop: 12 }}>
            {VERDICTS.map((verdict) => (
              <Flex key={verdict} justify="space-between" align="center">
                <Tag color={VERDICT_COLOUR[verdict]}>{t(`draft.verdict.${verdict}`)}</Tag>
                <Typography.Text type="secondary">
                  {result.counts[verdict]} m² · {Math.round((result.counts[verdict] / (result.cells.length || 1)) * 100)}%
                </Typography.Text>
              </Flex>
            ))}
          </Flex>

          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12 }}>
            {t('draft.sightlineRules', { offAxis: MAX_OFF_AXIS_DEG, heights: MAX_SCREEN_HEIGHTS })}
          </Typography.Paragraph>

          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('draft.eyeHeight')}</Typography.Text>
          <Slider min={1} max={2.2} step={0.05} value={eyeHeight} onChange={setEyeHeight} tooltip={{ formatter: (v) => `${v} m` }} />
          {venue && venue.rakeDeg > 0 && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('draft.rakeCounted', { deg: venue.rakeDeg })}</Typography.Text>
          )}
        </Card>
      </Col>
    </Row>
  );
}
