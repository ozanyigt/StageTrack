import { Card, Empty, Segmented, Statistic, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { equipmentApi } from '../../api/endpoints';
import { EQUIPMENT_DISCIPLINES, type Equipment, type EquipmentDiscipline } from '../../api/types';
import { LedStockBody } from '../led/LedStockStatusPage';
import { useLedJob, type JobLine } from '../led/useLedJob';

/**
 * What the firm owns against what this job takes, one trade at a time. Mixing five trades in one list is how a
 * planner loses a missing sub among four hundred truss couplers, so each has its own tab - LED keeps the
 * screen-by-screen count it always had, and the others count their lines.
 */
export function StockStatusPage() {
  const { t } = useTranslation();
  const { job } = useLedJob();
  const [trade, setTrade] = useState<EquipmentDiscipline>('Led');

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3} style={{ margin: 0 }}>{t('led.stockTitle')}</Typography.Title>
        <Segmented
          value={trade}
          onChange={(value) => setTrade(value as EquipmentDiscipline)}
          options={EQUIPMENT_DISCIPLINES.map((d) => ({ value: d, label: t(`enums.equipmentDiscipline.${d}`) }))}
        />
      </div>

      {trade === 'Led' ? <LedStockBody /> : <TradeStock discipline={trade} lines={job.lines.filter((l) => l.discipline === trade)} />}
    </>
  );
}

/**
 * The trade's whole inventory with what the job takes subtracted - the firm wants to see everything it owns
 * here, not only what happens to be on this job, because the question being asked is "what is left".
 */
function TradeStock({ discipline, lines }: { discipline: EquipmentDiscipline; lines: JobLine[] }) {
  const { t } = useTranslation();

  const equipment = useQuery({
    queryKey: ['equipment', 'by-discipline', discipline],
    queryFn: () => equipmentApi.list({ discipline, maxResultCount: 500, sorting: 'code' }),
  });

  const used = new Map<string, number>();
  for (const line of lines) {
    if (line.equipmentId) used.set(line.equipmentId, (used.get(line.equipmentId) ?? 0) + line.count);
  }

  const items = equipment.data?.items ?? [];
  const totals = items.reduce(
    (sum, item) => {
      const take = used.get(item.id) ?? 0;
      return { owned: sum.owned + item.stock, used: sum.used + take, short: sum.short + Math.max(0, take - item.stock) };
    },
    { owned: 0, used: 0, short: 0 },
  );

  if (!equipment.isLoading && items.length === 0) {
    return <Card><Empty description={t('draft.noTradeEquipment', { trade: t(`enums.equipmentDiscipline.${discipline}`) })} /></Card>;
  }

  return (
    <Card size="small" loading={equipment.isLoading}>
      <div className="page-header">
        <Statistic title={t('led.owned')} value={totals.owned} valueStyle={{ fontSize: 18 }} />
        <Statistic title={t('led.usedByJob')} value={totals.used} valueStyle={{ fontSize: 18 }} />
        <Statistic
          title={t('led.shortage')}
          value={totals.short}
          valueStyle={{ fontSize: 18, color: totals.short > 0 ? '#ff4d4f' : undefined }}
        />
      </div>

      <Table
        size="small"
        rowKey="id"
        pagination={false}
        scroll={{ x: 'max-content' }}
        dataSource={items}
        columns={[
          { title: t('equipment.code'), dataIndex: 'code', width: 130 },
          { title: t('equipment.name'), dataIndex: 'name' },
          { title: t('equipment.folder'), dataIndex: 'folderName', width: 160 },
          { title: t('led.owned'), dataIndex: 'stock', width: 90, align: 'end' },
          {
            title: t('led.usedByJob'),
            width: 110,
            align: 'end',
            render: (_: unknown, item: Equipment) => used.get(item.id) ?? 0,
          },
          {
            title: t('led.remaining'),
            width: 110,
            align: 'end',
            render: (_: unknown, item: Equipment) => {
              const left = item.stock - (used.get(item.id) ?? 0);
              return left < 0 ? <Tag color="red">{left}</Tag> : <span>{left}</span>;
            },
          },
        ]}
      />
    </Card>
  );
}
