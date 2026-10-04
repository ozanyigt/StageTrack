import { PlusOutlined } from '@ant-design/icons';
import { Badge, Button, Card, Flex, Input, Select, Table, Typography } from 'antd';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { projectApi } from '../../api/endpoints';
import { PROJECT_STATUSES, type ProjectStatus } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { ProjectStatusTag } from '../../components/StatusTags';
import { useFormat } from '../../utils/format';
import { useDebounced } from '../../utils/useDebounced';
import { ProjectFormModal } from './ProjectFormModal';

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
  const [createOpen, setCreateOpen] = useState(false);
  const search = useDebounced(text, 300);

  const list = useQuery({
    queryKey: ['projects', search, statuses, page],
    queryFn: () => projectApi.list({ text: search, statuses, skipCount: (page - 1) * PAGE_SIZE, maxResultCount: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('projects.title')}</Typography.Title>
        {can(Permissions.ProjectsManage) && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>{t('projects.create')}</Button>
        )}
      </div>
      <Card size="small">
        <Flex gap={8} wrap style={{ marginBottom: 12 }}>
          <Input.Search allowClear placeholder={t('projects.searchPlaceholder')} value={text}
            onChange={(e) => { setText(e.target.value); setPage(1); }} style={{ maxWidth: 320 }} />
          <Select mode="multiple" allowClear placeholder={t('projects.status')} value={statuses} style={{ minWidth: 260 }}
            onChange={(v) => { setStatuses(v); setPage(1); }}
            options={PROJECT_STATUSES.map((s) => ({ value: s, label: t(`enums.projectStatus.${s}`) }))} />
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
      <ProjectFormModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={(p) => navigate(`/projects/${p.id}`)} />
    </>
  );
}
