import { RotateRightOutlined, UndoOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Checkbox, Col, Empty, Flex, InputNumber, Progress, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography, theme } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ledApi } from '../../api/endpoints';
import type { LedTransportKind, TransportGroupDto } from '../../api/ledTypes';
import { useErrorToast } from '../../utils/errors';
import {
  AUTO_MODE,
  DEFAULT_LOGISTICS,
  KEY_STEP_BIG_CM,
  KEY_STEP_CM,
  MAGNET_PX,
  currentLayout,
  footprint,
  gapOf,
  groupsOf,
  itemProblems,
  loadSummary,
  magnetize,
  moveItem,
  planSignature,
  rotateItem,
  sendToVehicle,
  spaceOf,
  typesOf,
  vehicleTotals,
  type Guide,
  type LoadLayout,
  type LogisticsState,
} from './core/logistics/load';
import { transportKinds } from './core/transportKinds';
import { useLedJob } from './useLedJob';

const STORAGE_KEY = 'stagetrack-led-logistics-v1';

/**
 * The loading plan: the job's cases and where they stand in each vehicle, seen from above — x along the vehicle's
 * length from the cab, y across its width. The server's automatic plan is the starting point; from there every
 * stack can be dragged, turned and sent to another vehicle, because a real load is decided by things the maths
 * cannot know (what comes off first, what must not travel on top of what).
 *
 * The edited layout is kept against the plan's signature: change a screen and the hand-made layout is dropped
 * rather than silently applied to cases that no longer exist.
 */
export function LedLogisticsPage() {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const { job, request } = useLedJob();

  const [state, setState] = useState<LogisticsState>(() => {
    try {
      return { ...DEFAULT_LOGISTICS, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? {}) };
    } catch {
      return DEFAULT_LOGISTICS;
    }
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const dragRef = useRef<{ id: string; vehicleUid: string; offsetX: number; offsetY: number; scale: number } | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const vehicles = useQuery({ queryKey: ['led-vehicles'], queryFn: () => ledApi.vehicles() });

  const plan = useQuery({
    queryKey: ['led-plan', request.screens, state.vehicleMode],
    queryFn: () => ledApi.plan({ screens: request.screens, vehicleId: state.vehicleMode === AUTO_MODE ? null : state.vehicleMode }),
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

  const kinds = useMemo(() => transportKinds((kind: LedTransportKind) => t(`enums.ledTransportKind.${kind}`)), [t]);
  const groups = useMemo(() => (plan.data ? groupsOf(plan.data, kinds) : new Map()), [plan.data, kinds]);
  const types = useMemo(() => (plan.data ? typesOf(plan.data) : new Map()), [plan.data]);
  const gapCm = plan.data ? gapOf(plan.data) : 0;

  const layout: LoadLayout = useMemo(
    () => (plan.data ? currentLayout(plan.data, state, state.vehicleMode) : { vehicles: [], unplaced: [] }),
    [plan.data, state],
  );

  const problems = useMemo(() => itemProblems(layout, groups, types, gapCm), [layout, groups, types, gapCm]);
  const summary = useMemo(() => loadSummary(layout, groups, types, gapCm), [layout, groups, types, gapCm]);

  /** Every hand edit is stored against the plan it was made on, so a changed screen drops it instead of corrupting it. */
  const edit = useCallback(
    (change: (current: LoadLayout) => LoadLayout) => {
      if (!plan.data) return;
      const signature = planSignature(plan.data, state.vehicleMode);
      setState((s) => ({ ...s, manual: { signature, layout: change(currentLayout(plan.data!, s, s.vehicleMode)) } }));
    },
    [plan.data, state.vehicleMode],
  );

  const resetLayout = () => setState((s) => ({ ...s, manual: null }));

  const rotate = useCallback(
    (id: string) => edit((current) => rotateItem(current, id, groups)),
    [edit, groups],
  );

  // Arrow keys nudge the selected stack: 1 cm, or 10 cm with Shift.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: KeyboardEvent) => {
      const step = event.shiftKey ? KEY_STEP_BIG_CM : KEY_STEP_CM;
      const delta =
        event.key === 'ArrowLeft' ? [-step, 0] : event.key === 'ArrowRight' ? [step, 0]
        : event.key === 'ArrowUp' ? [0, -step] : event.key === 'ArrowDown' ? [0, step] : null;
      if (delta) {
        event.preventDefault();
        edit((current) => {
          const vehicle = current.vehicles.find((v) => v.items.some((i) => i.id === selectedId));
          const item = vehicle?.items.find((i) => i.id === selectedId);
          return vehicle && item ? moveItem(current, selectedId, vehicle.uid, item.x + delta[0], item.y + delta[1]) : current;
        });
      } else if (event.key.toLowerCase() === 'r') {
        rotate(selectedId);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, edit, rotate]);

  if (job.screens.length === 0) {
    return (
      <>
        <Typography.Title level={3} style={{ marginTop: 0 }}>{t('led.logisticsTitle')}</Typography.Title>
        <Card><Empty description={t('led.noScreensForPlan')} /></Card>
      </>
    );
  }

  const colorOf = (equipmentId: string) => {
    const index = (plan.data?.groups ?? []).findIndex((g) => g.equipmentId === equipmentId);
    const palette = ['#4f46e5', '#0d9488', '#d97706', '#be123c', '#7c3aed', '#0369a1'];
    return palette[(index < 0 ? 0 : index) % palette.length];
  };

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('led.logisticsTitle')}</Typography.Title>
        <Space size="large" wrap>
          <Statistic title={t('led.vehicle')} value={summary.vehicles} valueStyle={{ fontSize: 18 }} />
          <Statistic title={t('led.cases')} value={summary.cases + summary.dollies} valueStyle={{ fontSize: 18 }} />
          <Statistic
            title={t('led.weight')}
            value={Math.round(summary.weightKg)}
            suffix="kg"
            valueStyle={{ fontSize: 18, color: summary.overWeight ? '#ff4d4f' : undefined }}
          />
          {state.manual && (
            <Button icon={<UndoOutlined />} onClick={resetLayout}>{t('led.backToAuto')}</Button>
          )}
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Flex gap={16} wrap align="center">
          <Space>
            <Typography.Text type="secondary">{t('led.vehicle')}</Typography.Text>
            <Select
              style={{ minWidth: 220 }}
              value={state.vehicleMode}
              loading={vehicles.isFetching}
              onChange={(v) => setState((s) => ({ ...s, vehicleMode: v, manual: null }))}
              options={[
                { value: AUTO_MODE, label: t('led.vehicleAuto') },
                ...(vehicles.data?.vehicles ?? []).map((v) => ({
                  value: v.id,
                  label: `${v.name} · ${(v.lengthMm / 1000).toFixed(2)} × ${(v.widthMm / 1000).toFixed(2)} m`,
                })),
              ]}
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
          <Checkbox checked={state.autoFit} onChange={(e) => setState((s) => ({ ...s, autoFit: e.target.checked }))}>
            {t('led.autoFit')}
          </Checkbox>
          {selectedId && (
            <Space>
              <Tooltip title={t('led.rotateHint')}>
                <Button size="small" icon={<RotateRightOutlined />} onClick={() => rotate(selectedId)}>{t('led.rotate')}</Button>
              </Tooltip>
              <Select
                size="small"
                style={{ minWidth: 140 }}
                placeholder={t('led.moveToVehicle')}
                value={undefined}
                onChange={(uid: string) => edit((current) => sendToVehicle(current, selectedId, uid, groups, gapCm))}
                options={layout.vehicles.map((v, i) => ({ value: v.uid, label: t('led.vehicleNo', { index: i + 1 }) }))}
              />
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
        <Col xs={24} lg={9}>
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
                { title: t('led.pieces'), dataIndex: 'panels', width: 70, align: 'end' },
                {
                  title: t('led.cases'),
                  width: 110,
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

          {layout.unplaced.length > 0 && (
            <Alert
              type="error"
              showIcon
              style={{ marginTop: 12 }}
              message={t('led.unplacedHint', { count: layout.unplaced.length })}
            />
          )}
        </Col>

        <Col xs={24} lg={15}>
          <Card size="small" title={t('led.loadingPlan')} loading={plan.isFetching}>
            {layout.vehicles.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('led.nothingToLoad')} />
            ) : (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                {layout.vehicles.map((vehicle, index) => {
                  const type = types.get(vehicle.typeId);
                  if (!type) return null;
                  const space = spaceOf(type);
                  const totals = vehicleTotals(vehicle, groups, type, gapCm);
                  const scale = 620 / space.length;

                  return (
                    <div key={vehicle.uid}>
                      <Flex justify="space-between" align="center" wrap gap={8}>
                        <Typography.Text strong>
                          {t('led.vehicleNo', { index: index + 1 })} · {type.name}
                        </Typography.Text>
                        <Space size={8} wrap>
                          <Tag color={totals.overWeight ? 'red' : undefined}>
                            {Math.round(totals.weightKg)} / {totals.capacityKg} kg
                          </Tag>
                          <Tooltip title={t('led.floorFill')}>
                            <Progress type="circle" size={28} percent={Math.min(100, Math.round(totals.floorFill * 100))} />
                          </Tooltip>
                          <Tag>{t('led.freeLength', { m: (totals.freeLengthCm / 100).toFixed(2) })}</Tag>
                        </Space>
                      </Flex>

                      <svg
                        width="100%"
                        viewBox={`0 0 ${space.length * scale} ${space.width * scale}`}
                        style={{ background: token.colorFillQuaternary, borderRadius: 6, marginTop: 6, maxHeight: 260, touchAction: 'none' }}
                        role="img"
                        onPointerMove={(event) => {
                          const drag = dragRef.current;
                          if (!drag || drag.vehicleUid !== vehicle.uid) return;
                          const box = event.currentTarget.getBoundingClientRect();
                          const px = ((event.clientX - box.left) / box.width) * space.length;
                          const py = ((event.clientY - box.top) / box.height) * space.width;
                          const magnet = magnetize(
                            layout, drag.id, vehicle.uid,
                            px - drag.offsetX, py - drag.offsetY,
                            groups, types, gapCm, (MAGNET_PX / box.width) * space.length,
                          );
                          setGuides(magnet.guides);
                          edit((current) => moveItem(current, drag.id, vehicle.uid, magnet.x, magnet.y));
                        }}
                        onPointerUp={() => {
                          dragRef.current = null;
                          setGuides([]);
                        }}
                        onPointerLeave={() => {
                          dragRef.current = null;
                          setGuides([]);
                        }}
                      >
                        <rect x={0} y={0} width={space.length * scale} height={space.width * scale} fill="none" stroke={token.colorBorder} />

                        {guides.map((g, i) => (
                          <line
                            key={i}
                            x1={g.x1 * scale}
                            y1={g.y1 * scale}
                            x2={g.x2 * scale}
                            y2={g.y2 * scale}
                            stroke={token.colorPrimary}
                            strokeDasharray="4 3"
                            strokeWidth={1}
                          />
                        ))}

                        {vehicle.items.map((item) => {
                          const group = groups.get(item.equipmentId);
                          if (!group) return null;
                          const { dx, dy } = footprint(item, group);
                          const bad = problems.get(item.id);
                          const selected = item.id === selectedId;

                          return (
                            <g
                              key={item.id}
                              style={{ cursor: 'grab' }}
                              onPointerDown={(event) => {
                                event.preventDefault();
                                const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                                const px = ((event.clientX - box.left) / box.width) * space.length;
                                const py = ((event.clientY - box.top) / box.height) * space.width;
                                dragRef.current = { id: item.id, vehicleUid: vehicle.uid, offsetX: px - item.x, offsetY: py - item.y, scale };
                                setSelectedId(item.id);
                              }}
                              onDoubleClick={() => rotate(item.id)}
                            >
                              <rect
                                x={item.x * scale}
                                y={item.y * scale}
                                width={dx * scale}
                                height={dy * scale}
                                fill={colorOf(item.equipmentId)}
                                fillOpacity={bad?.size ? 0.45 : 0.78}
                                stroke={bad?.size ? '#ff4d4f' : selected ? token.colorPrimary : '#fff'}
                                strokeWidth={selected || bad?.size ? 2 : 1}
                              />
                              <text
                                x={item.x * scale + (dx * scale) / 2}
                                y={item.y * scale + (dy * scale) / 2}
                                fill="#fff"
                                fontSize={11}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                pointerEvents="none"
                              >
                                {item.cases}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  );
                })}
              </Space>
            )}

            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
              {t('led.planHint')}
            </Typography.Paragraph>
          </Card>
        </Col>
      </Row>
    </>
  );
}
