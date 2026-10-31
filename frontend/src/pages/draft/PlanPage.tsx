import { PrinterOutlined } from '@ant-design/icons';
import { Card, Checkbox, Descriptions, Flex, Input, Segmented, Space, Table, Tag, Typography, Button } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { projectApi } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { formatDate } from '../../utils/format';
import type { Distro } from './cabling';
import { PlanSheet } from './PlanSheet';
import { TRADE_COLOR } from './stageProps';
import { useStageScene } from './useStageScene';

const DISTROS_KEY = 'stagetrack-distros-v1';
const SCALES = [50, 100, 200, 500];

/**
 * The sheet that goes to the venue. Everything a drawing needs to be taken seriously: a title block that says
 * which job and which revision it is, a plan at a scale a ruler agrees with, measurements, a legend, and the
 * equipment list on the same page - so what is drawn and what is being hired can be checked against each other
 * without opening a second document.
 */
export function PlanPage() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const { job, layout, sceneProps, room, venue, equipmentById } = useStageScene();
  const [scale, setScale] = useState(200);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [revision, setRevision] = useState('A');
  const [note, setNote] = useState('');

  const jobs = useQuery({
    queryKey: ['projects', 'draft-picker'],
    queryFn: () => projectApi.list({ statuses: ['Draft', 'Pending', 'Confirmed', 'Prepped', 'OnLocation'], maxResultCount: 300, sorting: 'planStart' }),
  });
  const project = jobs.data?.items.find((p) => p.id === job.projectId);

  const { distros, mains } = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(DISTROS_KEY) ?? 'null');
      return { distros: (Array.isArray(raw?.distros) ? raw.distros : []) as Distro[], mains: raw?.mains ?? null };
    } catch {
      return { distros: [] as Distro[], mains: null };
    }
  }, []);

  /** The list under the drawing: every product the draft holds, screens included, with its count. */
  const items = useMemo(() => {
    const rows = job.lines
      .filter((line) => line.equipmentId)
      .map((line) => {
        const item = equipmentById.get(line.equipmentId!);
        return { key: line.id, trade: line.discipline, code: item?.code ?? '—', name: item?.name ?? line.name, count: line.count };
      });
    const panels = new Map<string, number>();
    for (const placed of layout?.screens ?? []) {
      const screen = placed.screen;
      const key = `${screen.panel.Marka} ${screen.panel.Model}`.trim();
      const count = screen.columns * screen.rows - screen.cut.size;
      panels.set(key, (panels.get(key) ?? 0) + count);
    }
    const panelRows = [...panels].map(([code, count]) => ({ key: `p-${code}`, trade: 'Led' as const, code, name: t('plan.panels'), count }));
    return [...panelRows, ...rows];
  }, [job.lines, equipmentById, layout, t]);

  return (
    <>
      <div className="page-header no-print">
        <Typography.Title level={3} style={{ margin: 0 }}>{t('plan.title')}</Typography.Title>
        <Space wrap>
          <Segmented value={scale} onChange={(v) => setScale(Number(v))} options={SCALES.map((s) => ({ value: s, label: `1:${s}` }))} />
          <Checkbox checked={showDimensions} onChange={(e) => setShowDimensions(e.target.checked)}>{t('plan.dimensions')}</Checkbox>
          <Checkbox checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)}>{t('plan.grid')}</Checkbox>
          <Input addonBefore={t('plan.revision')} value={revision} maxLength={8} style={{ width: 150 }} onChange={(e) => setRevision(e.target.value)} />
          <Input placeholder={t('plan.note')} value={note} maxLength={120} style={{ width: 240 }} onChange={(e) => setNote(e.target.value)} />
          <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>{t('common.print')}</Button>
        </Space>
      </div>

      <Card size="small" styles={{ body: { background: '#fff' } }}>
        <Descriptions
          size="small"
          bordered
          column={{ xs: 1, sm: 2, lg: 4 }}
          items={[
            { key: 'firm', label: t('plan.firm'), children: company?.name ?? '—' },
            { key: 'job', label: t('plan.job'), children: project ? `${project.number} · ${project.name}` : t('plan.noJob') },
            { key: 'venue', label: t('venue.title'), children: project?.venue ?? '—' },
            { key: 'date', label: t('plan.date'), children: formatDate(new Date().toISOString()) },
            { key: 'scale', label: t('plan.scale'), children: `1:${scale}` },
            { key: 'revision', label: t('plan.revision'), children: revision || '—' },
            {
              key: 'room',
              label: t('plan.room'),
              children: venue ? t('plan.roomValue', { w: venue.widthM, d: venue.depthM, h: venue.clearHeightM }) : '—',
            },
            { key: 'note', label: t('plan.note'), children: note || '—' },
          ]}
        />

        <div style={{ overflowX: 'auto', marginTop: 12, padding: 8, background: '#fff' }}>
          <PlanSheet
            layout={layout}
            props={sceneProps}
            room={room}
            distros={distros}
            mains={mains}
            scale={scale}
            showDimensions={showDimensions}
            showGrid={showGrid}
          />
        </div>

        <Flex gap={12} wrap style={{ marginTop: 12 }}>
          {Object.entries(TRADE_COLOR).map(([trade, colour]) => (
            <Tag key={trade} color={colour}>{t(`enums.equipmentDiscipline.${trade}`)}</Tag>
          ))}
          <Tag color="#facc15">{t('cable.distro')}</Tag>
          <Tag color="#dc2626">{t('cable.mains')}</Tag>
        </Flex>

        <Table
          size="small"
          style={{ marginTop: 12 }}
          pagination={false}
          dataSource={items}
          columns={[
            {
              title: t('draft.trade'),
              width: 110,
              render: (_: unknown, row: (typeof items)[number]) => (
                <Tag color={TRADE_COLOR[row.trade]}>{t(`enums.equipmentDiscipline.${row.trade}`)}</Tag>
              ),
            },
            { title: t('equipment.code'), dataIndex: 'code', width: 140 },
            { title: t('equipment.name'), dataIndex: 'name' },
            { title: t('draft.count'), dataIndex: 'count', align: 'end', width: 90 },
          ]}
        />
      </Card>
    </>
  );
}
