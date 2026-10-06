import { Card, Input, Table, Tag, Typography } from 'antd';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auditLogApi } from '../../api/endpoints';
import type { AuditLog } from '../../api/types';
import { ExportButton } from '../../components/ExcelButtons';
import { fetchAllPages } from '../../utils/excel';
import { formatDateTime } from '../../utils/format';
import { useDebounced } from '../../utils/useDebounced';

const PAGE_SIZE = 50;

/** Who deleted what and when (sensitive operations of the current location). */
export function AuditLogPage() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(text, 300);
  const list = useQuery({
    queryKey: ['audit-logs', search, page],
    queryFn: () => auditLogApi.list({ text: search, skipCount: (page - 1) * PAGE_SIZE, maxResultCount: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const actionLabel = (a: string) => t(`auditLog.actions.${a}`, { defaultValue: a });
  const userLabel = (x: AuditLog) => x.userFullName ?? x.userName ?? '—';

  return (
    <>
      <div className="page-header">
        <div>
          <Typography.Title level={3}>{t('auditLog.title')}</Typography.Title>
          <Typography.Text type="secondary">{t('auditLog.subtitle')}</Typography.Text>
        </div>
        <ExportButton
          fileName={t('auditLog.title')}
          load={() => fetchAllPages((skipCount, maxResultCount) => auditLogApi.list({ text: search, skipCount, maxResultCount }))}
          columns={[
            { header: t('auditLog.time'), value: (x: AuditLog) => formatDateTime(x.creationTime), width: 18 },
            { header: t('auditLog.action'), value: (x: AuditLog) => actionLabel(x.action), width: 22 },
            { header: t('auditLog.description'), value: (x: AuditLog) => x.description, width: 60 },
            { header: t('auditLog.user'), value: userLabel, width: 24 },
            { header: t('auditLog.impersonator'), value: (x: AuditLog) => x.impersonatorName ?? '', width: 24 },
          ]}
        />
      </div>
      <Card size="small">
        <Input.Search allowClear placeholder={t('auditLog.search')} value={text} style={{ maxWidth: 360, marginBottom: 12 }}
          onChange={(e) => { setText(e.target.value); setPage(1); }} />
        <Table<AuditLog>
          size="small"
          rowKey="id"
          loading={list.isFetching}
          dataSource={list.data?.items}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.totalCount, onChange: setPage, showSizeChanger: false }}
          columns={[
            { title: t('auditLog.time'), width: 160, render: (_, x) => formatDateTime(x.creationTime) },
            { title: t('auditLog.action'), width: 170, render: (_, x) => <Tag color="red">{actionLabel(x.action)}</Tag> },
            { title: t('auditLog.description'), dataIndex: 'description' },
            {
              title: t('auditLog.user'),
              width: 220,
              render: (_, x) => (
                <>
                  {userLabel(x)}
                  {x.impersonatorName && (
                    <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      {t('auditLog.viaImpersonation', { name: x.impersonatorName })}
                    </Typography.Text>
                  )}
                </>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
