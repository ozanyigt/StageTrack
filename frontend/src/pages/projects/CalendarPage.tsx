import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Flex, Select, Space, Spin, Tooltip, Typography, theme } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { projectApi } from '../../api/endpoints';
import { PROJECT_STATUSES, type ProjectStatus } from '../../api/types';
import { useFormat } from '../../utils/format';

/** Month planning view (Rentman "My schedule"): one row per project, a bar over its planning period. */
export function CalendarPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const f = useFormat();
  const { token } = theme.useToken();
  const [month, setMonth] = useState(dayjs().startOf('month'));
  const [statuses, setStatuses] = useState<ProjectStatus[]>(PROJECT_STATUSES.filter((s) => s !== 'Cancelled'));

  const start = month.startOf('month');
  const end = month.endOf('month');
  const days = Array.from({ length: end.date() }, (_, i) => start.add(i, 'day'));
  const today = dayjs().startOf('day');

  const { data, isFetching } = useQuery({
    queryKey: ['calendar', start.format('YYYY-MM'), statuses],
    queryFn: () =>
      projectApi.list({ from: start.format('YYYY-MM-DD'), to: end.format('YYYY-MM-DDT23:59:59'), statuses, maxResultCount: 500, sorting: 'planStart' }),
  });

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('calendar.title')}</Typography.Title>
        <Space wrap>
          <Select mode="multiple" maxTagCount="responsive" style={{ minWidth: 260 }} value={statuses} onChange={setStatuses}
            options={PROJECT_STATUSES.map((s) => ({ value: s, label: t(`enums.projectStatus.${s}`) }))} />
          <Button icon={<LeftOutlined />} onClick={() => setMonth(month.subtract(1, 'month'))} aria-label={t('calendar.previous')} />
          <Typography.Text strong style={{ minWidth: 130, display: 'inline-block', textAlign: 'center' }}>{month.format('MMMM YYYY')}</Typography.Text>
          <Button icon={<RightOutlined />} onClick={() => setMonth(month.add(1, 'month'))} aria-label={t('calendar.next')} />
          <Button onClick={() => setMonth(dayjs().startOf('month'))}>{t('calendar.today')}</Button>
        </Space>
      </div>
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Spin spinning={isFetching}>
          {data && data.items.length === 0 ? (
            <Empty style={{ padding: 32 }} description={t('calendar.empty')} />
          ) : (
            <div className="calendar-grid" style={{ ['--cal-border' as string]: token.colorBorderSecondary }}>
              <table>
                <colgroup>
                  <col style={{ width: 220 }} />
                  {days.map((d) => <col key={d.date()} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'start', paddingInline: 8 }}>{t('calendar.project')}</th>
                    {days.map((d) => (
                      <th key={d.date()} className={d.isSame(today, 'day') ? 'today' : undefined}
                        style={{ background: d.day() === 0 || d.day() === 6 ? token.colorFillQuaternary : undefined, fontWeight: 500 }}>
                        <div>{d.format('dd').slice(0, 2)}</div>
                        <div>{d.date()}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((p) => {
                    const ps = dayjs(p.planStart).startOf('day');
                    const pe = dayjs(p.planEnd).startOf('day');
                    const from = ps.isBefore(start) ? 0 : ps.date() - 1;
                    const to = pe.isAfter(end) ? days.length - 1 : pe.date() - 1;
                    const span = Math.max(1, to - from + 1);
                    return (
                      <tr key={p.id}>
                        <td style={{ paddingInline: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <Typography.Text style={{ fontSize: 12 }}>{p.number} · {p.name}</Typography.Text>
                        </td>
                        {from > 0 && <td colSpan={from} />}
                        <td colSpan={span}>
                          <Tooltip title={
                            <Flex vertical>
                              <strong>{p.number} · {p.name}</strong>
                              <span>{t(`enums.projectStatus.${p.status}`)}</span>
                              <span>{f.dateTime(p.planStart)} – {f.dateTime(p.planEnd)}</span>
                              {p.customerName && <span>{p.customerName}</span>}
                            </Flex>
                          }>
                            <div className="calendar-bar" style={{ background: p.color, opacity: p.status === 'Draft' || p.status === 'Returned' ? 0.55 : 1 }}
                              onClick={() => navigate(`/projects/${p.id}`)}>
                              {p.number} - {p.name}
                            </div>
                          </Tooltip>
                        </td>
                        {to < days.length - 1 && <td colSpan={days.length - 1 - to} />}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Spin>
      </Card>
    </>
  );
}
