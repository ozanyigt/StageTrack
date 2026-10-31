import { Alert, Card, Col, Empty, InputNumber, Row, Segmented, Slider, Table, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { equipmentApi, ledApi } from '../../api/endpoints';
import type { EquipmentDiscipline } from '../../api/types';
import { LedSimulationPage } from '../led/LedSimulationPage';
import { useLedJob, type JobLine } from '../led/useLedJob';
import { CoverageView, type CoverageItem } from './CoverageView';
import { sanitizePropPlacements, type PropPlacements } from './stageProps';

const PROP_PLACEMENTS_KEY = 'stagetrack-stage-prop-placements-v1';
const COVERAGE_KEY = 'stagetrack-coverage-v1';

/** What a group throws. Not in any inventory, so it is a decision the user makes here, with a usable default. */
interface Coverage {
  spreadDeg: number;
  throwM: number;
}

const DEFAULTS: Record<string, Coverage> = {
  Sound: { spreadDeg: 90, throwM: 25 },
  Light: { spreadDeg: 0, throwM: 4 },
};

type SimTab = 'Screen' | 'Sound' | 'Light';

/**
 * Simulation, one trade at a time. The screens keep the wiring simulation they always had - how the panels chain
 * into circuits and data lines, which is a real calculation the server answers. Sound and light get the question
 * their plans are actually read for: from where each group stands, what does it cover, and what does nobody.
 *
 * Truss and scaffolding are not here on purpose: there is nothing about them to simulate that the 3D stage and
 * the weight totals do not already show.
 */
export function SimulationPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SimTab>('Screen');

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3} style={{ margin: 0 }}>{t('led.simTitle')}</Typography.Title>
        <Segmented
          value={tab}
          onChange={(value) => setTab(value as SimTab)}
          options={[
            { value: 'Screen', label: t('draft.simScreen') },
            { value: 'Sound', label: t('enums.equipmentDiscipline.Sound') },
            { value: 'Light', label: t('enums.equipmentDiscipline.Light') },
          ]}
        />
      </div>

      {tab === 'Screen' ? <LedSimulationPage hideTitle /> : <CoverageSimulation trade={tab} />}
    </>
  );
}

function CoverageSimulation({ trade }: { trade: Extract<EquipmentDiscipline, 'Sound' | 'Light'> }) {
  const { t } = useTranslation();
  const { job } = useLedJob();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [coverage, setCoverage] = useState<Record<string, Coverage>>(() => {
    try {
      return JSON.parse(localStorage.getItem(COVERAGE_KEY) ?? '{}') as Record<string, Coverage>;
    } catch {
      return {};
    }
  });
  useEffect(() => localStorage.setItem(COVERAGE_KEY, JSON.stringify(coverage)), [coverage]);

  /** Where the groups stand: set on the 3D stage, read here, so the two screens cannot tell different stories. */
  const placements = useMemo<PropPlacements>(() => {
    try {
      return sanitizePropPlacements(JSON.parse(localStorage.getItem(PROP_PLACEMENTS_KEY) ?? 'null'));
    } catch {
      return {};
    }
  }, []);

  const stage = useQuery({ queryKey: ['led-stage'], queryFn: () => ledApi.stage() });
  const catalogue = useQuery({
    queryKey: ['equipment', 'for-coverage'],
    queryFn: () => equipmentApi.list({ maxResultCount: 1000, sorting: 'code' }),
    enabled: job.lines.some((l) => l.equipmentId),
  });

  const lines = job.lines.filter((l) => l.discipline === trade && l.equipmentId);
  const codeOf = (line: JobLine) => catalogue.data?.items.find((e) => e.id === line.equipmentId)?.code ?? '';
  const settingOf = (id: string) => coverage[id] ?? DEFAULTS[trade];

  const items: CoverageItem[] = lines.map((line) => {
    const placement = placements[line.id];
    const setting = settingOf(line.id);
    return {
      id: line.id,
      label: line.name,
      trade,
      x: placement?.x ?? 0,
      z: placement?.z ?? 0,
      rotationDeg: placement?.rotationDeg ?? 0,
      spreadDeg: setting.spreadDeg,
      throwM: setting.throwM,
      count: line.count,
    };
  });

  const unplaced = lines.filter((l) => !placements[l.id]).length;

  if (lines.length === 0) {
    return <Card><Empty description={t('draft.noTradeGroups', { trade: t(`enums.equipmentDiscipline.${trade}`) })} /></Card>;
  }

  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} xl={16}>
        {unplaced > 0 && (
          <Alert type="info" showIcon style={{ marginBottom: 8 }} message={t('draft.unplacedGroups', { count: unplaced })} />
        )}
        <Card size="small" styles={{ body: { padding: 8 } }} loading={stage.isLoading}>
          <CoverageView
            podium={{ width: stage.data?.stageWidthM ?? 12, depth: stage.data?.stageDepthM ?? 8 }}
            items={items}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </Card>
      </Col>

      <Col xs={24} xl={8}>
        <Card size="small" title={t('draft.coverageSettings')}>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
            {trade === 'Sound' ? t('draft.soundCoverageHint') : t('draft.lightCoverageHint')}
          </Typography.Paragraph>
          <Table
            size="small"
            rowKey="id"
            pagination={false}
            dataSource={lines}
            onRow={(line) => ({ onClick: () => setSelectedId(line.id) })}
            columns={[
              {
                title: t('draft.groupName'),
                render: (_: unknown, line: JobLine) => (
                  <>
                    <div>{line.name}</div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>{codeOf(line)} × {line.count}</Typography.Text>
                  </>
                ),
              },
              {
                title: trade === 'Sound' ? t('draft.spread') : t('draft.beam'),
                width: 130,
                render: (_: unknown, line: JobLine) => (
                  <Slider
                    min={0}
                    max={180}
                    value={settingOf(line.id).spreadDeg}
                    tooltip={{ formatter: (v) => `${v}°` }}
                    onChange={(value) =>
                      setCoverage((c) => ({ ...c, [line.id]: { ...settingOf(line.id), spreadDeg: value } }))
                    }
                  />
                ),
              },
              {
                title: t('draft.throw'),
                width: 110,
                render: (_: unknown, line: JobLine) => (
                  <InputNumber
                    size="small"
                    min={1}
                    max={200}
                    value={settingOf(line.id).throwM}
                    addonAfter="m"
                    style={{ width: '100%' }}
                    onChange={(value) =>
                      setCoverage((c) => ({ ...c, [line.id]: { ...settingOf(line.id), throwM: Math.max(1, value ?? 1) } }))
                    }
                  />
                ),
              },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );
}
