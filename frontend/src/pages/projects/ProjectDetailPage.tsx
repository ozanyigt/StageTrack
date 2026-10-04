import {
  ArrowLeftOutlined, DeleteOutlined, DownOutlined, EditOutlined, FileAddOutlined, PlusOutlined, ScanOutlined, WarningOutlined,
} from '@ant-design/icons';
import {
  Alert, App, Button, Card, Descriptions, Dropdown, Flex, InputNumber, Progress, Skeleton, Space, Table, Tabs, Tag, Tooltip, Typography,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { projectApi, quoteApi, warehouseApi } from '../../api/endpoints';
import type { Project, ProjectStatus } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { EquipmentSelect } from '../../components/Selects';
import { ProjectStatusTag, QuoteStatusTag } from '../../components/StatusTags';
import { useErrorToast } from '../../utils/errors';
import { useFormat } from '../../utils/format';
import { ProjectFormModal } from './ProjectFormModal';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can, company } = useAuth();
  const { modal, message } = App.useApp();
  const f = useFormat();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [newEquipment, setNewEquipment] = useState<string>();
  const [newQuantity, setNewQuantity] = useState<number>(1);

  const project = useQuery({ queryKey: ['project', id], queryFn: () => projectApi.get(id!) });
  const quotes = useQuery({ queryKey: ['quotes', 'project', id], queryFn: () => quoteApi.list({ projectId: id, maxResultCount: 50 }), enabled: can(Permissions.Quotes) });
  const movements = useQuery({ queryKey: ['movements', 'project', id], queryFn: () => warehouseApi.movements({ projectId: id, maxResultCount: 100 }), enabled: can(Permissions.Warehouse) });

  const setProject = (p: Project) => {
    queryClient.setQueryData(['project', id], p);
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const changeStatus = useMutation({ mutationFn: (s: ProjectStatus) => projectApi.changeStatus(id!, s), onSuccess: setProject, onError: showError });
  const addEquipment = useMutation({
    mutationFn: () => projectApi.addEquipment(id!, newEquipment!, newQuantity),
    onSuccess: (p) => { setProject(p); setNewEquipment(undefined); setNewQuantity(1); },
    onError: showError,
  });
  const updateLine = useMutation({
    mutationFn: ({ lineId, quantity }: { lineId: string; quantity: number }) => projectApi.updateEquipment(id!, lineId, quantity),
    onSuccess: setProject,
    onError: showError,
  });
  const removeLine = useMutation({ mutationFn: (lineId: string) => projectApi.removeEquipment(id!, lineId), onSuccess: setProject, onError: showError });
  const remove = useMutation({
    mutationFn: () => projectApi.remove(id!),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); navigate('/projects'); },
    onError: showError,
  });
  const createQuote = useMutation({
    mutationFn: () => quoteApi.create(id!),
    onSuccess: (q) => { message.success(t('quotes.created', { number: q.number })); navigate(`/quotes/${q.id}`); },
    onError: showError,
  });

  if (project.isLoading || !project.data) return <Skeleton active />;
  const p = project.data;
  const manage = can(Permissions.ProjectsManage) && p.isEditable;
  const totalOut = p.equipment.reduce((s, e) => s + e.outQuantity, 0);
  const totalPlanned = p.equipment.reduce((s, e) => s + e.quantity, 0);

  return (
    <>
      <div className="page-header">
        <Space align="center" wrap>
          <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/projects')} aria-label={t('common.back')} />
          <span style={{ width: 12, height: 12, borderRadius: 3, background: p.color, display: 'inline-block' }} />
          <Typography.Title level={3}>{p.number} · {p.name}</Typography.Title>
          <ProjectStatusTag status={p.status} />
        </Space>
        <Space wrap>
          {can(Permissions.ProjectsChangeStatus) && p.allowedStatuses.length > 0 && (
            <Dropdown
              menu={{
                items: p.allowedStatuses.map((s) => ({ key: s, label: t(`enums.projectStatus.${s}`), onClick: () => changeStatus.mutate(s) })),
              }}
            >
              <Button loading={changeStatus.isPending}>
                {t('projects.changeStatus')} <DownOutlined />
              </Button>
            </Dropdown>
          )}
          {can(Permissions.WarehouseScan) && (
            <Button icon={<ScanOutlined />} onClick={() => navigate(`/warehouse/scan/${p.id}`)}>{t('projects.openScan')}</Button>
          )}
          {can(Permissions.QuotesManage) && (
            <Button icon={<FileAddOutlined />} loading={createQuote.isPending} onClick={() => createQuote.mutate()}>{t('projects.createQuote')}</Button>
          )}
          {manage && <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>{t('common.edit')}</Button>}
          {can(Permissions.ProjectsManage) && (p.status === 'Draft' || p.status === 'Cancelled') && (
            <Button danger icon={<DeleteOutlined />} onClick={() => modal.confirm({ title: t('projects.deleteConfirm'), onOk: () => remove.mutateAsync() })} />
          )}
        </Space>
      </div>

      {p.shortageCount > 0 && (
        <Alert type="warning" showIcon icon={<WarningOutlined />} style={{ marginBottom: 12 }}
          message={t('projects.shortageAlert', { count: p.shortageCount })} description={t('projects.shortageHint')} />
      )}

      <Card size="small">
        <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
          <Descriptions.Item label={t('projects.customer')}>{p.customerName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('projects.venue')}>{p.venue ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('projects.warehouse')}>{p.stockLocationName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('projects.planPeriod')}>{f.dateTime(p.planStart)} – {f.dateTime(p.planEnd)}</Descriptions.Item>
          <Descriptions.Item label={t('projects.usePeriod')}>{p.useStart ? `${f.dateTime(p.useStart)} – ${f.dateTime(p.useEnd)}` : '—'}</Descriptions.Item>
          <Descriptions.Item label={t('projects.rentalDays')}>{p.rentalDays}</Descriptions.Item>
          <Descriptions.Item label={t('projects.type')}>{p.projectType ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('projects.packed')}>
            <Progress percent={totalPlanned ? Math.round((totalOut / totalPlanned) * 100) : 0} size="small" style={{ width: 160, margin: 0 }}
              format={() => `${totalOut}/${totalPlanned}`} />
          </Descriptions.Item>
          {p.notes && <Descriptions.Item label={t('common.notes')}>{p.notes}</Descriptions.Item>}
        </Descriptions>
      </Card>

      <Card size="small" style={{ marginTop: 12 }}>
        <Tabs
          items={[
            {
              key: 'equipment',
              label: `${t('projects.equipmentTab')} (${p.equipment.length})`,
              children: (
                <>
                  {manage && (
                    <Flex gap={8} wrap style={{ marginBottom: 12 }}>
                      <EquipmentSelect value={newEquipment} onChange={setNewEquipment} style={{ minWidth: 320, flex: 1, maxWidth: 520 }} />
                      <InputNumber min={1} value={newQuantity} onChange={(v) => setNewQuantity(v ?? 1)} style={{ width: 100 }} aria-label={t('projects.quantity')} />
                      <Button type="primary" icon={<PlusOutlined />} disabled={!newEquipment} loading={addEquipment.isPending} onClick={() => addEquipment.mutate()}>
                        {t('common.add')}
                      </Button>
                    </Flex>
                  )}
                  <Table
                    size="small"
                    rowKey="id"
                    pagination={false}
                    dataSource={p.equipment}
                    scroll={{ x: 900 }}
                    columns={[
                      { title: t('equipment.code'), dataIndex: 'equipmentCode', width: 110, render: (v, e) => <Link to={`/equipment/${e.equipmentId}`}>{v}</Link> },
                      { title: t('equipment.name'), dataIndex: 'equipmentName', ellipsis: true },
                      {
                        title: t('projects.quantity'),
                        dataIndex: 'quantity',
                        width: 110,
                        render: (q: number, e) =>
                          manage ? (
                            <InputNumber size="small" min={1} defaultValue={q} key={`${e.id}-${q}`}
                              onBlur={(ev) => { const v = Number(ev.target.value); if (v > 0 && v !== q) updateLine.mutate({ lineId: e.id, quantity: v }); }}
                              onPressEnter={(ev) => (ev.target as HTMLInputElement).blur()} />
                          ) : q,
                      },
                      {
                        title: <Tooltip title={t('projects.availabilityHint')}>{t('projects.available')}</Tooltip>,
                        width: 150,
                        render: (_, e) => (
                          <Space size={4}>
                            <span>{e.available} / {e.stock}</span>
                            {e.shortage > 0 ? <Tag color="red">{t('projects.shortage', { count: e.shortage })}</Tag> : <Tag color="green">{t('projects.ok')}</Tag>}
                          </Space>
                        ),
                      },
                      { title: t('projects.plannedElsewhere'), dataIndex: 'plannedElsewhere', width: 110, align: 'end', responsive: ['lg'] },
                      { title: t('projects.out'), dataIndex: 'outQuantity', width: 80, align: 'end' },
                      { title: t('projects.returned'), dataIndex: 'returnedQuantity', width: 80, align: 'end', responsive: ['lg'] },
                      {
                        title: t('equipment.dailyPrice'), dataIndex: 'rentalPrice', width: 120, align: 'end', responsive: ['xl'],
                        render: (v: number) => f.money(v, company?.defaultCurrency ?? 'TRY'),
                      },
                      {
                        title: '', width: 50,
                        render: (_, e) => manage && (
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} onClick={() => removeLine.mutate(e.id)} />
                        ),
                      },
                    ]}
                  />
                </>
              ),
            },
            ...(can(Permissions.Quotes)
              ? [{
                  key: 'quotes',
                  label: `${t('projects.quotesTab')} (${quotes.data?.totalCount ?? 0})`,
                  children: (
                    <Table
                      size="small"
                      rowKey="id"
                      pagination={false}
                      dataSource={quotes.data?.items}
                      onRow={(q) => ({ onClick: () => navigate(`/quotes/${q.id}`), style: { cursor: 'pointer' } })}
                      columns={[
                        { title: t('quotes.number'), render: (_, q) => `${q.number} / R${q.revision}` },
                        { title: t('quotes.status'), dataIndex: 'status', render: (s) => <QuoteStatusTag status={s} /> },
                        { title: t('quotes.issueDate'), dataIndex: 'issueDate', render: (v) => f.date(v) },
                        { title: t('quotes.grandTotal'), align: 'end' as const, render: (_, q) => f.money(q.grandTotal, q.currency) },
                      ]}
                    />
                  ),
                }]
              : []),
            ...(can(Permissions.Warehouse)
              ? [{
                  key: 'movements',
                  label: t('projects.movementsTab'),
                  children: (
                    <Table
                      size="small"
                      rowKey="id"
                      dataSource={movements.data?.items}
                      pagination={{ pageSize: 20, hideOnSinglePage: true }}
                      scroll={{ x: 700 }}
                      columns={[
                        { title: t('movements.time'), dataIndex: 'creationTime', width: 140, render: (v) => f.utcDateTime(v) },
                        { title: t('movements.action'), dataIndex: 'action', width: 130, render: (a) => t(`enums.movementAction.${a}`) },
                        { title: t('movements.equipment'), render: (_, m) => `${m.equipmentCode} · ${m.equipmentName}`, ellipsis: true },
                        { title: t('movements.unit'), dataIndex: 'unitInternalRef', width: 140 },
                        { title: t('movements.user'), dataIndex: 'userFullName', width: 150 },
                      ]}
                    />
                  ),
                }]
              : []),
          ]}
        />
      </Card>

      <ProjectFormModal open={editOpen} project={p} onClose={() => setEditOpen(false)} onSaved={(saved) => { setProject(saved); setEditOpen(false); }} />
    </>
  );
}
