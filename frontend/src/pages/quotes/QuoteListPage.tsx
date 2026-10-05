import { Card, Flex, Input, Select, Table, Typography } from 'antd';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { quoteApi } from '../../api/endpoints';
import { QUOTE_STATUSES, type QuoteStatus } from '../../api/types';
import { ExportButton } from '../../components/ExcelButtons';
import { QuoteStatusTag } from '../../components/StatusTags';
import { fetchAllPages } from '../../utils/excel';
import { useFormat } from '../../utils/format';
import { useDebounced } from '../../utils/useDebounced';

const PAGE_SIZE = 25;

export function QuoteListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const f = useFormat();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<QuoteStatus>();
  const [page, setPage] = useState(1);
  const search = useDebounced(text, 300);

  const list = useQuery({
    queryKey: ['quotes', search, status, page],
    queryFn: () => quoteApi.list({ text: search, status, skipCount: (page - 1) * PAGE_SIZE, maxResultCount: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('quotes.title')}</Typography.Title>
        <Flex gap={12} align="center" wrap>
          <Typography.Text type="secondary">{t('quotes.createHint')}</Typography.Text>
          <ExportButton
            fileName={t('quotes.title')}
            load={() => fetchAllPages((skipCount, maxResultCount) => quoteApi.list({ text: search, status, skipCount, maxResultCount }))}
            columns={[
              { header: t('quotes.number'), value: (q) => `${q.number} / R${q.revision}`, width: 18 },
              { header: t('projectExtra.projectNumber'), value: (q) => q.projectNumber, width: 10 },
              { header: t('quotes.project'), value: (q) => q.projectName, width: 36 },
              { header: t('quotes.customer'), value: (q) => q.customerName, width: 30 },
              { header: t('quotes.issueDate'), value: (q) => new Date(q.issueDate), width: 14 },
              { header: t('quotes.validUntil'), value: (q) => (q.validUntil ? new Date(q.validUntil) : null), width: 14 },
              { header: t('quotes.status'), value: (q) => t(`enums.quoteStatus.${q.status}`), width: 14 },
              { header: t('quotes.grandTotal'), value: (q) => q.grandTotal, width: 16 },
              { header: t('projectExtra.currency'), value: (q) => q.currency, width: 8 },
            ]}
          />
        </Flex>
      </div>
      <Card size="small">
        <Flex gap={8} wrap style={{ marginBottom: 12 }}>
          <Input.Search allowClear placeholder={t('quotes.searchPlaceholder')} value={text}
            onChange={(e) => { setText(e.target.value); setPage(1); }} style={{ maxWidth: 320 }} />
          <Select allowClear placeholder={t('quotes.status')} value={status} style={{ width: 180 }}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={QUOTE_STATUSES.map((s) => ({ value: s, label: t(`enums.quoteStatus.${s}`) }))} />
        </Flex>
        <Table
          size="small"
          rowKey="id"
          loading={list.isFetching}
          dataSource={list.data?.items}
          scroll={{ x: 900 }}
          onRow={(q) => ({ onClick: () => navigate(`/quotes/${q.id}`), style: { cursor: 'pointer' } })}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.totalCount, onChange: setPage, showSizeChanger: false }}
          columns={[
            { title: t('quotes.number'), width: 160, render: (_, q) => `${q.number} / R${q.revision}` },
            { title: t('quotes.project'), render: (_, q) => `${q.projectNumber} · ${q.projectName}`, ellipsis: true },
            { title: t('quotes.customer'), dataIndex: 'customerName', width: 220, ellipsis: true },
            { title: t('quotes.issueDate'), dataIndex: 'issueDate', width: 110, render: (v) => f.date(v) },
            { title: t('quotes.status'), dataIndex: 'status', width: 120, render: (s) => <QuoteStatusTag status={s} /> },
            { title: t('quotes.grandTotal'), width: 160, align: 'end', render: (_, q) => f.money(q.grandTotal, q.currency) },
          ]}
        />
      </Card>
    </>
  );
}
