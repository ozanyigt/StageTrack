import { Alert, Card, Flex, InputNumber, Space, Statistic, Table, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Equipment } from '../../api/types';
import type { JobLine } from './useDraftJob';
import type { StageProp } from './stageProps';

interface Props {
  /** What the screens and their carriers weigh, kilograms; 0 when the screens stand on the ground. */
  flownScreenKg: number;
  /** Whether the screens hang at all. */
  flown: boolean;
  props: StageProp[];
  lines: JobLine[];
  equipmentById: Map<string, Equipment>;
}

/**
 * What hangs, and whether what it hangs from can take it. Every product already carries its weight; the one
 * thing that had to be added is what a product can carry - a truss section's point load, a hoist's rating -
 * because that is the number the venue's rigging officer asks for, and the one that gets a hang refused.
 *
 * The arithmetic is deliberately the simple kind a rigger does on the back of the rider: everything that hangs,
 * divided by the points it hangs from. A real bridle calculation needs angles and sling lengths nobody has
 * entered; pretending otherwise would be worse than saying plainly what this is.
 */
export function RiggingCard({ flownScreenKg, flown, props, lines, equipmentById }: Props) {
  const { t } = useTranslation();
  const [points, setPoints] = useState<number | null>(null);

  /** Everything hanging: the screens if they are flown, plus every group marked flown. */
  const hangingProps = useMemo(
    () =>
      props
        .filter((p) => p.flown)
        .map((prop) => {
          const line = lines.find((l) => l.id === prop.id);
          const item = line?.equipmentId ? equipmentById.get(line.equipmentId) : undefined;
          return { prop, line, item, kg: Number(item?.weightKg ?? 0) * (line?.count ?? 0) };
        }),
    [props, lines, equipmentById],
  );

  const propKg = hangingProps.reduce((sum, row) => sum + row.kg, 0);
  const totalKg = (flown ? flownScreenKg : 0) + propKg;

  /** The hoists in the draft: anything of the truss trade with a rating entered. */
  const hoists = useMemo(
    () =>
      lines
        .map((line) => ({ line, item: line.equipmentId ? equipmentById.get(line.equipmentId) : undefined }))
        .filter((row) => row.item?.capacityKg != null && Number(row.item.capacityKg) > 0)
        .map((row) => ({ ...row, capacity: Number(row.item!.capacityKg), count: row.line.count })),
    [lines, equipmentById],
  );

  const hoistCount = hoists.reduce((sum, row) => sum + row.count, 0);
  const usedPoints = points ?? (hoistCount > 0 ? hoistCount : 4);
  const perPoint = usedPoints > 0 ? totalKg / usedPoints : 0;
  const weakest = hoists.length > 0 ? Math.min(...hoists.map((h) => h.capacity)) : null;
  const overloaded = weakest !== null && perPoint > weakest;
  const capacityTotal = hoists.reduce((sum, row) => sum + row.capacity * row.count, 0);
  const shortOfCapacity = capacityTotal > 0 && totalKg > capacityTotal;

  return (
    <Card size="small" title={t('rigging.title')}>
      <Flex gap={24} wrap>
        <Statistic title={t('rigging.totalHanging')} value={Math.round(totalKg)} suffix="kg" valueStyle={{ fontSize: 18 }} />
        <Statistic
          title={t('rigging.perPoint')}
          value={Math.round(perPoint)}
          suffix="kg"
          valueStyle={{ fontSize: 18, color: overloaded ? '#dc2626' : undefined }}
        />
        <Space direction="vertical" size={0}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('rigging.points')}</Typography.Text>
          <InputNumber
            size="small"
            min={1}
            max={64}
            value={usedPoints}
            onChange={(value) => setPoints(value ?? 1)}
            style={{ width: 90 }}
          />
        </Space>
      </Flex>

      {totalKg > 0 && hoists.length === 0 && (
        <Alert type="warning" showIcon style={{ marginTop: 10 }} message={t('rigging.noHoists')} description={t('rigging.noHoistsHint')} />
      )}

      {overloaded && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 10 }}
          message={t('rigging.overPoint', { load: Math.round(perPoint), capacity: Math.round(weakest!) })}
        />
      )}

      {shortOfCapacity && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 10 }}
          message={t('rigging.overTotal', { load: Math.round(totalKg), capacity: Math.round(capacityTotal) })}
        />
      )}

      {hoists.length > 0 && (
        <Table
          size="small"
          rowKey={(row) => row.line.id}
          style={{ marginTop: 10 }}
          pagination={false}
          dataSource={hoists}
          columns={[
            { title: t('draft.groupName'), render: (_: unknown, row: (typeof hoists)[number]) => row.line.name },
            { title: t('draft.product'), render: (_: unknown, row: (typeof hoists)[number]) => row.item?.code ?? '—' },
            { title: t('draft.count'), align: 'end', width: 70, render: (_: unknown, row: (typeof hoists)[number]) => row.count },
            {
              title: t('equipment.capacityKg'),
              align: 'end',
              width: 110,
              render: (_: unknown, row: (typeof hoists)[number]) =>
                perPoint > row.capacity ? <Tag color="red">{Math.round(row.capacity)}</Tag> : Math.round(row.capacity),
            },
          ]}
        />
      )}

      {hangingProps.length > 0 && (
        <Table
          size="small"
          rowKey={(row) => row.prop.id}
          style={{ marginTop: 10 }}
          pagination={false}
          dataSource={hangingProps}
          columns={[
            { title: t('rigging.hanging'), render: (_: unknown, row: (typeof hangingProps)[number]) => row.prop.label },
            { title: t('draft.count'), align: 'end', width: 70, render: (_: unknown, row: (typeof hangingProps)[number]) => row.line?.count ?? 0 },
            {
              title: t('rigging.weight'),
              align: 'end',
              width: 110,
              render: (_: unknown, row: (typeof hangingProps)[number]) =>
                row.item?.weightKg == null ? <Typography.Text type="secondary">{t('rigging.noWeight')}</Typography.Text> : `${Math.round(row.kg)} kg`,
            },
          ]}
        />
      )}

      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
        {t('rigging.hint')}
      </Typography.Paragraph>
    </Card>
  );
}
