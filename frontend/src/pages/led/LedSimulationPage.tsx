import { Alert, Card, Checkbox, Col, Empty, Flex, InputNumber, Row, Segmented, Select, Space, Switch, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LedSimulationScreen } from './LedSimulationScreen';
import { DIRECTIONS, STARTS, powerLayoutOf, signalLayoutOf } from './core/simulation/wiring';
import type { PowerLayout } from './core/types';
import { useLedJob } from './useLedJob';

/**
 * Simulation: how the panels are chained into power circuits and data chains. The layout is a real decision — a
 * cable that snakes along the rows instead of the columns changes how many CEE circuits a wall needs — so these
 * controls feed the same calculation the power page reports, not a separate drawing.
 */
export function LedSimulationPage({ hideTitle = false }: { hideTitle?: boolean } = {}) {
  const { t } = useTranslation();
  // The wiring map is only asked for on this page; everywhere else the answer would be thrown away.
  const { job, walls, nameOf, evaluation, update } = useLedJob({ wiring: true });
  const [view, setView] = useState<'power' | 'signal'>('power');

  const result = evaluation.data;

  if (job.screens.length === 0) {
    return (
      <>
        {!hideTitle && <Typography.Title level={3} style={{ marginTop: 0 }}>{t('led.simTitle')}</Typography.Title>}
        <Card><Empty description={t('led.noScreensForSim')} /></Card>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        {!hideTitle && <Typography.Title level={3}>{t('led.simTitle')}</Typography.Title>}
        <Segmented
          value={view}
          onChange={(v) => setView(v as 'power' | 'signal')}
          options={[
            { value: 'power', label: t('led.sim.power') },
            { value: 'signal', label: t('led.sim.signal') },
          ]}
        />
      </div>

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {job.screens.map((screen, index) => {
          const wall = walls[index];
          const evaluated = result?.screens.find((s) => s.id === screen.id);
          const layout = powerLayoutOf(wall);
          const signal = signalLayoutOf(wall);
          const setLayout = (patch: Partial<PowerLayout>) => update(screen.id, { powerLayout: { ...layout, ...patch } });

          return (
            <Card key={screen.id} size="small" title={screen.name ?? nameOf(wall)} loading={evaluation.isFetching && !evaluated}>
              <Row gutter={[16, 12]}>
                <Col xs={24} lg={10}>
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Typography.Text type="secondary">{t('led.sim.powerLayout')}</Typography.Text>
                    <Flex gap={8} wrap>
                      <Select
                        size="small"
                        style={{ minWidth: 130 }}
                        value={layout.direction}
                        onChange={(direction) => setLayout({ direction })}
                        options={DIRECTIONS.map((d) => ({ value: d, label: t(`enums.wiringDirection.${d}`) }))}
                      />
                      <Select
                        size="small"
                        style={{ minWidth: 160 }}
                        value={layout.start}
                        onChange={(start) => setLayout({ start })}
                        options={STARTS.map((s) => ({ value: s, label: t(`enums.wiringStart.${s}`) }))}
                      />
                    </Flex>
                    <Checkbox checked={layout.keepLinesWhole} onChange={(e) => setLayout({ keepLinesWhole: e.target.checked })}>
                      {t('led.sim.keepLinesWhole')}
                    </Checkbox>
                    <Checkbox checked={layout.serpentine !== false} onChange={(e) => setLayout({ serpentine: e.target.checked })}>
                      {t('led.sim.serpentine')}
                    </Checkbox>

                    <Flex gap={8} align="center" style={{ marginTop: 8 }}>
                      <Typography.Text type="secondary">{t('led.sim.ownSignalLayout')}</Typography.Text>
                      <Switch
                        size="small"
                        checked={!!signal}
                        onChange={(on) =>
                          update(screen.id, {
                            signalLayout: on ? { direction: layout.direction, start: layout.start, serpentine: true } : undefined,
                          })
                        }
                      />
                    </Flex>
                    {signal && (
                      <Flex gap={8} wrap>
                        <Select
                          size="small"
                          style={{ minWidth: 130 }}
                          value={signal.direction}
                          onChange={(direction) => update(screen.id, { signalLayout: { ...signal, direction } })}
                          options={DIRECTIONS.map((d) => ({ value: d, label: t(`enums.wiringDirection.${d}`) }))}
                        />
                        <Select
                          size="small"
                          style={{ minWidth: 160 }}
                          value={signal.start}
                          onChange={(start) => update(screen.id, { signalLayout: { ...signal, start } })}
                          options={STARTS.map((s) => ({ value: s, label: t(`enums.wiringStart.${s}`) }))}
                        />
                      </Flex>
                    )}

                    <Flex gap={8} align="center" style={{ marginTop: 8 }}>
                      <Typography.Text type="secondary">{t('led.sim.curve')}</Typography.Text>
                      <Switch
                        size="small"
                        checked={!!screen.curve}
                        onChange={(on) =>
                          update(screen.id, { curve: on ? { mode: 'Arc', value: 30, direction: 'Concave' } : undefined })
                        }
                      />
                    </Flex>
                    {screen.curve && (
                      <Flex gap={8} wrap align="center">
                        <Segmented
                          size="small"
                          value={screen.curve.mode}
                          onChange={(mode) =>
                            update(screen.id, {
                              curve: { ...screen.curve!, mode: mode as 'Arc' | 'Radius', value: mode === 'Arc' ? 30 : 10 },
                            })
                          }
                          options={[
                            { value: 'Arc', label: t('led.sim.arc') },
                            { value: 'Radius', label: t('led.sim.radius') },
                          ]}
                        />
                        <InputNumber
                          size="small"
                          min={0.1}
                          max={screen.curve.mode === 'Arc' ? 360 : 10000}
                          value={screen.curve.value}
                          onChange={(value) => value != null && update(screen.id, { curve: { ...screen.curve!, value } })}
                          addonAfter={screen.curve.mode === 'Arc' ? '°' : 'm'}
                          style={{ width: 120 }}
                        />
                        <Segmented
                          size="small"
                          value={screen.curve.direction}
                          onChange={(direction) =>
                            update(screen.id, { curve: { ...screen.curve!, direction: direction as 'Concave' | 'Convex' } })
                          }
                          options={[
                            { value: 'Concave', label: t('led.sim.concave') },
                            { value: 'Convex', label: t('led.sim.convex') },
                          ]}
                        />
                      </Flex>
                    )}

                    {evaluated?.curve && (
                      <Space size={6} wrap>
                        <Tag>{t('led.sim.jointAngle', { deg: evaluated.curve.appliedJointDeg.toFixed(1) })}</Tag>
                        <Tag>{t('led.sim.achievedArc', { deg: evaluated.curve.achievedArcDeg.toFixed(1) })}</Tag>
                        {evaluated.curve.achievedRadiusM != null && (
                          <Tag>{t('led.sim.achievedRadius', { m: evaluated.curve.achievedRadiusM.toFixed(2) })}</Tag>
                        )}
                      </Space>
                    )}

                    {evaluated?.warnings.length ? (
                      <Alert
                        type="warning"
                        showIcon
                        message={evaluated.warnings.map((w) => t(`led.sim.warning.${w}`, { defaultValue: w })).join(' · ')}
                      />
                    ) : null}

                    {evaluated?.power && (
                      <Space size={6} wrap>
                        <Tag color="gold">{t('led.circuitsNeeded', { count: evaluated.power.circuitsNeeded })}</Tag>
                        <Tag color="gold">{t('led.socapexNeeded', { count: evaluated.power.socapexNeeded })}</Tag>
                        <Tag>{t('led.panelsPerCircuit')}: {evaluated.power.panelsPerCircuit}</Tag>
                      </Space>
                    )}
                  </Space>
                </Col>

                <Col xs={24} lg={14}>
                  <LedSimulationScreen wall={wall} evaluated={evaluated} view={view} />
                </Col>
              </Row>
            </Card>
          );
        })}
      </Space>
    </>
  );
}
