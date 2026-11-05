import { DeleteOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Empty, Flex, Row, Segmented, Space, Statistic, Table, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { draftApi } from '../../api/endpoints';
import { planCabling, SLACK, type CableConsumer, type Distro } from './cabling';
import { TRADE_COLOR } from './stageProps';
import { useStageScene } from './useStageScene';

const DISTROS_KEY = 'stagetrack-distros-v1';
const AMPS = [16, 32, 63, 125];

/**
 * Where the power comes from, and how much cable that costs. The circuits were always known; the metres were
 * not, because they depend on where the boxes stand - which is the planner's decision, made here by clicking on
 * the plan. Everything then runs to its nearest box and the totals are a number to buy or hire against.
 */
export function CablingPanel() {
  const { t } = useTranslation();
  const { job, layout, sceneProps, evaluation, room } = useStageScene();
  const [placing, setPlacing] = useState<'distro' | 'mains' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const [stored, setStored] = useState<{ distros: Distro[]; mains: { x: number; z: number } | null }>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(DISTROS_KEY) ?? 'null');
      return { distros: Array.isArray(raw?.distros) ? raw.distros : [], mains: raw?.mains ?? null };
    } catch {
      return { distros: [], mains: null };
    }
  });
  useEffect(() => localStorage.setItem(DISTROS_KEY, JSON.stringify(stored)), [stored]);

  /** The other trades' circuits come from the same server calculation the power page reports. */
  const lines = job.lines.filter((l) => l.equipmentId);
  const equipmentPower = useQuery({
    queryKey: ['equipment-power', job.voltage, job.mode, lines],
    queryFn: () =>
      draftApi.equipmentPower({
        voltage: job.voltage,
        mode: job.mode,
        lines: lines.map((l) => ({ id: l.id, equipmentId: l.equipmentId, count: l.count })),
      }),
    enabled: lines.length > 0,
  });

  const consumers: CableConsumer[] = useMemo(() => {
    const screens = (layout?.screens ?? []).map((placed) => ({
      id: placed.screen.id,
      label: placed.screen.name ?? placed.screen.id,
      x: placed.x,
      z: placed.z,
      circuits: evaluation.data?.screens.find((s) => s.id === placed.screen.id)?.power?.circuitsNeeded ?? 1,
      heightM: placed.bottom,
    }));

    const groups = sceneProps.map((prop) => ({
      id: prop.id,
      label: prop.label,
      x: prop.x,
      z: prop.z,
      circuits: equipmentPower.data?.lines.find((l) => l.id === prop.id)?.circuits ?? 1,
      heightM: prop.flown ? prop.y : 0,
    }));

    return [...screens, ...groups];
  }, [layout, sceneProps, evaluation.data, equipmentPower.data]);

  const result = useMemo(() => planCabling(consumers, stored.distros, stored.mains), [consumers, stored]);

  const bounds = useMemo(() => {
    const xs = [...consumers.map((c) => c.x), ...stored.distros.map((d) => d.x), room?.minX ?? -12, room?.maxX ?? 12];
    const zs = [...consumers.map((c) => c.z), ...stored.distros.map((d) => d.z), room?.minZ ?? -6, room?.maxZ ?? 24];
    const pad = 4;
    return { minX: Math.min(...xs) - pad, maxX: Math.max(...xs) + pad, minZ: Math.min(...zs) - pad, maxZ: Math.max(...zs) + pad };
  }, [consumers, stored.distros, room]);

  if (consumers.length === 0) {
    return <Card><Empty description={t('cable.nothingToFeed')} /></Card>;
  }

  const onPlanClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!placing) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = bounds.minX + ((e.clientX - rect.left) / rect.width) * (bounds.maxX - bounds.minX);
    const z = bounds.minZ + ((e.clientY - rect.top) / rect.height) * (bounds.maxZ - bounds.minZ);
    const at = { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 };

    if (placing === 'mains') {
      setStored((s) => ({ ...s, mains: at }));
    } else {
      const id = `d${Date.now().toString(36)}`;
      setStored((s) => ({
        ...s,
        distros: [...s.distros, { id, name: t('cable.distroName', { n: s.distros.length + 1 }), amps: 63, ...at }],
      }));
      setSelected(id);
    }
    setPlacing(null);
  };

  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} xl={16}>
        <Flex gap={8} wrap style={{ marginBottom: 8 }}>
          <Button
            type={placing === 'distro' ? 'primary' : 'default'}
            icon={<PlusOutlined />}
            onClick={() => setPlacing(placing === 'distro' ? null : 'distro')}
          >
            {t('cable.addDistro')}
          </Button>
          <Button
            type={placing === 'mains' ? 'primary' : 'default'}
            icon={<ThunderboltOutlined />}
            onClick={() => setPlacing(placing === 'mains' ? null : 'mains')}
          >
            {stored.mains ? t('cable.moveMains') : t('cable.setMains')}
          </Button>
          {placing && <Typography.Text type="secondary">{t('cable.clickPlan')}</Typography.Text>}
        </Flex>

        <Card size="small" styles={{ body: { padding: 8 } }}>
          <svg
            viewBox={`${bounds.minX} ${bounds.minZ} ${bounds.maxX - bounds.minX} ${bounds.maxZ - bounds.minZ}`}
            style={{ width: '100%', height: 440, background: '#0a0a0a', borderRadius: 6, display: 'block', cursor: placing ? 'crosshair' : 'default' }}
            onClick={onPlanClick}
            role="img"
            aria-label={t('cable.title')}
          >
            {room && (
              <rect x={room.minX} y={room.minZ} width={room.maxX - room.minX} height={room.maxZ - room.minZ} fill="#141417" stroke="#3f3f46" strokeWidth="0.15" />
            )}

            {layout && (
              <rect
                x={-layout.podium.width / 2}
                y={layout.podium.back}
                width={layout.podium.width}
                height={layout.podium.depth}
                fill="#1c1c1f"
                stroke="#52525b"
                strokeWidth="0.08"
              />
            )}

            {result.runs.map((run) => {
              const consumer = consumers.find((c) => c.id === run.consumerId)!;
              const distro = stored.distros.find((d) => d.id === run.distroId);
              if (!distro) return null;
              return (
                <line
                  key={run.consumerId}
                  x1={consumer.x}
                  y1={consumer.z}
                  x2={distro.x}
                  y2={distro.z}
                  stroke={selected === distro.id ? '#facc15' : '#52525b'}
                  strokeWidth="0.08"
                  strokeDasharray="0.4 0.3"
                />
              );
            })}

            {stored.mains &&
              stored.distros.map((distro) => (
                <line
                  key={`feed-${distro.id}`}
                  x1={stored.mains!.x}
                  y1={stored.mains!.z}
                  x2={distro.x}
                  y2={distro.z}
                  stroke="#dc2626"
                  strokeWidth="0.14"
                />
              ))}

            {consumers.map((consumer) => (
              <g key={consumer.id}>
                <circle cx={consumer.x} cy={consumer.z} r={0.3} fill={TRADE_COLOR.Led} fillOpacity={0.9} />
                <text x={consumer.x} y={consumer.z - 0.5} fill="#e4e4e7" fontSize="0.6" textAnchor="middle">
                  {consumer.label}
                </text>
              </g>
            ))}

            {stored.distros.map((distro) => (
              <g key={distro.id} onClick={(e) => { e.stopPropagation(); setSelected(distro.id); }} style={{ cursor: 'pointer' }}>
                <rect
                  x={distro.x - 0.5}
                  y={distro.z - 0.5}
                  width={1}
                  height={1}
                  fill="#facc15"
                  fillOpacity={selected === distro.id ? 1 : 0.7}
                  stroke="#000"
                  strokeWidth="0.05"
                />
                <text x={distro.x} y={distro.z + 1.4} fill="#facc15" fontSize="0.65" textAnchor="middle">
                  {distro.name} · {distro.amps} A
                </text>
              </g>
            ))}

            {stored.mains && (
              <g>
                <circle cx={stored.mains.x} cy={stored.mains.z} r={0.6} fill="#dc2626" />
                <text x={stored.mains.x} y={stored.mains.z - 1} fill="#fca5a5" fontSize="0.7" textAnchor="middle">
                  {t('cable.mains')}
                </text>
              </g>
            )}
          </svg>
        </Card>
      </Col>

      <Col xs={24} xl={8}>
        <Card size="small" title={t('cable.title')}>
          {stored.distros.length === 0 ? (
            <Alert type="info" showIcon message={t('cable.noDistros')} description={t('cable.noDistrosHint')} />
          ) : (
            <>
              <Flex gap={24} wrap>
                <Statistic title={t('cable.totalCable')} value={Math.round(result.totalCableM)} suffix="m" valueStyle={{ fontSize: 18 }} />
                <Statistic title={t('cable.feeder')} value={Math.round(result.feederM)} suffix="m" valueStyle={{ fontSize: 18 }} />
                <Statistic title={t('cable.distros')} value={stored.distros.length} valueStyle={{ fontSize: 18 }} />
              </Flex>

              {!stored.mains && <Alert type="info" showIcon style={{ marginTop: 8 }} message={t('cable.noMains')} />}

              <Table
                size="small"
                rowKey={(row) => row.distro.id}
                style={{ marginTop: 10 }}
                pagination={false}
                dataSource={result.perDistro}
                onRow={(row) => ({ onClick: () => setSelected(row.distro.id) })}
                columns={[
                  {
                    title: t('cable.distro'),
                    render: (_: unknown, row: (typeof result.perDistro)[number]) => (
                      <Space direction="vertical" size={0}>
                        <Typography.Text>{row.distro.name}</Typography.Text>
                        <Segmented
                          size="small"
                          value={row.distro.amps}
                          options={AMPS.map((a) => ({ value: a, label: `${a}A` }))}
                          onChange={(value) =>
                            setStored((s) => ({
                              ...s,
                              distros: s.distros.map((d) => (d.id === row.distro.id ? { ...d, amps: Number(value) } : d)),
                            }))
                          }
                        />
                      </Space>
                    ),
                  },
                  { title: t('led.circuits'), align: 'end', width: 80, render: (_: unknown, row: (typeof result.perDistro)[number]) => row.circuits },
                  {
                    title: t('cable.metres'),
                    align: 'end',
                    width: 90,
                    render: (_: unknown, row: (typeof result.perDistro)[number]) => `${Math.round(row.cableM)} m`,
                  },
                  {
                    width: 40,
                    render: (_: unknown, row: (typeof result.perDistro)[number]) => (
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setStored((s) => ({ ...s, distros: s.distros.filter((d) => d.id !== row.distro.id) }));
                        }}
                      />
                    ),
                  },
                ]}
              />
            </>
          )}

          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
            {t('cable.hint', { slack: Math.round((SLACK - 1) * 100) })}
          </Typography.Paragraph>
        </Card>
      </Col>
    </Row>
  );
}
