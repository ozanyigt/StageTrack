import { CheckCircleFilled } from '@ant-design/icons';
import { Alert, Badge, Card, Col, Empty, Flex, Progress, Row, Space, Statistic, Tag, Typography, theme } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ledApi } from '../../api/endpoints';
import type { ProcessorOptionDto } from '../../api/ledTypes';
import { useLedJob } from './useLedJob';

/**
 * Processor and extender choice. The server works out every combination that can drive a screen; this is where
 * the user picks one per screen, and the job total follows that pick — which is also what the transfer to a job
 * plans, so what is chosen here is what gets reserved and quoted.
 */
export function LedProcessorPage() {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { job, walls, nameOf, evaluation, update } = useLedJob();

  const processors = useQuery({ queryKey: ['led-inventory', 'Processor', undefined], queryFn: () => ledApi.processors() });
  const extenders = useQuery({ queryKey: ['led-inventory', 'Extender', undefined], queryFn: () => ledApi.extenders() });

  const deviceById = useMemo(() => {
    const map = new Map<string, { code: string; name: string; stock: number }>();
    for (const d of [...(processors.data ?? []), ...(extenders.data ?? [])]) {
      map.set(d.equipmentId, { code: d.code, name: d.name, stock: d.stock });
    }
    return map;
  }, [processors.data, extenders.data]);

  const result = evaluation.data;
  const label = (id?: string | null) => (id ? deviceById.get(id)?.code ?? id : null);

  if (job.screens.length === 0) {
    return (
      <>
        <Typography.Title level={3} style={{ marginTop: 0 }}>{t('led.processorTitle')}</Typography.Title>
        <Card><Empty description={t('led.noScreensForProcessor')} /></Card>
      </>
    );
  }

  /** One option as a card; the chosen one is outlined and feeds the job total. */
  const optionCard = (screenId: string, option: ProcessorOptionDto, index: number, selected: boolean) => {
    const processor = deviceById.get(option.processorId);
    const extender = option.extenderId ? deviceById.get(option.extenderId) : null;
    const shortProcessors = processor ? processor.stock < option.units : false;
    const shortExtenders = extender && option.extenderUnits > 0 ? extender.stock < option.extenderUnits : false;

    return (
      <Col key={`${option.processorId}-${index}`} xs={24} md={12}>
        <Card
          size="small"
          hoverable
          onClick={() => update(screenId, { selectedOption: index })}
          style={{
            borderColor: selected ? token.colorPrimary : undefined,
            boxShadow: selected ? `0 0 0 1px ${token.colorPrimary}` : undefined,
          }}
        >
          <Flex justify="space-between" align="start" gap={8}>
            <div style={{ minWidth: 0 }}>
              <Typography.Text strong>{processor?.code ?? option.processorId}</Typography.Text>
              <Typography.Text type="secondary"> × {option.units}</Typography.Text>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{processor?.name}</Typography.Text>
              </div>
              {extender ? (
                <div style={{ marginTop: 4 }}>
                  <Typography.Text>{extender.code}</Typography.Text>
                  <Typography.Text type="secondary"> × {option.extenderUnits}</Typography.Text>
                </div>
              ) : (
                <Tag style={{ marginTop: 6 }}>{t('led.directConnection')}</Tag>
              )}
            </div>
            {selected && <CheckCircleFilled style={{ color: token.colorPrimary, fontSize: 18 }} />}
          </Flex>

          <Progress
            percent={Math.min(100, Math.round(option.utilizationPercent))}
            size="small"
            style={{ marginTop: 8, marginBottom: 0 }}
            format={() => `${option.utilizationPercent.toFixed(0)}%`}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('led.pixelsUsed', { used: option.pixelsUsed.toLocaleString(), capacity: option.pixelsCapacity.toLocaleString() })}
          </Typography.Text>

          {(shortProcessors || shortExtenders) && (
            <div style={{ marginTop: 6 }}>
              <Tag color="orange">{t('led.notEnoughStock')}</Tag>
            </div>
          )}
        </Card>
      </Col>
    );
  };

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('led.processorTitle')}</Typography.Title>
        {result?.job.processor && (
          <Space size="large" wrap>
            <Statistic title={t('led.totalPixels')} value={result.job.processor.totalPixels.toLocaleString()} valueStyle={{ fontSize: 18 }} />
            <Statistic title={t('led.processors')} value={result.job.processor.totalProcessors} valueStyle={{ fontSize: 18 }} />
            <Statistic title={t('led.extenders')} value={result.job.processor.totalExtenders} valueStyle={{ fontSize: 18 }} />
          </Space>
        )}
      </div>

      {result?.job.processor.infeasibleScreenCount ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={t('led.infeasibleScreens', { count: result.job.processor.infeasibleScreenCount })}
          description={t('led.infeasibleHint')}
        />
      ) : null}

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {job.screens.map((screen, index) => {
          const evaluated = result?.screens.find((s) => s.id === screen.id);
          const options = evaluated?.processor?.options ?? [];
          const selectedIndex = evaluated?.processor?.selectedIndex ?? 0;
          const wall = walls[index];

          return (
            <Card
              key={screen.id}
              size="small"
              loading={evaluation.isFetching && !evaluated}
              title={
                <Space>
                  <span>{screen.name ?? nameOf(wall)}</span>
                  {evaluated?.power && (
                    <Typography.Text type="secondary">
                      {evaluated.power.resolutionX} × {evaluated.power.resolutionY} px
                    </Typography.Text>
                  )}
                </Space>
              }
              extra={options.length > 0 && <Badge count={t('led.optionCount', { count: options.length })} color={token.colorFillSecondary} />}
            >
              {options.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={wall?.panel ? t('led.noProcessorOption') : t('led.pickPanelFirst')}
                />
              ) : (
                <Row gutter={[12, 12]}>{options.map((o, i) => optionCard(screen.id, o, i, i === selectedIndex))}</Row>
              )}
            </Card>
          );
        })}
      </Space>

      {result?.job.processor && (result.job.processor.processors.length > 0 || result.job.processor.extenders.length > 0) && (
        <Card size="small" title={t('led.jobTotals')} style={{ marginTop: 12 }}>
          <Flex gap={8} wrap>
            {result.job.processor.processors.map((p) => (
              <Tag key={p.id} color="geekblue">{label(p.id)} × {p.count}</Tag>
            ))}
            {result.job.processor.extenders.map((e) => (
              <Tag key={e.id} color="cyan">{label(e.id)} × {e.count}</Tag>
            ))}
          </Flex>
        </Card>
      )}
    </>
  );
}
