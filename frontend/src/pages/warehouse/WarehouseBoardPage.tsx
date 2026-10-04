import { LeftOutlined, PrinterOutlined, RightOutlined, ScanOutlined } from '@ant-design/icons';
import { Badge, Button, Card, DatePicker, Empty, Flex, Space, Spin, Typography, theme } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { warehouseApi } from '../../api/endpoints';
import type { ProjectListItem, WarehouseBoard } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { StockLocationSelect } from '../../components/Selects';
import { useFormat } from '../../utils/format';

const COLUMNS: { key: keyof Omit<WarehouseBoard, 'date'>; color: string }[] = [
  { key: 'confirmed', color: '#1677ff' },
  { key: 'prepped', color: '#13c2c2' },
  { key: 'onLocation', color: '#722ed1' },
  { key: 'expectedBack', color: '#52c41a' },
  { key: 'delayed', color: '#ff4d4f' },
];

/** Rentman-style warehouse board: what to prepare, what is out, what should come back today, what is late. */
export function WarehouseBoardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const f = useFormat();
  const { token } = theme.useToken();
  const [date, setDate] = useState(dayjs());
  const [locationId, setLocationId] = useState<string>();

  const { data, isFetching } = useQuery({
    queryKey: ['board', date.format('YYYY-MM-DD'), locationId],
    queryFn: () => warehouseApi.board({ date: date.format('YYYY-MM-DD'), stockLocationId: locationId }),
    refetchInterval: 30_000,
  });

  const card = (p: ProjectListItem) => (
    <Card key={p.id} size="small" hoverable style={{ marginBottom: 8, borderInlineStart: `4px solid ${p.color}` }}
      onClick={() => navigate(`/projects/${p.id}`)}>
      <Flex justify="space-between" gap={8}>
        <div style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis style={{ display: 'block' }}>{p.name}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{p.number} · {p.stockLocationName ?? '—'}</Typography.Text>
          {p.customerName && <Typography.Text style={{ fontSize: 12, display: 'block' }} ellipsis>{p.customerName}</Typography.Text>}
          <Typography.Text style={{ fontSize: 12 }}>{f.dateTime(p.planStart)} → {f.dateTime(p.planEnd)}</Typography.Text>
        </div>
        <div style={{ background: '#fff', padding: 3, borderRadius: 4, height: 'fit-content' }}>
          <QRCodeSVG value={`${window.location.origin}/warehouse/scan/${p.id}`} size={56} />
        </div>
      </Flex>
      <Flex justify="space-between" align="center" style={{ marginTop: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('board.items', { count: p.plannedQuantity })}</Typography.Text>
        {can(Permissions.WarehouseScan) && (
          <Button size="small" icon={<ScanOutlined />} onClick={(e) => { e.stopPropagation(); navigate(`/warehouse/scan/${p.id}`); }}>
            {t('board.scan')}
          </Button>
        )}
      </Flex>
    </Card>
  );

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('board.title')}</Typography.Title>
        <Space wrap>
          <Button icon={<LeftOutlined />} onClick={() => setDate(date.subtract(1, 'day'))} aria-label={t('calendar.previous')} />
          <DatePicker value={date} onChange={(d) => d && setDate(d)} format="DD.MM.YYYY" allowClear={false} />
          <Button icon={<RightOutlined />} onClick={() => setDate(date.add(1, 'day'))} aria-label={t('calendar.next')} />
          <Button onClick={() => setDate(dayjs())}>{t('calendar.today')}</Button>
          <StockLocationSelect placeholder={t('board.allLocations')} value={locationId} onChange={setLocationId} style={{ width: 170 }} />
          <Button icon={<PrinterOutlined />} className="hide-mobile" onClick={() => window.print()}>{t('common.print')}</Button>
        </Space>
      </div>
      <Spin spinning={isFetching}>
        <div className="kanban">
          {COLUMNS.map((c) => {
            const items = data?.[c.key] ?? [];
            return (
              <div key={c.key} style={{ background: token.colorFillQuaternary, borderRadius: 8, padding: 8, minHeight: 200 }}>
                <Flex justify="space-between" align="center" style={{ padding: '4px 4px 10px', borderBottom: `2px solid ${c.color}`, marginBottom: 8 }}>
                  <Typography.Text strong>{t(`board.columns.${c.key}`)}</Typography.Text>
                  <Badge count={items.length} showZero color={c.color} />
                </Flex>
                {items.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('board.empty')} /> : items.map(card)}
              </div>
            );
          })}
        </div>
      </Spin>
    </>
  );
}
