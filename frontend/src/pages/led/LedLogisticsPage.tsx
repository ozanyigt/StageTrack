import { Alert, Card, Col, Empty, Flex, InputNumber, Row, Select, Space, Table, Tag, Typography, theme } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ledApi } from '../../api/endpoints';
import type { PlanStackDto, TransportGroupDto, TransportVehicle } from '../../api/ledTypes';
import { useErrorToast } from '../../utils/errors';
import { useLedJob } from './useLedJob';

/**
 * The loading plan: the job's cases, which vehicles they fit in and where they stand on the floor.
 * The placement comes from the server; this draws it from above — x along the vehicle's length from the cab,
 * y across its width.
 */
export function LedLogisticsPage() {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const { job, request } = useLedJob();
  const [vehicleId, setVehicleId] = useState<string>();

  const vehicles = useQuery({ queryKey: ['led-vehicles'], queryFn: () => ledApi.vehicles() });

  const plan = useQuery({
    queryKey: ['led-plan', request.screens, vehicleId],
    queryFn: () => ledApi.plan({ screens: request.screens, vehicleId: vehicleId ?? null }),
    enabled: job.screens.length > 0,
  });

  const saveGap = useMutation({
    mutationFn: (gapMm: number) => ledApi.saveVehicles(vehicles.data?.vehicles ?? [], gapMm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['led-vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['led-plan'] });
    },
    onError: showError,
  });

  const typeById = useMemo(
    () => new Map((plan.data?.vehicleTypes ?? []).map((v: TransportVehicle) => [v.id, v])),
    [plan.data],
  );
  const colorOf = (equipmentId: string) => {
    const index = (plan.data?.groups ?? []).findIndex((g) => g.equipmentId === equipmentId);
    const palette = ['#4f46e5', '#0d9488', '#d97706', '#be123c', '#7c3aed', '#0369a1'];
    return palette[(index < 0 ? 0 : index) % palette.length];
  };

  if (job.screens.length === 0) {
    return (
      <>
        <Typography.Title level={3} style={{ marginTop: 0 }}>{t('led.logisticsTitle')}</Typography.Title>
        <Card><Empty description={t('led.noScreensForPlan')} /></Card>
      </>
    );
  }

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>{t('led.logisticsTitle')}</Typography.Title>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Flex gap={16} wrap align="center">
          <Space>
            <Typography.Text type="secondary">{t('led.vehicle')}</Typography.Text>
            <Select
              allowClear
              style={{ minWidth: 200 }}
              placeholder={t('led.vehicleAuto')}
              value={vehicleId}
              loading={vehicles.isFetching}
              onChange={setVehicleId}
              options={(vehicles.data?.vehicles ?? []).map((v) => ({
                value: v.id,
                label: `${v.name} · ${(v.lengthMm / 1000).toFixed(2)} × ${(v.widthMm / 1000).toFixed(2)} m`,
              }))}
            />
          </Space>
          <Space>
            <Typography.Text type="secondary">{t('led.gap')}</Typography.Text>
            <InputNumber
              min={0}
              max={1000}
              value={vehicles.data?.gapMm}
              onChange={(v) => v != null && saveGap.mutate(v)}
              addonAfter="mm"
              style={{ width: 130 }}
            />
          </Space>
          {plan.data && (
            <Space style={{ marginInlineStart: 'auto' }}>
              <Tag color="blue">{t('led.vehiclesNeeded', { count: plan.data.vehicles.length })}</Tag>
              {plan.data.unplaced.length > 0 && <Tag color="red">{t('led.unplaced', { count: plan.data.unplaced.length })}</Tag>}
            </Space>
          )}
        </Flex>
      </Card>

      {plan.data?.missing.length ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={t('led.missingCaseData')}
          description={plan.data.missing.map((m) => `${m.code} · ${m.name} (${m.fields.map((f) => t(`led.field.${f}`)).join(', ')})`).join(' · ')}
        />
      ) : null}

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={10}>
          <Card size="small" title={t('led.cases')} loading={plan.isFetching}>
            <Table
              size="small"
              rowKey="equipmentId"
              pagination={false}
              dataSource={plan.data?.groups ?? []}
              columns={[
                {
                  title: '',
                  width: 24,
                  render: (_: unknown, g: TransportGroupDto) => (
                    <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: colorOf(g.equipmentId) }} />
                  ),
                },
                { title: t('equipment.code'), dataIndex: 'code', width: 110 },
                { title: t('led.pieces'), dataIndex: 'panels', width: 80, align: 'end' },
                {
                  title: t('led.cases'),
                  width: 120,
                  align: 'end',
                  render: (_: unknown, g: TransportGroupDto) => `${g.cases} × ${t(`enums.ledTransportKind.${g.kind}`)}`,
                },
                {
                  title: t('led.caseSize'),
                  render: (_: unknown, g: TransportGroupDto) => `${g.heightCm}×${g.widthCm}×${g.depthCm} cm`,
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card size="small" title={t('led.loadingPlan')} loading={plan.isFetching}>
            {plan.data?.vehicles.length ? (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                {plan.data.vehicles.map((vehicle, index) => {
                  const type = typeById.get(vehicle.typeId);
                  if (!type) return null;
                  const lengthCm = type.lengthMm / 10;
                  const widthCm = type.widthMm / 10;
                  const scale = 560 / lengthCm;

                  return (
                    <div key={index}>
                      <Typography.Text strong>
                        {t('led.vehicleNo', { index: index + 1 })} · {type.name}
                      </Typography.Text>
                      <svg
                        width="100%"
                        viewBox={`0 0 ${lengthCm * scale} ${widthCm * scale}`}
                        style={{ background: token.colorFillQuaternary, borderRadius: 6, marginTop: 6, maxHeight: 220 }}
                        role="img"
                      >
                        <rect x={0} y={0} width={lengthCm * scale} height={widthCm * scale} fill="none" stroke={token.colorBorder} />
                        {vehicle.stacks.map((stack: PlanStackDto) => {
                          const group = plan.data.groups.find((g) => g.equipmentId === stack.equipmentId);
                          if (!group) return null;
                          const w = (stack.rotated ? group.widthCm : group.depthCm) * scale;
                          const h = (stack.rotated ? group.depthCm : group.widthCm) * scale;
                          return (
                            <g key={stack.id}>
                              <rect
                                x={stack.x * scale}
                                y={stack.y * scale}
                                width={w}
                                height={h}
                                fill={colorOf(stack.equipmentId)}
                                fillOpacity={0.75}
                                stroke="#fff"
                                strokeWidth={1}
                              />
                              <text x={stack.x * scale + w / 2} y={stack.y * scale + h / 2} fill="#fff" fontSize={11} textAnchor="middle" dominantBaseline="middle">
                                {stack.cases}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  );
                })}
              </Space>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('led.nothingToLoad')} />
            )}

            {plan.data?.unplaced.length ? (
              <Alert
                type="error"
                showIcon
                style={{ marginTop: 12 }}
                message={t('led.unplacedHint', { count: plan.data.unplaced.length })}
              />
            ) : null}
          </Card>
        </Col>
      </Row>
    </>
  );
}
