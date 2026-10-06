import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Input, Segmented, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { quoteApi } from '../../api/endpoints';
import { QUOTE_JOB_VIEWS, type QuoteJob, type QuoteJobView, type QuoteListItem } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { ExportButton } from '../../components/ExcelButtons';
import { ProjectStatusTag, QuoteStatusTag } from '../../components/StatusTags';
import { fetchAllPages } from '../../utils/excel';
import { useFormat } from '../../utils/format';
import { useDebounced } from '../../utils/useDebounced';
import { ProjectFormModal } from '../projects/ProjectFormModal';
import { QuoteStatusControl } from './QuoteStatusControl';

const PAGE_SIZE = 25;

/**
 * Sales list: one row per job that is still with the customer (or lost), with its newest quote.
 * Accepting a quote confirms the job and it moves to Projects.
 */
export function QuoteListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const f = useFormat();
  const [params, setParams] = useSearchParams();
  const view = (QUOTE_JOB_VIEWS as readonly string[]).includes(params.get('view') ?? '') ? (params.get('view') as QuoteJobView) : 'Active';
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const search = useDebounced(text, 300);

  const list = useQuery({
    queryKey: ['quote-jobs', view, search, page],
    queryFn: () => quoteApi.jobs({ view, text: search, skipCount: (page - 1) * PAGE_SIZE, maxResultCount: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const openJob = (job: QuoteJob) => navigate(`/quotes/jobs/${job.project.id}`);
  const openQuote = (q: QuoteListItem) => navigate(`/quotes/${q.id}`);

  const quoteCell = (q?: QuoteListItem | null) =>
    q ? (
      <Space size={4}>
        <Typography.Link onClick={(e) => { e.stopPropagation(); openQuote(q); }}>{q.number}</Typography.Link>
        <Tag bordered={false}>R{q.revision}</Tag>
      </Space>
    ) : (
      <Typography.Text type="secondary">{t('salesJobs.noQuote')}</Typography.Text>
    );

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('quotes.title')}</Typography.Title>
        <Space wrap>
          <ExportButton
            fileName={t('quotes.title')}
            load={() => fetchAllPages((skipCount, maxResultCount) => quoteApi.jobs({ view, text: search, skipCount, maxResultCount }))}
            columns={[
              { header: t('projectExtra.projectNumber'), value: (j: QuoteJob) => j.project.number, width: 10 },
              { header: t('salesJobs.job'), value: (j: QuoteJob) => j.project.name, width: 36 },
              { header: t('quotes.customer'), value: (j: QuoteJob) => j.project.customerName, width: 28 },
              { header: t('projects.planStart'), value: (j: QuoteJob) => new Date(j.project.planStart), width: 16 },
              { header: t('quotes.number'), value: (j: QuoteJob) => (j.latestQuote ? `${j.latestQuote.number} / R${j.latestQuote.revision}` : ''), width: 18 },
              { header: t('quotes.status'), value: (j: QuoteJob) => (j.latestQuote ? t(`enums.quoteStatus.${j.latestQuote.status}`) : ''), width: 14 },
              { header: t('quotes.grandTotal'), value: (j: QuoteJob) => j.latestQuote?.grandTotal ?? null, width: 16 },
              { header: t('projectExtra.currency'), value: (j: QuoteJob) => j.latestQuote?.currency ?? '', width: 8 },
              { header: t('salesJobs.rejectionReason'), value: (j: QuoteJob) => j.latestQuote?.rejectionReason ?? '', width: 36 },
            ]}
          />
          {can(Permissions.QuotesManage) && can(Permissions.ProjectsManage) && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              {t('salesJobs.newQuote')}
            </Button>
          )}
        </Space>
      </div>
      <Card size="small">
        <Flex gap={8} wrap justify="space-between" style={{ marginBottom: 12 }}>
          <Segmented
            value={view}
            onChange={(v) => {
              setParams(v === 'Active' ? {} : { view: v as string });
              setPage(1);
            }}
            options={QUOTE_JOB_VIEWS.map((v) => ({ value: v, label: t(`salesJobs.view.${v}`) }))}
          />
          <Input.Search
            allowClear
            placeholder={t('quotes.searchPlaceholder')}
            value={text}
            onChange={(e) => { setText(e.target.value); setPage(1); }}
            style={{ maxWidth: 320 }}
          />
        </Flex>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          {t(`salesJobs.viewHint.${view}`)}
        </Typography.Paragraph>
        <Table<QuoteJob>
          size="small"
          rowKey={(j) => j.project.id}
          loading={list.isFetching}
          dataSource={list.data?.items}
          scroll={{ x: 1150 }}
          onRow={(j) => ({ onClick: () => openJob(j), style: { cursor: 'pointer' } })}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.totalCount, onChange: setPage, showSizeChanger: false }}
          expandable={{
            rowExpandable: (j) => j.quotes.length > 1,
            expandedRowRender: (j) => (
              <Table<QuoteListItem>
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={j.quotes}
                onRow={(q) => ({ onClick: () => openQuote(q), style: { cursor: 'pointer' } })}
                columns={[
                  { title: t('quotes.number'), render: (_, q) => `${q.number} / R${q.revision}` },
                  { title: t('quotes.issueDate'), dataIndex: 'issueDate', render: (v) => f.date(v) },
                  { title: t('quotes.status'), dataIndex: 'status', render: (s) => <QuoteStatusTag status={s} /> },
                  { title: t('quotes.grandTotal'), align: 'end', render: (_, q) => f.money(q.grandTotal, q.currency) },
                ]}
              />
            ),
          }}
          columns={[
            { title: '#', width: 70, render: (_, j) => j.project.number },
            {
              title: t('salesJobs.job'),
              ellipsis: true,
              render: (_, j) => (
                <Space size={6}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: j.project.color, display: 'inline-block' }} />
                  {j.project.name}
                </Space>
              ),
            },
            { title: t('quotes.customer'), width: 200, ellipsis: true, render: (_, j) => j.project.customerName },
            { title: t('projects.planPeriod'), width: 200, render: (_, j) => f.period(j.project.planStart, j.project.planEnd) },
            {
              title: t('salesJobs.latestQuote'),
              width: 260,
              render: (_, j) => (
                <Space size={4} style={{ whiteSpace: 'nowrap' }}>
                  {quoteCell(j.latestQuote)}
                  {j.quotes.length > 1 && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {t('salesJobs.revisionCount', { count: j.quotes.length })}
                    </Typography.Text>
                  )}
                </Space>
              ),
            },
            {
              title: t('quotes.status'),
              width: 170,
              render: (_, j) => {
                const q = j.latestQuote;
                if (!q) return null;
                const control = can(Permissions.QuotesManage) ? (
                  <span onClick={(e) => e.stopPropagation()}>
                    <QuoteStatusControl quoteId={q.id} status={q.status} allowedStatuses={q.allowedStatuses} size="small" />
                  </span>
                ) : (
                  <QuoteStatusTag status={q.status} />
                );
                return q.rejectionReason ? <Tooltip title={q.rejectionReason}><span>{control}</span></Tooltip> : control;
              },
            },
            ...(view === 'Active'
              ? []
              : [{ title: t('salesJobs.jobStatus'), width: 120, render: (_: unknown, j: QuoteJob) => <ProjectStatusTag status={j.project.status} /> }]),
            {
              title: t('quotes.grandTotal'),
              width: 150,
              align: 'end' as const,
              render: (_: unknown, j: QuoteJob) => (j.latestQuote ? f.money(j.latestQuote.grandTotal, j.latestQuote.currency) : '—'),
            },
          ]}
        />
      </Card>
      <ProjectFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onJobCreated={(q) => {
          setCreateOpen(false);
          queryClient.invalidateQueries({ queryKey: ['quote-jobs'] });
          navigate(`/quotes/jobs/${q.projectId}`);
        }}
      />
    </>
  );
}
