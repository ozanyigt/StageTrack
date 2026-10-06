import { Card, Flex, Input, Select, Table, Typography } from 'antd';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { warehouseApi } from '../../api/endpoints';
import { MOVEMENT_ACTIONS, type Movement, type MovementAction } from '../../api/types';
import { ExportButton } from '../../components/ExcelButtons';
import { fetchAllPages } from '../../utils/excel';
import { useFormat } from '../../utils/format';
import { useDebounced } from '../../utils/useDebounced';
import { Permissions, useAuth } from '../../auth/AuthContext';

const PAGE_SIZE = 50;

/** Every scan and label change, newest first (Rentman "Warehouse tracking log"). */
export function MovementsPage() {
  const { t } = useTranslation();
  const f = useFormat();
  const { can } = useAuth();
  const [text, setText] = useState('');
  const [action, setAction] = useState<MovementAction>();
  const [page, setPage] = useState(1);
  const search = useDebounced(text, 300);

  const list = useQuery({
    queryKey: ['movements', 'all', search, action, page],
    queryFn: () => warehouseApi.movements({ text: search, action, skipCount: (page - 1) * PAGE_SIZE, maxResultCount: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('movements.title')}</Typography.Title>
        <ExportButton<Movement>
          fileName={t('movements.title')}
          load={() => fetchAllPages((skipCount, maxResultCount) => warehouseApi.movements({ text: search, action, skipCount, maxResultCount }))}
          columns={[
            { header: t('movements.time'), value: (m) => f.utcDateTime(m.creationTime) },
            { header: t('movements.action'), value: (m) => t(`enums.movementAction.${m.action}`) },
            { header: t('movements.equipmentCode'), value: (m) => m.equipmentCode },
            { header: t('movements.equipment'), value: (m) => m.equipmentName },
            { header: t('movements.unit'), value: (m) => m.unitInternalRef },
            { header: t('movements.serialNumber'), value: (m) => m.unitSerialNumber },
            { header: t('movements.project'), value: (m) => (m.projectNumber ? `${m.projectNumber} · ${m.projectName}` : null) },
            { header: t('movements.user'), value: (m) => m.userFullName ?? t('movements.system') },
            { header: t('movements.label'), value: (m) => m.labelCode },
            { header: t('movements.quantity'), value: (m) => m.quantity },
            { header: t('movements.note'), value: (m) => m.note },
          ]}
        />
      </div>
      <Card size="small">
        <Flex gap={8} wrap style={{ marginBottom: 12 }}>
          <Input.Search allowClear placeholder={t('movements.searchPlaceholder')} value={text}
            onChange={(e) => { setText(e.target.value); setPage(1); }} style={{ maxWidth: 320 }} />
          <Select allowClear placeholder={t('movements.action')} value={action} style={{ width: 200 }}
            onChange={(v) => { setAction(v); setPage(1); }}
            options={MOVEMENT_ACTIONS.filter((a) => a !== 'ProjectStatusChanged').map((a) => ({ value: a, label: t(`enums.movementAction.${a}`) }))} />
        </Flex>
        <Table
          size="small"
          rowKey="id"
          loading={list.isFetching}
          dataSource={list.data?.items}
          scroll={{ x: 1200 }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.totalCount, onChange: setPage, showSizeChanger: false }}
          columns={[
            { title: t('movements.time'), dataIndex: 'creationTime', width: 140, render: (v) => f.utcDateTime(v) },
            { title: t('movements.equipment'), render: (_, m) => <Link to={`/equipment/${m.equipmentId}`}>{m.equipmentCode} · {m.equipmentName}</Link>, ellipsis: true },
            { title: t('movements.user'), dataIndex: 'userFullName', width: 150, render: (v) => v ?? t('movements.system') },
            { title: t('movements.action'), dataIndex: 'action', width: 140, render: (a) => t(`enums.movementAction.${a}`) },
            {
              title: t('movements.project'),
              width: 240,
              ellipsis: true,
              render: (_, m) =>
                !m.projectId ? (
                  '—'
                ) : can(Permissions.Projects) ? (
                  <Link to={`/projects/${m.projectId}`}>{m.projectNumber} · {m.projectName}</Link>
                ) : (
                  `${m.projectNumber} · ${m.projectName}`
                ),
            },
            { title: t('movements.unit'), dataIndex: 'unitInternalRef', width: 140 },
            { title: t('movements.serialNumber'), dataIndex: 'unitSerialNumber', width: 130, responsive: ['xl'] },
            { title: t('movements.label'), dataIndex: 'labelCode', width: 110 },
            { title: t('movements.note'), dataIndex: 'note', width: 220, ellipsis: true, render: (v) => v ?? '' },
          ]}
        />
      </Card>
    </>
  );
}
