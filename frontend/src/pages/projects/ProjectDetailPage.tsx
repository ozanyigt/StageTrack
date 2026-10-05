import {
  ArrowDownOutlined, ArrowLeftOutlined, ArrowUpOutlined, DeleteOutlined, DownOutlined, EditOutlined, FileAddOutlined, FilePdfOutlined,
  FolderAddOutlined, PlusOutlined, ScanOutlined, SwapOutlined, UserAddOutlined, WarningOutlined,
} from '@ant-design/icons';
import {
  Alert, App, Button, Card, Checkbox, Descriptions, Dropdown, Empty, Flex, Form, Input, InputNumber, Modal, Popconfirm, Popover, Progress,
  Select, Skeleton, Space, Table, Tabs, Tag, Tooltip, Typography, theme,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { crewApi, projectApi, quoteApi, warehouseApi } from '../../api/endpoints';
import type { Project, ProjectEquipment, ProjectSection, ProjectStatus } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { CollaborationPanel } from '../../components/CollaborationPanel';
import { EquipmentSelect } from '../../components/Selects';
import { ProjectStatusTag, QuoteStatusTag } from '../../components/StatusTags';
import { useErrorToast } from '../../utils/errors';
import { useFormat } from '../../utils/format';
import { ProjectFormModal } from './ProjectFormModal';

const NO_SECTION = '__none__';

interface SectionDialog {
  mode: 'add' | 'rename';
  section?: ProjectSection;
  parentId?: string | null;
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can, company } = useAuth();
  const { modal, message } = App.useApp();
  const f = useFormat();
  const { token } = theme.useToken();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [newEquipment, setNewEquipment] = useState<string>();
  const [newQuantity, setNewQuantity] = useState<number>(1);
  const [newSection, setNewSection] = useState<string>(NO_SECTION);
  const [withAccessories, setWithAccessories] = useState(true);
  const [sectionDialog, setSectionDialog] = useState<SectionDialog | null>(null);
  const [sectionForm] = Form.useForm<{ name: string; parentId?: string | null }>();

  const project = useQuery({ queryKey: ['project', id], queryFn: () => projectApi.get(id!) });
  const crewView = project.data?.isCrewView ?? true;
  const quotes = useQuery({
    queryKey: ['quotes', 'project', id],
    queryFn: () => quoteApi.list({ projectId: id, maxResultCount: 50 }),
    enabled: can(Permissions.Quotes) && can(Permissions.Prices) && !crewView,
  });
  const movements = useQuery({
    queryKey: ['movements', 'project', id],
    queryFn: () => warehouseApi.movements({ projectId: id, maxResultCount: 100 }),
    enabled: can(Permissions.Warehouse) && !crewView,
  });

  const setProject = (p: Project) => {
    queryClient.setQueryData(['project', id], p);
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const run = (promise: Promise<Project>) => promise.then(setProject).catch(showError);

  const changeStatus = useMutation({ mutationFn: (s: ProjectStatus) => projectApi.changeStatus(id!, s), onSuccess: setProject, onError: showError });
  const addEquipment = useMutation({
    mutationFn: () => projectApi.addEquipment(id!, newEquipment!, newQuantity, newSection === NO_SECTION ? null : newSection, withAccessories),
    onSuccess: (p) => { setProject(p); setNewEquipment(undefined); setNewQuantity(1); },
    onError: showError,
  });
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

  const p = project.data;
  const groups = useMemo(() => {
    if (!p) return [];
    const bySection = (sectionId: string | null) =>
      p.equipment.filter((e) => (e.sectionId ?? null) === sectionId).sort((a, b) => a.sortOrder - b.sortOrder);
    const result: { section: ProjectSection | null; lines: ProjectEquipment[] }[] = [];
    const loose = bySection(null);
    if (loose.length > 0 || p.sections.length === 0) result.push({ section: null, lines: loose });
    p.sections.forEach((s) => result.push({ section: s, lines: bySection(s.id) }));
    return result;
  }, [p]);

  if (project.isLoading || !p) return <Skeleton active />;

  const manage = !crewView && can(Permissions.ProjectsManage) && p.isEditable;
  const showPrices = !crewView && p.equipment.some((e) => e.rentalPrice !== null && e.rentalPrice !== undefined);
  const currency = company?.defaultCurrency ?? 'TRY';
  const totalOut = p.equipment.reduce((s, e) => s + e.outQuantity, 0);
  const totalPlanned = p.equipment.reduce((s, e) => s + e.quantity, 0);
  const dailyTotal = p.equipment.reduce((s, e) => s + (e.rentalPrice ?? 0) * e.quantity, 0);
  const sectionOptions = [
    { value: NO_SECTION, label: t('sections.none') },
    ...p.sections.map((s) => ({ value: s.id, label: s.path })),
  ];

  const openSectionDialog = (dialog: SectionDialog) => {
    sectionForm.resetFields();
    sectionForm.setFieldsValue({ name: dialog.section?.name ?? '', parentId: dialog.section?.parentId ?? dialog.parentId ?? null });
    setSectionDialog(dialog);
  };

  const saveSection = async () => {
    const v = await sectionForm.validateFields();
    const name = v.name.trim();
    try {
      const updated = sectionDialog?.mode === 'rename' && sectionDialog.section
        ? await projectApi.renameSection(id!, sectionDialog.section.id, name, v.parentId ?? null)
        : await projectApi.addSection(id!, name, v.parentId ?? null);
      setProject(updated);
      setSectionDialog(null);
    } catch (e) {
      showError(e);
    }
  };

  const alternativesPopover = (line: ProjectEquipment) => (
    <div style={{ maxWidth: 360 }}>
      {line.alternatives.length === 0 ? (
        <Typography.Text type="secondary">{t('sections.noAlternatives')}</Typography.Text>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          {line.alternatives.map((a) => (
            <Flex key={a.equipmentId} justify="space-between" align="center" gap={12}>
              <span>
                <Link to={`/equipment/${a.equipmentId}`}>{a.code}</Link> · {a.name}
                <Typography.Text type="secondary"> ({t('sections.availableCount', { count: a.available })})</Typography.Text>
              </span>
              {manage && a.available > 0 && (
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => run(projectApi.addEquipment(id!, a.equipmentId, Math.min(line.shortage, a.available), line.sectionId ?? null, false))}
                >
                  {t('sections.addAlternative', { count: Math.min(line.shortage, a.available) })}
                </Button>
              )}
            </Flex>
          ))}
        </Space>
      )}
    </div>
  );

  const lineColumns = (lines: ProjectEquipment[]) => [
    {
      title: t('equipment.code'), dataIndex: 'equipmentCode', width: 110,
      render: (v: string, e: ProjectEquipment) => (crewView ? v : <Link to={`/equipment/${e.equipmentId}`}>{v}</Link>),
    },
    { title: t('equipment.name'), dataIndex: 'equipmentName', ellipsis: true },
    {
      title: t('projects.quantity'), dataIndex: 'quantity', width: 100,
      render: (q: number, e: ProjectEquipment) =>
        manage ? (
          <InputNumber size="small" min={1} defaultValue={q} key={`${e.id}-${q}`} style={{ width: 80 }} aria-label={t('projects.quantity')}
            onBlur={(ev) => { const v = Number(ev.target.value); if (v > 0 && v !== q) run(projectApi.updateEquipment(id!, e.id, v, e.notes)); }}
            onPressEnter={(ev) => (ev.target as HTMLInputElement).blur()} />
        ) : q,
    },
    {
      title: t('common.notes'), dataIndex: 'notes', width: 180,
      render: (n: string | null, e: ProjectEquipment) =>
        manage ? (
          <Input size="small" defaultValue={n ?? ''} key={`${e.id}-n-${n}`} maxLength={500} placeholder="—" aria-label={t('common.notes')}
            onBlur={(ev) => { const v = ev.target.value.trim(); if (v !== (n ?? '')) run(projectApi.updateEquipment(id!, e.id, e.quantity, v || null)); }}
            onPressEnter={(ev) => (ev.target as HTMLInputElement).blur()} />
        ) : n,
    },
    ...(crewView
      ? []
      : [
          {
            title: <Tooltip title={t('projects.availabilityHint')}>{t('projects.available')}</Tooltip>,
            width: 160,
            render: (_: unknown, e: ProjectEquipment) => (
              <Space size={4}>
                <span>{e.available} / {e.stock}</span>
                {e.shortage > 0 ? (
                  <Popover title={t('sections.alternatives')} content={alternativesPopover(e)} trigger="click">
                    <Tag color="red" style={{ cursor: 'pointer' }} icon={e.alternatives.length > 0 ? <SwapOutlined /> : undefined}>
                      {t('projects.shortage', { count: e.shortage })}
                    </Tag>
                  </Popover>
                ) : (
                  <Tag color="green">{t('projects.ok')}</Tag>
                )}
              </Space>
            ),
          },
          { title: t('projects.plannedElsewhere'), dataIndex: 'plannedElsewhere', width: 100, align: 'end' as const, responsive: ['lg' as const] },
          { title: t('projects.out'), dataIndex: 'outQuantity', width: 80, align: 'end' as const },
          { title: t('projects.returned'), dataIndex: 'returnedQuantity', width: 80, align: 'end' as const, responsive: ['lg' as const] },
        ]),
    ...(showPrices
      ? [{
          title: t('equipment.dailyPrice'), dataIndex: 'rentalPrice', width: 120, align: 'end' as const, responsive: ['xl' as const],
          render: (v: number | null) => (v === null || v === undefined ? '—' : f.money(v, currency)),
        }]
      : []),
    ...(manage
      ? [{
          title: '', width: 210,
          render: (_: unknown, e: ProjectEquipment) => {
            const index = lines.findIndex((l) => l.id === e.id);
            return (
              <Space size={2}>
                <Select
                  size="small"
                  value={e.sectionId ?? NO_SECTION}
                  options={sectionOptions}
                  style={{ width: 120 }}
                  popupMatchSelectWidth={false}
                  aria-label={t('sections.moveTo')}
                  onChange={(v) => run(projectApi.moveEquipment(id!, e.id, { sectionId: v === NO_SECTION ? null : v }))}
                />
                <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={index <= 0} aria-label={t('sections.moveUp')}
                  onClick={() => run(projectApi.moveEquipment(id!, e.id, { sectionId: e.sectionId ?? null, direction: -1 }))} />
                <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={index >= lines.length - 1} aria-label={t('sections.moveDown')}
                  onClick={() => run(projectApi.moveEquipment(id!, e.id, { sectionId: e.sectionId ?? null, direction: 1 }))} />
                <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t('common.delete')}
                  onClick={() => run(projectApi.removeEquipment(id!, e.id))} />
              </Space>
            );
          },
        }]
      : []),
  ];

  const sectionHeader = (section: ProjectSection | null, count: number) => {
    const siblings = section ? p.sections.filter((s) => (s.parentId ?? null) === (section.parentId ?? null)) : [];
    const index = section ? siblings.findIndex((s) => s.id === section.id) : -1;
    return (
      <Flex
        align="center"
        justify="space-between"
        gap={8}
        wrap
        style={{
          marginTop: 12,
          marginInlineStart: section && section.depth > 1 ? 24 : 0,
          padding: '6px 10px',
          borderRadius: 6,
          background: section ? (section.depth > 1 ? token.colorFillQuaternary : token.colorFillSecondary) : token.colorFillQuaternary,
        }}
      >
        <Typography.Text strong={!!section} type={section ? undefined : 'secondary'}>
          {section ? section.name : t('sections.none')} <Typography.Text type="secondary">({count})</Typography.Text>
        </Typography.Text>
        {manage && section && (
          <Space size={2}>
            {section.depth < 2 && (
              <Tooltip title={t('sections.addSub')}>
                <Button size="small" type="text" icon={<FolderAddOutlined />} aria-label={t('sections.addSub')}
                  onClick={() => openSectionDialog({ mode: 'add', parentId: section.id })} />
              </Tooltip>
            )}
            <Button size="small" type="text" icon={<EditOutlined />} aria-label={t('sections.rename')}
              onClick={() => openSectionDialog({ mode: 'rename', section })} />
            <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={index <= 0} aria-label={t('sections.moveUp')}
              onClick={() => run(projectApi.moveSection(id!, section.id, -1))} />
            <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={index >= siblings.length - 1} aria-label={t('sections.moveDown')}
              onClick={() => run(projectApi.moveSection(id!, section.id, 1))} />
            <Popconfirm title={t('sections.deleteConfirm')} onConfirm={() => run(projectApi.removeSection(id!, section.id))}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} />
            </Popconfirm>
          </Space>
        )}
      </Flex>
    );
  };

  const equipmentTab = (
    <>
      {manage && (
        <Flex gap={8} wrap align="center" style={{ marginBottom: 12 }}>
          <EquipmentSelect value={newEquipment} onChange={setNewEquipment} style={{ minWidth: 280, flex: 1, maxWidth: 460 }} />
          <InputNumber min={1} value={newQuantity} onChange={(v) => setNewQuantity(v ?? 1)} style={{ width: 90 }} aria-label={t('projects.quantity')} />
          <Select value={newSection} onChange={setNewSection} options={sectionOptions} style={{ minWidth: 180 }} aria-label={t('sections.section')} />
          <Checkbox checked={withAccessories} onChange={(e) => setWithAccessories(e.target.checked)}>{t('sections.includeAccessories')}</Checkbox>
          <Button type="primary" icon={<PlusOutlined />} disabled={!newEquipment} loading={addEquipment.isPending} onClick={() => addEquipment.mutate()}>
            {t('common.add')}
          </Button>
          <Button icon={<FolderAddOutlined />} onClick={() => openSectionDialog({ mode: 'add', parentId: null })}>{t('sections.add')}</Button>
        </Flex>
      )}
      {p.equipment.length === 0 && p.sections.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        groups.map(({ section, lines }) => (
          <div key={section?.id ?? NO_SECTION}>
            {(p.sections.length > 0 || section) && sectionHeader(section, lines.length)}
            {lines.length > 0 && (
              <div style={{ marginInlineStart: section && section.depth > 1 ? 24 : 0 }}>
                <Table size="small" rowKey="id" pagination={false} dataSource={lines} scroll={{ x: crewView ? 600 : 1000 }} columns={lineColumns(lines)} />
              </div>
            )}
          </div>
        ))
      )}
      {showPrices && (
        <Flex justify="flex-end" style={{ marginTop: 12 }}>
          <Typography.Text strong>{t('sections.dailyTotal')}: {f.money(dailyTotal, currency)}</Typography.Text>
        </Flex>
      )}
    </>
  );

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
          <Button icon={<FilePdfOutlined />} onClick={() => window.open(`/projects/${p.id}/packing-slip`, '_blank', 'noopener')}>
            {t('packingSlip.open')}
          </Button>
          {!crewView && can(Permissions.ProjectsChangeStatus) && p.allowedStatuses.length > 0 && (
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
          {!crewView && can(Permissions.WarehouseScan) && (
            <Button icon={<ScanOutlined />} onClick={() => navigate(`/warehouse/scan/${p.id}`)}>{t('projects.openScan')}</Button>
          )}
          {!crewView && can(Permissions.QuotesManage) && can(Permissions.Prices) && (
            <Button icon={<FileAddOutlined />} loading={createQuote.isPending} onClick={() => createQuote.mutate()}>{t('projects.createQuote')}</Button>
          )}
          {manage && <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>{t('common.edit')}</Button>}
          {!crewView && can(Permissions.ProjectsManage) && (p.status === 'Draft' || p.status === 'Cancelled') && (
            <Button danger icon={<DeleteOutlined />} aria-label={t('common.delete')}
              onClick={() => modal.confirm({ title: t('projects.deleteConfirm'), onOk: () => remove.mutateAsync() })} />
          )}
        </Space>
      </div>

      {!crewView && p.shortageCount > 0 && (
        <Alert type="warning" showIcon icon={<WarningOutlined />} style={{ marginBottom: 12 }}
          message={t('projects.shortageAlert', { count: p.shortageCount })} description={t('projects.shortageHint')} />
      )}
      {crewView && <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('crewTab.crewViewHint')} />}

      <Card size="small">
        <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
          <Descriptions.Item label={t('projects.customer')}>{p.customerName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('projects.venue')}>{p.venue ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('projects.warehouse')}>{p.stockLocationName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('projects.planPeriod')}>{f.dateTime(p.planStart)} – {f.dateTime(p.planEnd)}</Descriptions.Item>
          <Descriptions.Item label={t('projects.usePeriod')}>{p.useStart ? `${f.dateTime(p.useStart)} – ${f.dateTime(p.useEnd)}` : '—'}</Descriptions.Item>
          <Descriptions.Item label={t('projects.rentalDays')}>{p.rentalDays}</Descriptions.Item>
          <Descriptions.Item label={t('projects.type')}>{p.projectType ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('projectExtra.accountManager')}>{p.accountManagerName ?? '—'}</Descriptions.Item>
          {!crewView && <Descriptions.Item label={t('projectExtra.paymentTerms')}>{p.paymentTerms ?? '—'}</Descriptions.Item>}
          {!crewView && (
            <Descriptions.Item label={t('projects.packed')}>
              <Progress percent={totalPlanned ? Math.round((totalOut / totalPlanned) * 100) : 0} size="small" style={{ width: 160, margin: 0 }}
                format={() => `${totalOut}/${totalPlanned}`} />
            </Descriptions.Item>
          )}
          {p.notes && <Descriptions.Item label={t('common.notes')}>{p.notes}</Descriptions.Item>}
        </Descriptions>
      </Card>

      <Card size="small" style={{ marginTop: 12 }}>
        <Tabs
          items={[
            { key: 'equipment', label: `${t('projects.equipmentTab')} (${p.equipment.length})`, children: equipmentTab },
            {
              key: 'crew',
              label: `${t('crewTab.title')} (${p.crew.length})`,
              children: <CrewTab project={p} manage={!crewView && can(Permissions.ProjectsManage)} onChange={setProject} />,
            },
            ...(!crewView && can(Permissions.Quotes) && can(Permissions.Prices)
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
            ...(!crewView && can(Permissions.Warehouse)
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
            {
              key: 'collab',
              label: t('projectExtra.notesTasksFiles'),
              children: <CollaborationPanel ownerType="Project" ownerId={p.id} readOnly={crewView} />,
            },
          ]}
        />
      </Card>

      <Modal
        open={!!sectionDialog}
        title={sectionDialog?.mode === 'rename' ? t('sections.rename') : t('sections.add')}
        onCancel={() => setSectionDialog(null)}
        onOk={saveSection}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        destroyOnHidden
      >
        <Form form={sectionForm} layout="vertical" onFinish={saveSection}>
          <Form.Item name="name" label={t('sections.name')} rules={[{ required: true, whitespace: true, message: t('validation.required') }]}
            extra={t('sections.nameHint')}>
            <Input autoFocus maxLength={128} />
          </Form.Item>
          <Form.Item name="parentId" label={t('sections.parent')}>
            <Select
              allowClear
              placeholder={t('sections.topLevel')}
              options={p.sections
                .filter((s) => s.depth === 1 && s.id !== sectionDialog?.section?.id)
                .map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <ProjectFormModal open={editOpen} project={p} onClose={() => setEditOpen(false)} onSaved={(saved) => { setProject(saved); setEditOpen(false); }} />
    </>
  );
}

function CrewTab({ project, manage, onChange }: { project: Project; manage: boolean; onChange: (p: Project) => void }) {
  const { t } = useTranslation();
  const showError = useErrorToast();
  const [userId, setUserId] = useState<string>();
  const [fn, setFn] = useState('');
  const directory = useQuery({ queryKey: ['crew-directory'], queryFn: crewApi.directory, enabled: manage });
  const run = (promise: Promise<Project>) => promise.then(onChange).catch(showError);
  const assigned = new Set(project.crew.map((c) => c.userId));

  return (
    <>
      {manage && (
        <Flex gap={8} wrap style={{ marginBottom: 12 }}>
          <Select
            showSearch
            optionFilterProp="label"
            value={userId}
            onChange={setUserId}
            placeholder={t('crewTab.pickPerson')}
            style={{ minWidth: 260 }}
            options={(directory.data ?? [])
              .filter((u) => !assigned.has(u.userId))
              .map((u) => ({ value: u.userId, label: u.jobTitle ? `${u.fullName} · ${u.jobTitle}` : u.fullName }))}
          />
          <Input value={fn} onChange={(e) => setFn(e.target.value)} placeholder={t('crewTab.function')} style={{ maxWidth: 260 }} maxLength={128} />
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            disabled={!userId}
            onClick={() => run(projectApi.addCrew(project.id, userId!, fn.trim() || null)).then(() => { setUserId(undefined); setFn(''); })}
          >
            {t('crewTab.add')}
          </Button>
        </Flex>
      )}
      <Table
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={project.crew}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('crewTab.empty')} /> }}
        scroll={{ x: 700 }}
        columns={[
          { title: t('crewTab.name'), dataIndex: 'fullName' },
          { title: t('crewTab.jobTitle'), dataIndex: 'jobTitle', render: (v) => v ?? '—' },
          {
            title: t('crewTab.function'), dataIndex: 'function', width: 220,
            render: (v: string | null, c) =>
              manage ? (
                <Input size="small" defaultValue={v ?? ''} key={`${c.id}-${v}`} maxLength={128} placeholder="—" aria-label={t('crewTab.function')}
                  onBlur={(e) => { const value = e.target.value.trim(); if (value !== (v ?? '')) run(projectApi.updateCrew(project.id, c.id, value || null)); }}
                  onPressEnter={(e) => (e.target as HTMLInputElement).blur()} />
              ) : (v ?? '—'),
          },
          { title: t('crewTab.phone'), dataIndex: 'phone', render: (v) => (v ? <a href={`tel:${v.replace(/\s/g, '')}`} dir="ltr">{v}</a> : '—') },
          { title: t('crewTab.email'), dataIndex: 'email', render: (v) => (v ? <a href={`mailto:${v}`}>{v}</a> : '—') },
          ...(manage
            ? [{
                title: '', width: 50,
                render: (_: unknown, c: { id: string }) => (
                  <Popconfirm title={t('crewTab.removeConfirm')} onConfirm={() => run(projectApi.removeCrew(project.id, c.id))}>
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} />
                  </Popconfirm>
                ),
              }]
            : []),
        ]}
      />
    </>
  );
}
