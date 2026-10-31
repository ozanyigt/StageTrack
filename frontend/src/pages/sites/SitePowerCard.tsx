import { ThunderboltOutlined } from '@ant-design/icons';
import { Alert, Card, Flex, Select, Statistic, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sitePlanApi } from '../../api/endpoints';
import type { SitePlan, SitePowerLine } from '../../api/siteTypes';

const VOLTAGES = [110, 220, 230, 240];

/**
 * What the site draws. This is the part a drawing tool cannot do: the items on the plan are real equipment, so
 * their watts are the firm's own — placing another tower on a dark corner immediately says how many more 16 A
 * circuits somebody has to feed, which is the question the night view raises in the first place.
 */
export function SitePowerCard({ plan }: { plan: SitePlan }) {
  const { t } = useTranslation();
  const [voltage, setVoltage] = useState(220);

  const power = useQuery({
    queryKey: ['site-power', plan.id, voltage, plan.items.length, plan.items.map((i) => `${i.id}:${i.quantity}:${i.isLight}`).join(',')],
    queryFn: () => sitePlanApi.power(plan.id, voltage),
  });

  const data = power.data;

  return (
    <Card
      size="small"
      title={<span><ThunderboltOutlined /> {t('site.power')}</span>}
      extra={
        <Select
          size="small"
          value={voltage}
          onChange={setVoltage}
          options={VOLTAGES.map((v) => ({ value: v, label: `${v} V` }))}
        />
      }
      style={{ marginTop: 12 }}
      loading={power.isFetching && !data}
    >
      {!data || data.lines.length === 0 ? (
        <Typography.Text type="secondary">{t('site.noEquipmentYet')}</Typography.Text>
      ) : (
        <>
          <Flex gap={16} wrap style={{ marginBottom: 8 }}>
            <Statistic title={t('site.totalWatt')} value={Math.round(data.totalWatt)} suffix="W" valueStyle={{ fontSize: 16 }} />
            <Statistic title={t('site.circuits')} value={data.totalCircuits} valueStyle={{ fontSize: 16 }} />
            <Statistic title={t('site.weight')} value={Math.round(data.totalWeightKg)} suffix="kg" valueStyle={{ fontSize: 16 }} />
          </Flex>

          {data.lightingWatt > 0 && (
            <Tag color="gold" style={{ marginBottom: 8 }}>
              {t('site.lightingLoad', { watt: Math.round(data.lightingWatt), circuits: data.lightingCircuits })}
            </Tag>
          )}

          <Table
            size="small"
            rowKey="equipmentId"
            pagination={false}
            dataSource={data.lines}
            columns={[
              {
                title: t('equipment.code'),
                dataIndex: 'code',
                render: (code: string, l: SitePowerLine) => (l.isLight ? `💡 ${code}` : code),
              },
              { title: t('site.quantity'), dataIndex: 'count', width: 60, align: 'end' },
              { title: 'W', width: 80, align: 'end', render: (_: unknown, l: SitePowerLine) => Math.round(l.watt) },
              { title: t('site.circuits'), dataIndex: 'circuits', width: 70, align: 'end' },
            ]}
          />

          {data.missingWatt.length > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 8 }}
              message={t('site.missingWatt', { codes: data.missingWatt.join(', ') })}
            />
          )}
        </>
      )}
    </Card>
  );
}
