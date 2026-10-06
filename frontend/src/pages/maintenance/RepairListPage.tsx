import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Checkbox, Col, Dropdown, Flex, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { repairApi, supplierApi, unitApi } from '../../api/endpoints';
import { REPAIR_STATUSES, type EquipmentLookup, type Repair, type RepairStatus } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { ExportButton } from '../../components/ExcelButtons';
import { EquipmentSelect } from '../../components/Selects';
import { useErrorToast } from '../../utils/errors';
import { fetchAllPages } from '../../utils/excel';
import { useFormat } from '../../utils/format';
import { useDebounced } from '../../utils/useDebounced';
import { useGuardedForm } from '../../components/useGuardedModal';

const PAGE_SIZE = 25;

const STATUS_COLORS: Record<RepairStatus, string> = {
  Open: 'orange',
  InProgress: 'blue',
  Completed: 'green',
  Cancelled: 'default',
};

export function RepairStatusTag({ status }: { status: RepairStatus }) {
  const { t } = useTranslation();
  return <Tag color={STATUS_COLORS[status]}>{t(`enums.repairStatus.${status}`)}</Tag>;
}

interface RepairForm {
  equipmentId?: string;
  unitId?: string | null;
  quantity: number;
  title: string;
  description?: string | null;
  supplierId?: string | null;
  cost?: number | null;
}

/** Repairs of devices (serialized) or quantities (bulk equipment); opening one puts the device "in repair". */
export function RepairListPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { message } = App.useApp();
  const f = useFormat();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<RepairForm>();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<RepairStatus>();
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Repair | 'new' | null>(null);
  const guard = useGuardedForm(!!editing, async () => save.mutateAsync(await form.validateFields()));
  const [picked, setPicked] = useState<EquipmentLookup>();
  const [supplierText, setSupplierText] = useState('');
  const search = useDebounced(text, 300);
  const supplierSearch = useDebounced(supplierText, 250);
  const manage = can(Permissions.MaintenanceManage);
  const showCost = can(Permissions.Prices);

  const filter = { text: search, status, onlyOpen: status ? undefined : onlyOpen };
  const list = useQuery({
    queryKey: ['repairs', filter, page],
    queryFn: () => repairApi.list({ ...filter, skipCount: (page - 1) * PAGE_SIZE, maxResultCount: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const equipmentId = Form.useWatch('equipmentId', form);
  const units = useQuery({
    queryKey: ['repair-units', equipmentId],
    queryFn: () => unitApi.list({ equipmentId, maxResultCount: 500 }),
    enabled: editing === 'new' && !!equipmentId && !!picked?.isSerialized,
  });
  const suppliers = useQuery({
    queryKey: ['supplier-lookup', supplierSearch],
    queryFn: () => supplierApi.lookup(supplierSearch),
    enabled: !!editing,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['repairs'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const save = useMutation({
    mutationFn: (v: RepairForm) =>
      editing && editing !== 'new'
        ? repairApi.update(editing.id, {
            title: v.title,
            description: v.description || null,
            supplierId: v.supplierId ?? null,
            // Users without price access do not see the cost field; keep the stored value.
            cost: showCost ? v.cost ?? null : editing.cost ?? null,
          })
        : repairApi.create({
            equipmentId: v.equipmentId!,
            unitId: picked?.isSerialized ? v.unitId ?? null : null,
            quantity: picked?.isSerialized ? 1 : v.quantity,
            title: v.title,
            description: v.description || null,
            supplierId: v.supplierId ?? null,
            cost: v.cost ?? null,
          }),
    onSuccess: () => {
      message.success(t('common.saved'));
      refresh();
      setEditing(null);
    },
    onError: showError,
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, to }: { id: string; to: RepairStatus }) => repairApi.changeStatus(id, to),
    onSuccess: refresh,
    onError: showError,
  });

  const open = (r: Repair | 'new') => {
    form.resetFields();
    setPicked(undefined);
    form.setFieldsValue(
      r === 'new'
        ? { quantity: 1 }
        : { equipmentId: r.equipmentId, unitId: r.unitId, quantity: r.quantity, title: r.title, description: r.description, supplierId: r.supplierId, cost: r.cost },
    );
    setEditing(r);
  };

  const supplierOptions = [
    ...(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name })),
    ...(editing && editing !== 'new' && editing.supplierId && !(suppliers.data ?? []).some((s) => s.id === editing.supplierId)
      ? [{ value: editing.supplierId, label: editing.supplierName ?? '' }]
      : []),
  ];

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('repairs.title')}</Typography.Title>
        <Space wrap>
          <ExportButton<Repair>
            fileName={t('repairs.title')}
            load={() => fetchAllPages((skipCount, maxResultCount) => repairApi.list({ ...filter, skipCount, maxResultCount }))}
            columns={[
              { header: t('repairs.number'), value: (r) => r.number },
              { header: t('repairs.equipmentCode'), value: (r) => r.equipmentCode },
              { header: t('repairs.equipment'), value: (r) => r.equipmentName },
              { header: t('repairs.unit'), value: (r) => r.unitInternalRef },
              { header: t('repairs.quantity'), value: (r) => r.quantity },
              { header: t('repairs.titleField'), value: (r) => r.title },
              { header: t('repairs.description'), value: (r) => r.description },
              { header: t('repairs.status'), value: (r) => t(`enums.repairStatus.${r.status}`) },
              { header: t('repairs.reportedAt'), value: (r) => f.date(r.reportedAt) },
              { header: t('repairs.completedAt'), value: (r) => (r.completedAt ? f.date(r.completedAt) : null) },
              { header: t('repairs.supplier'), value: (r) => r.supplierName },
              ...(showCost ? [{ header: t('repairs.cost'), value: (r: Repair) => r.cost }] : []),
            ]}
          />
          {manage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => open('new')}>
              {t('repairs.create')}
            </Button>
          )}
        </Space>
      </div>
      <Card size="small">
        <Flex gap={8} wrap align="center" style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder={t('repairs.searchPlaceholder')}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPage(1);
            }}
            style={{ maxWidth: 320 }}
          />
          <Select
            allowClear
            placeholder={t('repairs.status')}
            value={status}
            style={{ width: 180 }}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={REPAIR_STATUSES.map((s) => ({ value: s, label: t(`enums.repairStatus.${s}`) }))}
          />
          <Checkbox
            checked={onlyOpen}
            disabled={!!status}
            onChange={(e) => {
              setOnlyOpen(e.target.checked);
              setPage(1);
            }}
          >
            {t('repairs.onlyOpen')}
          </Checkbox>
        </Flex>
        <Table
          size="small"
          rowKey="id"
          loading={list.isFetching}
          dataSource={list.data?.items}
          scroll={{ x: 1000 }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.totalCount, onChange: setPage, showSizeChanger: false }}
          columns={[
            { title: t('repairs.number'), dataIndex: 'number', width: 70 },
            {
              title: t('repairs.equipment'),
              ellipsis: true,
              render: (_, r) => (
                <Link to={`/equipment/${r.equipmentId}`}>
                  {r.equipmentCode} · {r.equipmentName}
                </Link>
              ),
            },
            {
              title: t('repairs.unit'),
              width: 140,
              render: (_, r) => (r.unitId ? <Link to={`/equipment/units/${r.unitId}`}>{r.unitInternalRef}</Link> : `× ${r.quantity}`),
            },
            { title: t('repairs.titleField'), dataIndex: 'title', ellipsis: true },
            { title: t('repairs.status'), dataIndex: 'status', width: 130, render: (s: RepairStatus) => <RepairStatusTag status={s} /> },
            { title: t('repairs.reportedAt'), dataIndex: 'reportedAt', width: 110, render: (v) => f.date(v) },
            { title: t('repairs.supplier'), dataIndex: 'supplierName', width: 160, ellipsis: true, responsive: ['lg'] },
            ...(showCost
              ? [{ title: t('repairs.cost'), dataIndex: 'cost', width: 110, align: 'end' as const, render: (v?: number | null) => (v == null ? '' : f.number(v)) }]
              : []),
            ...(manage
              ? [
                  {
                    title: '',
                    width: 150,
                    render: (_: unknown, r: Repair) => (
                      <Space size={4}>
                        <Button size="small" icon={<EditOutlined />} aria-label={t('common.edit')} onClick={() => open(r)} />
                        {r.allowedStatuses.length > 0 && (
                          <Dropdown
                            menu={{
                              items: r.allowedStatuses.map((s) => ({ key: s, label: t(`enums.repairStatus.${s}`) })),
                              onClick: ({ key }) => changeStatus.mutate({ id: r.id, to: key as RepairStatus }),
                            }}
                          >
                            <Button size="small">{t('repairs.changeStatus')}</Button>
                          </Dropdown>
                        )}
                      </Space>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>

      <Modal
        open={!!editing}
        title={editing === 'new' ? t('repairs.create') : t('repairs.edit')}
        onCancel={guard.guardClose(() => setEditing(null))}
        onOk={() => form.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={save.isPending}
        destroyOnHidden
        width={560}
      >
        <Form form={form} onValuesChange={guard.onValuesChange} layout="vertical" onFinish={(v) => save.mutate(v)}>
          {editing === 'new' ? (
            <>
              <Form.Item name="equipmentId" label={t('repairs.equipment')} rules={[{ required: true, message: t('validation.required') }]}>
                <EquipmentSelect
                  onPick={(e) => {
                    setPicked(e);
                    form.setFieldsValue({ unitId: null, quantity: 1 });
                  }}
                />
              </Form.Item>
              {picked?.isSerialized ? (
                <Form.Item name="unitId" label={t('repairs.unit')} rules={[{ required: true, message: t('validation.required') }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    loading={units.isFetching}
                    options={(units.data?.items ?? []).map((u) => ({
                      value: u.id,
                      label: `${u.internalRef}${u.serialNumber ? ` · ${u.serialNumber}` : ''} (${t(`enums.unitStatus.${u.status}`)})`,
                    }))}
                  />
                </Form.Item>
              ) : (
                picked && (
                  <Form.Item name="quantity" label={t('repairs.quantity')} rules={[{ required: true, message: t('validation.required') }]}>
                    <InputNumber min={1} max={10000} style={{ width: 160 }} />
                  </Form.Item>
                )
              )}
            </>
          ) : (
            editing && (
              <Typography.Paragraph>
                <Typography.Text strong>
                  {editing.equipmentCode} · {editing.equipmentName}
                </Typography.Text>
                {editing.unitInternalRef && <Tag style={{ marginInlineStart: 8 }}>{editing.unitInternalRef}</Tag>}
              </Typography.Paragraph>
            )
          )}
          <Form.Item name="title" label={t('repairs.titleField')} rules={[{ required: true, whitespace: true, message: t('validation.required') }]}>
            <Input maxLength={256} />
          </Form.Item>
          <Form.Item name="description" label={t('repairs.description')}>
            <Input.TextArea rows={3} maxLength={4000} />
          </Form.Item>
          <Row gutter={8}>
            <Col span={showCost ? 14 : 24}>
              <Form.Item name="supplierId" label={t('repairs.supplier')}>
                <Select
                  allowClear
                  showSearch
                  filterOption={false}
                  onSearch={setSupplierText}
                  loading={suppliers.isFetching}
                  options={supplierOptions}
                />
              </Form.Item>
            </Col>
            {showCost && (
              <Col span={10}>
                <Form.Item name="cost" label={t('repairs.cost')}>
                  <InputNumber min={0} max={100000000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            )}
          </Row>
        </Form>
      </Modal>
    </>
  );
}
