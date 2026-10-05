import { Badge, Card, Flex, Input, Select, Space, Table, Typography } from 'antd';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { projectApi } from '../../api/endpoints';
import { CONFIRMED_PROJECT_STATUSES, type ProjectStatus } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { ExportButton } from '../../components/ExcelButtons';
import { ProjectStatusTag } from '../../components/StatusTags';
import { fetchAllPages } from '../../utils/excel';
import { useFormat } from '../../utils/format';
import { useDebounced } from '../../utils/useDebounced';

const PAGE_SIZE = 25;

export function ProjectListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const f = useFormat();
  const [params] = useSearchParams();
  const initialStatus = params.get('status') as ProjectStatus | null;
  const [statuses, setStatuses] = useState<ProjectStatus[]>(initialStatus ? [initialStatus] : []);
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(text, 300);
  // Projects shows confirmed work only; jobs still waiting for the customer are on the Quotes page.
  const effectiveStatuses = statuses.length > 0 ? statuses : CONFIRMED_PROJECT_STATUSES;
  const crewOnly = !can(Permissions.Projects) && can(Permissions.AssignedProjects);

  const list = useQuery({
    queryKey: ['projects', search, effectiveStatuses, page],
    queryFn: () => projectApi.list({ text: search, statuses: effectiveStatuses, skipCount: (page - 1) * PAGE_SIZE, maxResultCount: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{crewOnly ? t('nav.myProjects') : t('projects.title')}</Typography.Title>
        <Space wrap>
          <ExportButton
            fileName={crewOnly ? t('nav.myProjects') : t('projects.title')}
            load={() => fetchAllPages((skipCount, maxResultCount) => projectApi.list({ text: search, statuses: effectiveStatuses, skipCount, maxResultCount }))}
            columns={[
              { header: t('projects.number'), value: (p) => p.number, width: 10 },
              { header: t('projects.name'), value: (p) => p.name, width: 40 },
              { header: t('projects.status'), value: (p) => t(`enums.projectStatus.${p.status}`), width: 16 },
              { header: t('projects.customer'), value: (p) => p.customerName, width: 30 },
              { header: t('projects.venue'), value: (p) => p.venue, width: 24 },
              { header: t('projects.type'), value: (p) => p.projectType, width: 16 },
              { header: t('projects.warehouse'), value: (p) => p.stockLocationName, width: 16 },
              { header: t('projects.planStart'), value: (p) => new Date(p.planStart), width: 18 },
              { header: t('projects.planEnd'), value: (p) => new Date(p.planEnd), width: 18 },
              { header: t('projects.plannedQuantity'), value: (p) => p.plannedQuantity, width: 10 },
            ]}
          />
          {!crewOnly && <Typography.Text type="secondary">{t('salesJobs.projectsHint')}</Typography.Text>}
        </Space>
      </div>
      <Card size="small">
        <Flex gap={8} wrap style={{ marginBottom: 12 }}>
          <Input.Search allowClear placeholder={t('projects.searchPlaceholder')} value={text}
            onChange={(e) => { setText(e.target.value); setPage(1); }} style={{ maxWidth: 320 }} />
          <Select mode="multiple" allowClear placeholder={t('projects.status')} value={statuses} style={{ minWidth: 260 }}
            onChange={(v) => { setStatuses(v); setPage(1); }}
            options={[...CONFIRMED_PROJECT_STATUSES, 'Cancelled' as const].map((s) => ({ value: s, label: t(`enums.projectStatus.${s}`) }))} />
        </Flex>
        <Table
          size="small"
          rowKey="id"
          loading={list.isFetching}
          dataSource={list.data?.items}
          scroll={{ x: 1000 }}
          onRow={(p) => ({ onClick: () => navigate(`/projects/${p.id}`), style: { cursor: 'pointer' } })}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.totalCount, onChange: setPage, showSizeChanger: false }}
          columns={[
            { title: '', dataIndex: 'color', width: 36, render: (c: string) => <Badge color={c} /> },
            { title: t('projects.number'), dataIndex: 'number', width: 80 },
            { title: t('projects.name'), dataIndex: 'name', ellipsis: true },
            { title: t('projects.status'), dataIndex: 'status', width: 130, render: (s) => <ProjectStatusTag status={s} /> },
            { title: t('projects.customer'), dataIndex: 'customerName', width: 200, ellipsis: true },
            { title: t('projects.venue'), dataIndex: 'venue', width: 180, ellipsis: true, responsive: ['xl'] },
            { title: t('projects.planStart'), dataIndex: 'planStart', width: 110, render: (v) => f.date(v) },
            { title: t('projects.planEnd'), dataIndex: 'planEnd', width: 110, render: (v) => f.date(v) },
            { title: t('projects.plannedQuantity'), dataIndex: 'plannedQuantity', width: 90, align: 'end' },
          ]}
        />
      </Card>
    </>
  );
}
