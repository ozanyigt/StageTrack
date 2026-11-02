import { PrinterOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Flex, InputNumber, Space, Statistic, Table, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ledApi } from '../../api/endpoints';
import type { LedStockLine, LedStockScreenRequest } from '../../api/ledTypes';
import { fitShape } from './core/simulation/shape';
import { useLedJob } from './useLedJob';

const OVERRIDES_KEY = 'stagetrack-led-stock-overrides-v1';

/**
 * What the firm owns against what the job needs, warehouse by warehouse. The "used" figure comes from the server,
 * counted from the screens themselves (cut-outs left out, a corner column counting for its own model), so it can
 * never drift from the loading plan or the transfer. A line can still be overridden by hand — a planner often
 * knows that half a wall is already promised elsewhere — and the shortage then follows what is shown.
 *
 * The LED half of the stock screen; the other trades count their own lines beside it, under their own tab.
 */
export function LedStockBody() {
  const { t } = useTranslation();
  const { job, walls } = useLedJob();
  const [overrides, setOverrides] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? '{}') as Record<string, number>;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  }, [overrides]);

  /** The screens as the stock endpoint wants them; the shape helper keeps cut-outs and corners in step. */
  const screens = useMemo<LedStockScreenRequest[]>(
    () =>
      walls.map((wall) => {
        const shape = fitShape(wall, true);
        return {
          id: wall.id,
          equipmentId: wall.panel?.PanelModelId ?? null,
          stockLocationId: null,
          columns: wall.widthPanels,
          rows: wall.heightPanels,
          cutouts: shape.cutouts.length > 0 ? shape.cutouts : null,
          corners:
            shape.corners.length > 0
              ? shape.corners.map((c) => ({ afterColumn: c.afterColumn, equipmentId: c.panel.PanelModelId, stockLocationId: null }))
              : null,
        };
      }),
    [walls],
  );

  const status = useQuery({
    queryKey: ['led-stock-status', screens],
    queryFn: () => ledApi.stockStatus(screens),
    enabled: job.screens.length > 0,
  });

  const key = (locationId: string | null | undefined, equipmentId: string) => `${equipmentId}@${locationId ?? '-'}`;
  const usedOf = (locationId: string | null | undefined, line: LedStockLine) =>
    overrides[key(locationId, line.equipmentId)] ?? line.used;

  const totals = useMemo(() => {
    let owned = 0;
    let used = 0;
    let short = 0;
    for (const location of status.data?.locations ?? []) {
      for (const line of location.lines) {
        const take = usedOf(location.id, line);
        owned += line.quantity;
        used += take;
        short += Math.max(0, take - line.quantity);
      }
    }

    return { owned, used, short };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.data, overrides]);

  if (job.screens.length === 0) {
    return <Card><Empty description={t('led.noScreensForStock')} /></Card>;
  }

  return (
    <>
      <div className="page-header">
        <Space size="large" wrap>
          <Statistic title={t('led.owned')} value={totals.owned} valueStyle={{ fontSize: 18 }} />
          <Statistic title={t('led.usedByJob')} value={totals.used} valueStyle={{ fontSize: 18 }} />
          <Statistic
            title={t('led.shortage')}
            value={totals.short}
            valueStyle={{ fontSize: 18, color: totals.short > 0 ? '#ff4d4f' : undefined }}
          />
          <Button icon={<PrinterOutlined />} onClick={() => window.print()} className="no-print">
            {t('common.print')}
          </Button>
        </Space>
      </div>

      {totals.short > 0 && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={t('led.shortageHint', { count: totals.short })} />
      )}

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {(status.data?.locations ?? []).map((location) => (
          <Card key={location.id ?? 'none'} size="small" title={location.name} loading={status.isFetching}>
            <Table
              size="small"
              rowKey="equipmentId"
              pagination={false}
              scroll={{ x: 'max-content' }}
              dataSource={location.lines}
              columns={[
                { title: t('equipment.code'), dataIndex: 'code', width: 130 },
                { title: t('equipment.name'), dataIndex: 'name' },
                { title: t('led.pitch'), dataIndex: 'pitchMm', width: 90, align: 'end', render: (v: number) => `${v} mm` },
                {
                  title: t('led.panelSize'),
                  width: 140,
                  render: (_: unknown, l: LedStockLine) => `${l.widthMm} × ${l.heightMm} mm`,
                },
                { title: t('led.owned'), dataIndex: 'quantity', width: 90, align: 'end' },
                {
                  title: t('led.usedByJob'),
                  width: 120,
                  align: 'end',
                  render: (_: unknown, l: LedStockLine) => (
                    <InputNumber
                      size="small"
                      min={0}
                      max={1_000_000}
                      value={usedOf(location.id, l)}
                      onChange={(v) =>
                        setOverrides((o) => {
                          const next = { ...o };
                          if (v == null || v === l.used) delete next[key(location.id, l.equipmentId)];
                          else next[key(location.id, l.equipmentId)] = v;
                          return next;
                        })
                      }
                      style={{ width: 90 }}
                    />
                  ),
                },
                {
                  title: t('led.remaining'),
                  width: 110,
                  align: 'end',
                  render: (_: unknown, l: LedStockLine) => {
                    const left = l.quantity - usedOf(location.id, l);
                    return left < 0 ? <Tag color="red">{left}</Tag> : <span>{left}</span>;
                  },
                },
                {
                  title: t('led.areaUsed'),
                  width: 120,
                  align: 'end',
                  render: (_: unknown, l: LedStockLine) => `${(usedOf(location.id, l) * l.panelAreaM2).toFixed(2)} m²`,
                },
              ]}
            />
          </Card>
        ))}
      </Space>

      {Object.keys(overrides).length > 0 && (
        <Flex justify="end" style={{ marginTop: 12 }}>
          <Button size="small" onClick={() => setOverrides({})}>{t('led.resetOverrides')}</Button>
        </Flex>
      )}

      {status.data?.locations.length === 0 && <Card><Empty description={t('led.noStockLines')} /></Card>}
    </>
  );
}
