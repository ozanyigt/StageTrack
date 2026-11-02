import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Flex, Input, InputNumber, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { equipmentApi } from '../../api/endpoints';
import type { EquipmentDiscipline } from '../../api/types';
import type { JobLine } from '../led/useLedJob';

interface Props {
  discipline: EquipmentDiscipline;
  lines: JobLine[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<JobLine>) => void;
  onRemove: (id: string) => void;
}

/**
 * Design for a trade that is chosen rather than drawn. A LED wall has a shape - so many panels wide, so many
 * high - and the server works the rest out. A speaker stack, a lighting rig, a truss order or a deck does not:
 * what the job needs is which product and how many. So this is a list, and what it feeds is everything else -
 * the total power, the stock check, the 3D scene and the lines that reach the quote.
 */
export function DisciplineDesign({ discipline, lines, onAdd, onChange, onRemove }: Props) {
  const { t } = useTranslation();

  // Only the trade's own products: the folder tree decides what belongs here, so a firm sees its own catalogue.
  const equipment = useQuery({
    queryKey: ['equipment', 'by-discipline', discipline],
    queryFn: () => equipmentApi.list({ discipline, maxResultCount: 500, sorting: 'code' }),
  });

  const byId = useMemo(() => new Map((equipment.data?.items ?? []).map((e) => [e.id, e])), [equipment.data]);
  const options = (equipment.data?.items ?? []).map((e) => ({ value: e.id, label: `${e.code} · ${e.name}` }));

  const totals = lines.reduce(
    (sum, line) => {
      const item = line.equipmentId ? byId.get(line.equipmentId) : undefined;
      return {
        count: sum.count + line.count,
        watt: sum.watt + Number(item?.powerW ?? 0) * line.count,
        weight: sum.weight + Number(item?.weightKg ?? 0) * line.count,
        short: sum.short + (item && line.count > item.stock ? 1 : 0),
      };
    },
    { count: 0, watt: 0, weight: 0, short: 0 },
  );

  const noneInInventory = !equipment.isLoading && (equipment.data?.items.length ?? 0) === 0;

  return (
    <>
      {noneInInventory && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={t('draft.noTradeEquipment', { trade: t(`enums.equipmentDiscipline.${discipline}`) })}
          description={t('draft.noTradeEquipmentHint')}
        />
      )}

      <Card
        size="small"
        title={
          <Space>
            {t('draft.groups')}
            <Typography.Text type="secondary">{t('draft.groupsHint')}</Typography.Text>
          </Space>
        }
        extra={
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onAdd} disabled={noneInInventory}>
            {t('draft.addGroup')}
          </Button>
        }
      >
        {lines.length === 0 ? (
          <Empty description={t('draft.noGroups')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            size="small"
            rowKey="id"
            dataSource={lines}
            pagination={false}
            loading={equipment.isLoading}
            columns={[
              {
                title: t('draft.groupName'),
                width: 180,
                render: (_: unknown, line: JobLine) => (
                  <Input
                    size="small"
                    value={line.name}
                    maxLength={80}
                    onChange={(e) => onChange(line.id, { name: e.target.value })}
                  />
                ),
              },
              {
                title: t('draft.product'),
                render: (_: unknown, line: JobLine) => (
                  <Select
                    size="small"
                    showSearch
                    optionFilterProp="label"
                    style={{ width: '100%', minWidth: 220 }}
                    placeholder={t('draft.pickProduct')}
                    value={line.equipmentId ?? undefined}
                    onChange={(value) => onChange(line.id, { equipmentId: value })}
                    options={options}
                  />
                ),
              },
              {
                title: t('draft.count'),
                width: 100,
                render: (_: unknown, line: JobLine) => (
                  <InputNumber
                    size="small"
                    min={1}
                    max={100000}
                    value={line.count}
                    style={{ width: '100%' }}
                    onChange={(value) => onChange(line.id, { count: Math.max(1, Math.round(value ?? 1)) })}
                  />
                ),
              },
              {
                title: t('draft.stock'),
                width: 90,
                align: 'end',
                render: (_: unknown, line: JobLine) => {
                  const item = line.equipmentId ? byId.get(line.equipmentId) : undefined;
                  if (!item) return <Typography.Text type="secondary">—</Typography.Text>;
                  return line.count > item.stock ? <Tag color="orange">{item.stock}</Tag> : item.stock;
                },
              },
              {
                title: t('draft.power'),
                width: 110,
                align: 'end',
                render: (_: unknown, line: JobLine) => {
                  const item = line.equipmentId ? byId.get(line.equipmentId) : undefined;
                  // Power the firm never entered is not zero, it is unknown; saying so beats a quietly short total.
                  if (!item) return <Typography.Text type="secondary">—</Typography.Text>;
                  return item.powerW == null ? (
                    <Typography.Text type="secondary">{t('draft.noPower')}</Typography.Text>
                  ) : (
                    `${(Number(item.powerW) * line.count).toLocaleString()} W`
                  );
                },
              },
              {
                width: 44,
                render: (_: unknown, line: JobLine) => (
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onRemove(line.id)} />
                ),
              },
            ]}
          />
        )}
      </Card>

      {lines.length > 0 && (
        <Card size="small" style={{ marginTop: 12 }}>
          <Flex gap={32} wrap>
            <Statistic title={t('draft.totalCount')} value={totals.count} />
            <Statistic title={t('draft.totalPower')} value={Math.round(totals.watt)} suffix="W" />
            <Statistic title={t('draft.totalWeight')} value={Math.round(totals.weight)} suffix="kg" />
            {totals.short > 0 && (
              <Statistic
                title={t('draft.shortLines')}
                value={totals.short}
                valueStyle={{ color: '#d46b08' }}
              />
            )}
          </Flex>
        </Card>
      )}
    </>
  );
}
