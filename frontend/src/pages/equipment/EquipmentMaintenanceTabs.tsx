import { CheckCircleTwoTone, CloseCircleTwoTone, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { App, Button, Card, DatePicker, Dropdown, Flex, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { equipmentApi, inspectionApi, repairApi, supplierApi, unitApi } from '../../api/endpoints';
import type { EquipmentDetail, RepairInput, RepairStatus } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { useErrorToast } from '../../utils/errors';
import { formatDate, toApiDate, useFormat } from '../../utils/format';
import { useDebounced } from '../../utils/useDebounced';
import { toEquipmentInput } from './EquipmentPropertiesTab';

export const repairStatusColor: Record<RepairStatus, string> = {
  Open: 'orange',
  InProgress: 'blue',
  Completed: 'green',
  Cancelled: 'default',
};

/** Periodic inspection: interval per equipment item, inspection history and due dates per device. */
export function EquipmentInspectionTab({ equipment }: { equipment: EquipmentDetail }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { message } = App.useApp();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const manage = can(Permissions.EquipmentManage);
  const record = can(Permissions.MaintenanceManage);
  const [settings] = Form.useForm<{ inspectionIntervalMonths?: number | null; inspectionDescription?: string | null }>();
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordForm] = Form.useForm<{ unitId: string; date: dayjs.Dayjs; passed: boolean; notes?: string }>();

  useEffect(() => {
    settings.setFieldsValue({ inspectionIntervalMonths: equipment.inspectionIntervalMonths, inspectionDescription: equipment.inspectionDescription });
  }, [equipment, settings]);

  const inspections = useQuery({
    queryKey: ['inspections', equipment.id],
    queryFn: () => inspectionApi.list({ equipmentId: equipment.id }),
    enabled: can(Permissions.Maintenance),
  });
  const units = useQuery({
    queryKey: ['units', equipment.id, 'inspection'],
    queryFn: () => unitApi.list({ equipmentId: equipment.id, maxResultCount: 1000 }),
    enabled: equipment.isSerialized,
  });

  const saveSettings = useMutation({
    mutationFn: (v: { inspectionIntervalMonths?: number | null; inspectionDescription?: string | null }) =>
      equipmentApi.update(equipment.id, { ...toEquipmentInput(equipment, can(Permissions.Prices)), ...v }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['equipment', equipment.id], saved);
      queryClient.invalidateQueries({ queryKey: ['units', equipment.id] });
      message.success(t('common.saved'));
    },
    onError: showError,
  });

  const recordInspection = useMutation({
    mutationFn: (v: { unitId: string; date: dayjs.Dayjs; passed: boolean; notes?: string }) =>
      inspectionApi.record({ unitId: v.unitId, date: toApiDate(v.date)!, passed: v.passed, notes: v.notes }),
    onSuccess: () => {
      setRecordOpen(false);
      queryClient.invalidateQueries({ queryKey: ['inspections', equipment.id] });
      queryClient.invalidateQueries({ queryKey: ['units', equipment.id] });
      queryClient.invalidateQueries({ queryKey: ['equipment', equipment.id] });
      message.success(t('common.saved'));
    },
    onError: showError,
  });

  const today = dayjs().startOf('day');

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Card size="small" title={t('equipmentDetail.inspectionSettings')}>
        <Form form={settings} layout="vertical" disabled={!manage} onFinish={(v) => saveSettings.mutate(v)}>
          <Flex gap={12} wrap align="end">
            <Form.Item name="inspectionIntervalMonths" label={t('equipmentDetail.intervalMonths')} extra={t('equipmentDetail.intervalHint')} style={{ width: 220 }}>
              <InputNumber min={1} max={120} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="inspectionDescription" label={t('equipmentDetail.inspectionDescription')} style={{ flex: 1, minWidth: 240 }}>
              <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} maxLength={1000} />
            </Form.Item>
            {manage && (
              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saveSettings.isPending}>
                  {t('common.save')}
                </Button>
              </Form.Item>
            )}
          </Flex>
        </Form>
      </Card>

      {equipment.isSerialized && equipment.inspectionIntervalMonths && (
        <Card
          size="small"
          title={t('equipmentDetail.dueDates')}
          extra={
            record && (
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  recordForm.resetFields();
                  recordForm.setFieldsValue({ date: dayjs(), passed: true });
                  setRecordOpen(true);
                }}
              >
                {t('equipmentDetail.recordInspection')}
              </Button>
            )
          }
        >
          <Table
            size="small"
            rowKey="id"
            loading={units.isFetching}
            dataSource={[...(units.data?.items ?? [])].sort((a, b) => (a.nextInspectionDate ?? '9').localeCompare(b.nextInspectionDate ?? '9'))}
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            columns={[
              { title: t('units.internalRef'), dataIndex: 'internalRef', render: (v, u) => <Link to={`/equipment/units/${u.id}`}>{v}</Link> },
              { title: t('units.serialNumber'), dataIndex: 'serialNumber', render: (v) => v ?? '—' },
              { title: t('equipmentDetail.lastInspection'), dataIndex: 'lastInspectionDate', width: 140, render: formatDate },
              {
                title: t('equipmentDetail.nextInspection'),
                dataIndex: 'nextInspectionDate',
                width: 160,
                render: (v?: string | null) =>
                  v ? <Tag color={dayjs(v).isBefore(today) ? 'red' : dayjs(v).isBefore(today.add(30, 'day')) ? 'gold' : 'green'}>{formatDate(v)}</Tag> : '—',
              },
            ]}
          />
        </Card>
      )}

      {can(Permissions.Maintenance) && (
        <Card size="small" title={t('equipmentDetail.inspectionHistory')}>
          <Table
            size="small"
            rowKey="id"
            loading={inspections.isFetching}
            dataSource={inspections.data}
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            columns={[
              { title: t('equipmentDetail.date'), dataIndex: 'date', width: 120, render: formatDate },
              { title: t('units.internalRef'), dataIndex: 'unitInternalRef', width: 150 },
              {
                title: t('equipmentDetail.result'),
                dataIndex: 'passed',
                width: 120,
                render: (v: boolean) => (
                  <Space>
                    {v ? <CheckCircleTwoTone twoToneColor="#52c41a" /> : <CloseCircleTwoTone twoToneColor="#ff4d4f" />}
                    {v ? t('equipmentDetail.passed') : t('equipmentDetail.failed')}
                  </Space>
                ),
              },
              { title: t('equipmentDetail.inspector'), dataIndex: 'inspectorName', width: 160, render: (v) => v ?? '—' },
              { title: t('common.notes'), dataIndex: 'notes', ellipsis: true },
            ]}
          />
        </Card>
      )}

      <Modal
        open={recordOpen}
        title={t('equipmentDetail.recordInspection')}
        onCancel={() => setRecordOpen(false)}
        onOk={() => recordForm.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={recordInspection.isPending}
        destroyOnHidden
      >
        <Form form={recordForm} layout="vertical" onFinish={(v) => recordInspection.mutate(v)}>
          <Form.Item name="unitId" label={t('labels.unit')} rules={[{ required: true, message: t('validation.required') }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={(units.data?.items ?? []).map((u) => ({ value: u.id, label: `${u.internalRef}${u.serialNumber ? ` · ${u.serialNumber}` : ''}` }))}
            />
          </Form.Item>
          <Form.Item name="date" label={t('equipmentDetail.date')} rules={[{ required: true, message: t('validation.required') }]}>
            <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="passed" label={t('equipmentDetail.passed')} valuePropName="checked" extra={t('equipmentDetail.failedHint')}>
            <Switch />
          </Form.Item>
          <Form.Item name="notes" label={t('common.notes')}>
            <Input.TextArea autoSize={{ minRows: 2 }} maxLength={1000} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

/** Repairs of this equipment item (open repairs keep the device out of stock). */
export function EquipmentRepairsTab({ equipment, unitId }: { equipment: EquipmentDetail | { id: string; isSerialized: boolean }; unitId?: string }) {
  const { t } = useTranslation();
  const { can, company } = useAuth();
  const f = useFormat();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const manage = can(Permissions.MaintenanceManage);
  const showPrice = can(Permissions.Prices);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<RepairInput>();
  const [supplierText, setSupplierText] = useState('');
  const supplierSearch = useDebounced(supplierText, 250);

  const key = ['repairs', equipment.id, unitId ?? null];
  const repairs = useQuery({ queryKey: key, queryFn: () => repairApi.list({ equipmentId: equipment.id, unitId, maxResultCount: 200 }) });
  const units = useQuery({
    queryKey: ['units', equipment.id, 'repair'],
    queryFn: () => unitApi.list({ equipmentId: equipment.id, maxResultCount: 1000 }),
    enabled: open && equipment.isSerialized && !unitId,
  });
  const suppliers = useQuery({ queryKey: ['supplier-lookup', supplierSearch], queryFn: () => supplierApi.lookup(supplierSearch), enabled: open });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['repairs'] });
    queryClient.invalidateQueries({ queryKey: ['units'] });
    queryClient.invalidateQueries({ queryKey: ['equipment', equipment.id] });
  };

  const create = useMutation({
    mutationFn: (v: RepairInput) =>
      repairApi.create({ ...v, equipmentId: equipment.id, unitId: unitId ?? v.unitId, quantity: v.quantity ?? 1, cost: showPrice ? v.cost : null }),
    onSuccess: () => {
      setOpen(false);
      refresh();
    },
    onError: showError,
  });

  const changeStatus = (id: string, status: RepairStatus) => repairApi.changeStatus(id, status).then(refresh).catch(showError);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {manage && (
        <Button
          icon={<PlusOutlined />}
          onClick={() => {
            form.resetFields();
            form.setFieldsValue({ quantity: 1 });
            setOpen(true);
          }}
        >
          {t('equipmentDetail.openRepair')}
        </Button>
      )}
      <Table
        size="small"
        rowKey="id"
        loading={repairs.isFetching}
        dataSource={repairs.data?.items}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        scroll={{ x: 760 }}
        columns={[
          { title: '#', dataIndex: 'number', width: 60 },
          { title: t('equipmentDetail.repairTitle'), dataIndex: 'title', ellipsis: true },
          ...(!unitId ? [{ title: t('units.internalRef'), dataIndex: 'unitInternalRef', width: 130, render: (v: string | null) => v ?? '—' }] : []),
          ...(!equipment.isSerialized ? [{ title: t('equipmentDetail.quantity'), dataIndex: 'quantity', width: 80 }] : []),
          { title: t('equipmentDetail.reportedAt'), dataIndex: 'reportedAt', width: 120, render: formatDate },
          { title: t('equipmentDetail.supplier'), dataIndex: 'supplierName', width: 160, render: (v: string | null) => v ?? '—' },
          ...(showPrice
            ? [
                {
                  title: t('equipmentDetail.cost'),
                  dataIndex: 'cost',
                  width: 120,
                  align: 'end' as const,
                  render: (v: number | null) => (v == null ? '—' : f.money(v, company?.defaultCurrency ?? 'TRY')),
                },
              ]
            : []),
          {
            title: t('units.status'),
            dataIndex: 'status',
            width: 150,
            render: (s: RepairStatus, r) =>
              manage && r.allowedStatuses.length > 0 ? (
                <Dropdown
                  menu={{
                    items: r.allowedStatuses.map((x) => ({ key: x, label: t(`enums.repairStatus.${x}`), onClick: () => changeStatus(r.id, x) })),
                  }}
                >
                  <Tag color={repairStatusColor[s]} style={{ cursor: 'pointer' }}>
                    {t(`enums.repairStatus.${s}`)} ▾
                  </Tag>
                </Dropdown>
              ) : (
                <Tag color={repairStatusColor[s]}>{t(`enums.repairStatus.${s}`)}</Tag>
              ),
          },
        ]}
        expandable={{
          rowExpandable: (r) => !!r.description,
          expandedRowRender: (r) => <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{r.description}</Typography.Paragraph>,
        }}
      />
      <Modal
        open={open}
        title={t('equipmentDetail.openRepair')}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={create.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(v) => create.mutate(v)}>
          {equipment.isSerialized && !unitId && (
            <Form.Item name="unitId" label={t('labels.unit')} rules={[{ required: true, message: t('validation.required') }]}>
              <Select
                showSearch
                optionFilterProp="label"
                loading={units.isFetching}
                options={(units.data?.items ?? [])
                  .filter((u) => u.status !== 'InRepair')
                  .map((u) => ({ value: u.id, label: `${u.internalRef}${u.serialNumber ? ` · ${u.serialNumber}` : ''}` }))}
              />
            </Form.Item>
          )}
          {!equipment.isSerialized && (
            <Form.Item name="quantity" label={t('equipmentDetail.quantity')} rules={[{ required: true, message: t('validation.required') }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          )}
          <Form.Item name="title" label={t('equipmentDetail.repairTitle')} rules={[{ required: true, whitespace: true, message: t('validation.required') }]}>
            <Input maxLength={256} />
          </Form.Item>
          <Form.Item name="description" label={t('equipmentDetail.repairDescription')}>
            <Input.TextArea autoSize={{ minRows: 2 }} maxLength={4000} />
          </Form.Item>
          <Flex gap={12}>
            <Form.Item name="supplierId" label={t('equipmentDetail.repairSupplier')} style={{ flex: 1 }}>
              <Select
                allowClear
                showSearch
                filterOption={false}
                onSearch={setSupplierText}
                options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              />
            </Form.Item>
            {showPrice && (
              <Form.Item name="cost" label={t('equipmentDetail.cost')} style={{ width: 160 }}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            )}
          </Flex>
        </Form>
      </Modal>
    </Space>
  );
}
