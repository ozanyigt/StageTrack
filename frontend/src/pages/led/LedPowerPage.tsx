import { Alert, Card, Col, Empty, Flex, Row, Statistic, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ledApi } from '../../api/endpoints';
import type { DistributionDto, PhaseDto } from '../../api/ledTypes';
import { useLedJob } from './useLedJob';

/**
 * Power and processors for the whole job: the circuits each screen needs, how they fall on the three phases,
 * which distribution boxes cover the load, and the processors and extenders the calculation chose.
 * Screens are edited on the design page; this one only reports.
 */
export function LedPowerPage() {
  const { t } = useTranslation();
  const { job, evaluation, panelById } = useLedJob();
  const settings = useQuery({ queryKey: ['led-settings'], queryFn: () => ledApi.settings() });
  const processors = useQuery({ queryKey: ['led-inventory', 'Processor', undefined], queryFn: () => ledApi.processors() });
  const extenders = useQuery({ queryKey: ['led-inventory', 'Extender', undefined], queryFn: () => ledApi.extenders() });

  const result = evaluation.data;
  const power = result?.job.power;
  const deviceName = (id: string) =>
    [...(processors.data ?? []), ...(extenders.data ?? [])].find((d) => d.equipmentId === id)?.code ?? id;

  if (job.screens.length === 0) {
    return (
      <>
        <Typography.Title level={3} style={{ marginTop: 0 }}>{t('led.powerTitle')}</Typography.Title>
        <Card><Empty description={t('led.noScreensForPower')} /></Card>
      </>
    );
  }

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>{t('led.powerTitle')}</Typography.Title>

      {settings.data && (
        <Typography.Paragraph type="secondary">
          {t('led.constants', {
            fuse: settings.data.fuseAmpere,
            derating: settings.data.deratingPercent,
            perSocapex: settings.data.circuitsPerSocapex,
            factor: settings.data.powerFactor,
          })}
        </Typography.Paragraph>
      )}

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card size="small" title={t('led.jobTotals')} loading={evaluation.isFetching}>
            {power ? (
              <Flex gap={24} wrap>
                <Statistic title={t('led.wattMax')} value={Math.round(power.totalWattMax)} suffix="W" />
                <Statistic title={t('led.wattAvg')} value={Math.round(power.totalWattAvg)} suffix="W" />
                <Statistic title={t('led.current')} value={power.totalCurrentA.toFixed(1)} suffix="A" />
                <Statistic title={t('led.circuits')} value={power.totalCircuits} />
                <Statistic title={t('led.socapex')} value={power.totalSocapex} />
                <Statistic title={t('led.perPhase')} value={power.perPhaseMaxA.toFixed(1)} suffix="A" />
              </Flex>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('led.noPanelsOnScreens')} />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card size="small" title={t('led.phases')} loading={evaluation.isFetching}>
            {power?.phases.length ? (
              <Table
                size="small"
                rowKey="phase"
                pagination={false}
                dataSource={power.phases}
                columns={[
                  { title: t('led.phase'), dataIndex: 'phase', width: 80 },
                  { title: t('led.circuits'), width: 100, align: 'end', render: (_: unknown, p: PhaseDto) => p.circuits.length },
                  { title: t('led.current'), width: 120, align: 'end', render: (_: unknown, p: PhaseDto) => `${p.totalCurrentA.toFixed(1)} A` },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card size="small" title={t('led.distribution')} loading={evaluation.isFetching}>
            {power?.distribution.length ? (
              <Flex gap={8} wrap>
                {power.distribution.map((d: DistributionDto) => (
                  <Tag key={d.optionId} color={d.unitsNeeded > 0 ? 'blue' : undefined}>
                    {d.optionId.toUpperCase()} · {d.ampsPerPhase} A → {t('led.units', { count: d.unitsNeeded })}
                  </Tag>
                ))}
              </Flex>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card size="small" title={t('led.processorsAndExtenders')} loading={evaluation.isFetching}>
            {result?.job.processor ? (
              <>
                <Flex gap={24} wrap style={{ marginBottom: 12 }}>
                  <Statistic title={t('led.totalPixels')} value={result.job.processor.totalPixels.toLocaleString()} />
                  <Statistic title={t('led.processors')} value={result.job.processor.totalProcessors} />
                  <Statistic title={t('led.extenders')} value={result.job.processor.totalExtenders} />
                </Flex>
                <Flex gap={8} wrap>
                  {result.job.processor.processors.map((p) => (
                    <Tag key={p.id} color="geekblue">{deviceName(p.id)} × {p.count}</Tag>
                  ))}
                  {result.job.processor.extenders.map((e) => (
                    <Tag key={e.id} color="cyan">{deviceName(e.id)} × {e.count}</Tag>
                  ))}
                </Flex>
                {result.job.processor.infeasibleScreenCount > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 12 }}
                    message={t('led.infeasibleScreens', { count: result.job.processor.infeasibleScreenCount })}
                  />
                )}
              </>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>

        <Col xs={24}>
          <Card size="small" title={t('led.perScreen')} loading={evaluation.isFetching}>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              scroll={{ x: 'max-content' }}
              dataSource={result?.screens ?? []}
              columns={[
                {
                  title: t('led.screen'),
                  render: (_: unknown, s) => job.screens.find((x) => x.id === s.id)?.name ?? s.id,
                },
                {
                  title: t('led.panel'),
                  render: (_: unknown, s) => {
                    const id = job.screens.find((x) => x.id === s.id)?.panelId;
                    return id ? panelById.get(id)?.code ?? '—' : '—';
                  },
                },
                { title: t('led.panelCountShort'), align: 'end', render: (_: unknown, s) => s.power?.panelCount ?? '—' },
                { title: t('led.watt'), align: 'end', render: (_: unknown, s) => (s.power ? Math.round(s.power.totalWattMax) : '—') },
                {
                  title: t('led.panelsPerCircuit'),
                  align: 'end',
                  render: (_: unknown, s) =>
                    s.power ? (
                      <>
                        {s.power.panelsPerCircuit}
                        <Typography.Text type="secondary"> · {t(`enums.linkSource.${s.power.panelsPerCircuitSource}`)}</Typography.Text>
                      </>
                    ) : '—',
                },
                { title: t('led.circuits'), align: 'end', render: (_: unknown, s) => s.power?.circuitsNeeded ?? '—' },
                { title: t('led.socapex'), align: 'end', render: (_: unknown, s) => s.power?.socapexNeeded ?? '—' },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
