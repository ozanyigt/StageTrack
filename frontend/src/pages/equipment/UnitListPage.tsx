import { QrcodeOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Input, Select, Table, Tag, Typography } from 'antd';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { unitApi } from '../../api/endpoints';
import { UNIT_STATUSES, type Label, type UnitStatus } from '../../api/types';
import { QrLabelModal } from '../../components/QrLabelModal';
import { StockLocationSelect } from '../../components/Selects';
import { UnitStatusTag } from '../../components/StatusTags';
import { useErrorToast } from '../../utils/errors';
import { useDebounced } from '../../utils/useDebounced';

const PAGE_SIZE = 50;

/** All devices across equipment, like Rentman's "Serial numbers" screen; also finds a device by its label code. */
export function UnitListPage() {
  const { t } = useTranslation();
  const showError = useErrorToast();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<UnitStatus>();
  const [locationId, setLocationId] = useState<string>();
  const [page, setPage] = useState(1);
  const [qr, setQr] = useState<{ title: string; subtitle: string; labels: Label[] } | null>(null);
  const search = useDebounced(text, 300);

  const list = useQuery({
    queryKey: ['units', 'all', search, status, locationId, page],
    queryFn: () =>
      unitApi.list({ text: search, status, stockLocationId: locationId, skipCount: (page - 1) * PAGE_SIZE, maxResultCount: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('units.allTitle')}</Typography.Title>
      </div>
      <Card size="small">
        <Flex gap={8} wrap style={{ marginBottom: 12 }}>
          <Input.Search allowClear placeholder={t('units.searchPlaceholder')} value={text}
            onChange={(e) => { setText(e.target.value); setPage(1); }} style={{ maxWidth: 360 }} />
          <Select allowClear placeholder={t('units.status')} value={status} style={{ width: 160 }}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={UNIT_STATUSES.map((s) => ({ value: s, label: t(`enums.unitStatus.${s}`) }))} />
          <StockLocationSelect placeholder={t('units.location')} value={locationId} style={{ width: 180 }}
            onChange={(v) => { setLocationId(v); setPage(1); }} />
        </Flex>
        <Table
          size="small"
          rowKey="id"
          loading={list.isFetching}
          dataSource={list.data?.items}
          scroll={{ x: 900 }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.totalCount, onChange: setPage, showSizeChanger: false }}
          columns={[
            { title: t('equipment.code'), dataIndex: 'equipmentCode', width: 110, render: (v, u) => <Link to={`/equipment/${u.equipmentId}`}>{v}</Link> },
            { title: t('equipment.name'), dataIndex: 'equipmentName', ellipsis: true },
            { title: t('units.internalRef'), dataIndex: 'internalRef', width: 150 },
            { title: t('units.serialNumber'), dataIndex: 'serialNumber', width: 140 },
            { title: t('units.location'), dataIndex: 'stockLocationName', width: 110 },
            { title: t('units.status'), dataIndex: 'status', width: 120, render: (s) => <UnitStatusTag status={s} /> },
            {
              title: t('units.currentProject'),
              width: 200,
              ellipsis: true,
              render: (_, u) => (u.currentProjectId ? <Link to={`/projects/${u.currentProjectId}`}>{u.currentProjectNumber} · {u.currentProjectName}</Link> : '—'),
            },
            {
              title: t('units.labels'),
              width: 110,
              render: (_, u) => (
                <Flex gap={4} align="center">
                  {u.labelCount ? <Tag color="green">{u.labelCount}</Tag> : <Tag color="orange">{t('labels.noLabel')}</Tag>}
                  {u.labelCount > 0 && (
                    <Button size="small" type="text" icon={<QrcodeOutlined />} aria-label={t('labels.showQr')}
                      onClick={() => unitApi.labels(u.id).then((labels) => setQr({ title: u.equipmentName, subtitle: u.internalRef, labels })).catch(showError)} />
                  )}
                </Flex>
              ),
            },
          ]}
        />
      </Card>
      <QrLabelModal title={qr?.title ?? ''} subtitle={qr?.subtitle} labels={qr?.labels ?? null} onClose={() => setQr(null)} />
    </>
  );
}
