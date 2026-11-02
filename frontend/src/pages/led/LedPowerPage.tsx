import { Alert, Card, Col, Empty, Flex, Row, Statistic, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ledApi } from '../../api/endpoints';
import type { DistributionDto, PhaseDto } from '../../api/ledTypes';
import { equipmentApi } from '../../api/endpoints';
import type { EquipmentDiscipline } from '../../api/types';
import { useLedJob, type JobLine } from './useLedJob';

/** What one trade comes to once its lines are added up. */
interface TradeRow {
  trade: EquipmentDiscipline;
  count: number;
  watt: number;
  currentA: number;
  circuits: number;
  weightKg: number;
}

/**
 * What the whole job draws - every trade, not only the screens. The LED side comes from the screen calculation
 * (circuits per screen, phases, distribution); the other trades come from their lines through the same
 * equipment-power maths, so a fixture costs the same here as it does anywhere else. Nothing is edited here:
 * this page reports what the five design screens decided.
 */
export function LedPowerPage() {
  const { t } = useTranslation();
  const { job, evaluation, panelById } = useLedJob();
  const settings = useQuery({ queryKey: ['led-settings'], queryFn: () => ledApi.settings() });
  const processors = useQuery({ queryKey: ['led-inventory', 'Processor', undefined], queryFn: () => ledApi.processors() });
  const extenders = useQuery({ queryKey: ['led-inventory', 'Extender', undefined], queryFn: () => ledApi.extenders() });

  const result = evaluation.data;
  const power = result?.job.power;

  // The other trades: their lines, through the server's own equipment-power calculation.
  const lines = job.lines.filter((l) => l.equipmentId);
  const equipmentPower = useQuery({
    queryKey: ['equipment-power', job.voltage, job.mode, lines],
    queryFn: () =>
      ledApi.equipmentPower({
        voltage: job.voltage,
        mode: job.mode,
        lines: lines.map((l) => ({ id: l.id, equipmentId: l.equipmentId, count: l.count })),
      }),
    enabled: lines.length > 0,
  });

  const catalogue = useQuery({
    queryKey: ['equipment', 'for-power'],
    queryFn: () => equipmentApi.list({ maxResultCount: 1000, sorting: 'code' }),
    enabled: lines.length > 0,
  });
  const nameOfEquipment = (id: string | null) => catalogue.data?.items.find((e) => e.id === id)?.code ?? '-';

  /** One row per trade, so the person feeding the site sees where the load is. */
  const byTrade = lines.reduce((map, line) => {
    const row = equipmentPower.data?.lines.find((r) => r.id === line.id);
    const current = map.get(line.discipline) ?? { watt: 0, currentA: 0, circuits: 0, weightKg: 0, count: 0 };
    map.set(line.discipline, {
      watt: current.watt + (row?.watt ?? 0),
      currentA: current.currentA + (row?.currentA ?? 0),
      circuits: current.circuits + (row?.circuits ?? 0),
      weightKg: current.weightKg + (row?.weightKg ?? 0),
      count: current.count + line.count,
    });
    return map;
  }, new Map<EquipmentDiscipline, { watt: number; currentA: number; circuits: number; weightKg: number; count: number }>());

  const tradeTotals = equipmentPower.data?.total;
  const grandWatt = (power?.totalWattMax ?? 0) + (tradeTotals?.watt ?? 0);
  const grandCircuits = (power?.totalCircuits ?? 0) + (tradeTotals?.circuits ?? 0);
  const deviceName = (id: string) =>
    [...(processors.data ?? []), ...(extenders.data ?? [])].find((d) => d.equipmentId === id)?.code ?? id;

  if (job.screens.length === 0 && lines.length === 0) {
    return (
      <>
        <Typography.Title level={3} style={{ marginTop: 0 }}>{t('draft.totalPowerTitle')}</Typography.Title>
        <Card><Empty description={t('draft.nothingForPower')} /></Card>
      </>
    );
  }

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>{t('draft.totalPowerTitle')}</Typography.Title>

      <Card size="small" style={{ marginBottom: 12 }} loading={evaluation.isFetching || equipmentPower.isFetching}>
        <Flex gap={32} wrap>
          <Statistic title={t('draft.grandWatt')} value={Math.round(grandWatt)} suffix="W" />
          <Statistic title={t('draft.grandCircuits')} value={grandCircuits} />
          <Statistic title={t('draft.ledShare')} value={Math.round(power?.totalWattMax ?? 0)} suffix="W" />
          <Statistic title={t('draft.tradeShare')} value={Math.round(tradeTotals?.watt ?? 0)} suffix="W" />
          <Statistic title={t('draft.tradeWeight')} value={Math.round(tradeTotals?.weightKg ?? 0)} suffix="kg" />
        </Flex>
      </Card>

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

        {lines.length > 0 && (
          <Col xs={24}>
            <Card size="small" title={t('draft.perTrade')} loading={equipmentPower.isFetching}>
              <Table
                size="small"
                rowKey="trade"
                pagination={false}
                dataSource={[...byTrade.entries()].map(([trade, row]) => ({ trade, ...row }))}
                columns={[
                  { title: t('draft.trade'), dataIndex: 'trade', render: (d: EquipmentDiscipline) => t(`enums.equipmentDiscipline.${d}`) },
                  { title: t('draft.count'), dataIndex: 'count', align: 'end', width: 100 },
                  { title: t('led.watt'), align: 'end', width: 120, render: (_: unknown, r: TradeRow) => Math.round(r.watt).toLocaleString() },
                  { title: t('led.current'), align: 'end', width: 110, render: (_: unknown, r: TradeRow) => `${r.currentA.toFixed(1)} A` },
                  { title: t('led.circuits'), dataIndex: 'circuits', align: 'end', width: 100 },
                  { title: t('draft.totalWeight'), align: 'end', width: 120, render: (_: unknown, r: TradeRow) => `${Math.round(r.weightKg)} kg` },
                ]}
              />
              <Table
                size="small"
                rowKey="id"
                style={{ marginTop: 12 }}
                pagination={false}
                dataSource={lines}
                columns={[
                  { title: t('draft.groupName'), dataIndex: 'name' },
                  { title: t('draft.product'), render: (_: unknown, l: JobLine) => nameOfEquipment(l.equipmentId) },
                  { title: t('draft.count'), dataIndex: 'count', align: 'end', width: 90 },
                  {
                    title: t('led.watt'),
                    align: 'end',
                    width: 120,
                    render: (_: unknown, l: JobLine) => {
                      const row = equipmentPower.data?.lines.find((r) => r.id === l.id);
                      // "found: false" is the server saying it has no power for this product, not that it draws none.
                      return row?.found ? Math.round(row.watt).toLocaleString() : <Typography.Text type="secondary">{t('draft.noPower')}</Typography.Text>;
                    },
                  },
                  {
                    title: t('led.circuits'),
                    align: 'end',
                    width: 100,
                    render: (_: unknown, l: JobLine) => equipmentPower.data?.lines.find((r) => r.id === l.id)?.circuits ?? '-',
                  },
                ]}
              />
            </Card>
          </Col>
        )}

        {job.screens.length > 0 && (
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
        )}
      </Row>
    </>
  );
}
