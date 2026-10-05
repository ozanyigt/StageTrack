import { CheckOutlined, CloseOutlined, EditOutlined, InboxOutlined, PlusOutlined, PrinterOutlined, SwapOutlined } from '@ant-design/icons';
import { Button, Checkbox, DatePicker, Flex, Form, Input, Modal, Popconfirm, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { unitApi } from '../../api/endpoints';
import type { EquipmentUnit } from '../../api/types';
import { ExportButton } from '../../components/ExcelButtons';
import { ScanInput } from '../../components/ScanInput';
import { StockLocationSelect } from '../../components/Selects';
import { UnitStatusTag } from '../../components/StatusTags';
import { useErrorToast } from '../../utils/errors';
import { formatDate, toApiDate } from '../../utils/format';
import { SupplierSelect } from './SupplierSelect';
import { TransferUnitsModal, useCanTransfer } from './TransferUnitsModal';
import { unitExportColumns } from './unitExcel';

interface RowDraft {
  internalRef: string;
  serialNumber?: string | null;
  stockLocationId?: string | null;
  purchaseDate?: Dayjs | null;
  warrantyDate?: Dayjs | null;
  supplierId?: string | null;
}

const toDraft = (u: EquipmentUnit): RowDraft => ({
  internalRef: u.internalRef,
  serialNumber: u.serialNumber,
  stockLocationId: u.stockLocationId,
  purchaseDate: u.purchaseDate ? dayjs(u.purchaseDate) : null,
  warrantyDate: u.warrantyDate ? dayjs(u.warrantyDate) : null,
  supplierId: u.supplierId,
});

export const isInspectionOverdue = (u: { nextInspectionDate?: string | null; isArchived?: boolean }) =>
  !!u.nextInspectionDate && !u.isArchived && dayjs(u.nextInspectionDate).isBefore(dayjs(), 'day');

/**
 * Serial numbers of one equipment item as an editable grid (Rentman "Serial numbers" tab):
 * one row at a time is edited in place; selected rows can get labels, move to another location or be archived.
 */
export function UnitGrid({ equipmentId, canManage }: { equipmentId: string; canManage?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const showError = useErrorToast();
  const canTransfer = useCanTransfer();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RowDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const key = ['units', 'equipment', equipmentId, includeArchived];
  const { data, isFetching } = useQuery({
    queryKey: key,
    queryFn: () => unitApi.list({ equipmentId, includeArchived, maxResultCount: 1000 }),
  });
  const rows = data?.items ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['units'] });
    qc.invalidateQueries({ queryKey: ['equipment', equipmentId] });
  };

  const startEdit = (u: EquipmentUnit) => {
    setEditingId(u.id);
    setDraft(toDraft(u));
  };

  const saveRow = async (u: EquipmentUnit) => {
    if (!draft || !draft.internalRef.trim()) return;
    setSaving(true);
    try {
      await unitApi.update(u.id, {
        internalRef: draft.internalRef.trim(),
        serialNumber: draft.serialNumber?.trim() || null,
        stockLocationId: draft.stockLocationId ?? null,
        purchaseDate: toApiDate(draft.purchaseDate),
        warrantyDate: toApiDate(draft.warrantyDate),
        replacementDate: u.replacementDate ?? null,
        supplierId: draft.supplierId ?? null,
        notes: u.notes ?? null,
      });
      setEditingId(null);
      setDraft(null);
      refresh();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const archiveSelected = async () => {
    try {
      for (const id of selected) await unitApi.archive(id);
      setSelected([]);
      refresh();
    } catch (e) {
      showError(e);
      refresh();
    }
  };

  const editing = (u: EquipmentUnit) => editingId === u.id && draft;
  const set = (patch: Partial<RowDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <>
      <Flex gap={8} wrap align="center" style={{ marginBottom: 12 }}>
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            {t('units.create')}
          </Button>
        )}
        <Button icon={<PrinterOutlined />} disabled={selected.length === 0} onClick={() => navigate(`/labels/print?units=${selected.join(',')}`)}>
          {t('unitGrid.printLabels', { count: selected.length })}
        </Button>
        {canTransfer && (
          <Button icon={<SwapOutlined />} disabled={selected.length === 0} onClick={() => setTransferOpen(true)}>
            {t('transfer.button')}
          </Button>
        )}
        {canManage && (
          <Popconfirm title={t('unitGrid.archiveConfirm', { count: selected.length })} onConfirm={archiveSelected} disabled={selected.length === 0}>
            <Button icon={<InboxOutlined />} disabled={selected.length === 0}>
              {t('unitGrid.archive')}
            </Button>
          </Popconfirm>
        )}
        <Checkbox checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)}>
          {t('unitGrid.showArchived')}
        </Checkbox>
        <span style={{ marginInlineStart: 'auto' }}>
          <ExportButton fileName={`serial-numbers-${rows[0]?.equipmentCode ?? equipmentId}`} columns={unitExportColumns(t)} load={async () => rows} />
        </span>
      </Flex>
      <Table
        size="small"
        rowKey="id"
        loading={isFetching}
        dataSource={rows}
        pagination={rows.length > 50 ? { pageSize: 50, showSizeChanger: false } : false}
        scroll={{ x: 1250 }}
        rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys as string[]) }}
        rowClassName={(u) => (u.isArchived ? 'ant-table-row-disabled' : '')}
        columns={[
          {
            title: t('units.internalRef'),
            width: 170,
            render: (_, u) =>
              editing(u) ? (
                <Input size="small" value={draft!.internalRef} status={draft!.internalRef.trim() ? undefined : 'error'} onChange={(e) => set({ internalRef: e.target.value })} maxLength={64} />
              ) : (
                <Space size={4}>
                  <Link to={`/equipment/units/${u.id}`}>{u.internalRef}</Link>
                  {u.isArchived && <Tag>{t('unitGrid.archived')}</Tag>}
                </Space>
              ),
          },
          {
            title: t('units.serialNumber'),
            width: 160,
            render: (_, u) =>
              editing(u) ? <Input size="small" value={draft!.serialNumber ?? ''} onChange={(e) => set({ serialNumber: e.target.value })} maxLength={128} /> : u.serialNumber ?? '—',
          },
          {
            title: t('units.location'),
            width: 150,
            render: (_, u) =>
              editing(u) ? (
                <StockLocationSelect size="small" style={{ width: '100%' }} value={draft!.stockLocationId ?? undefined} onChange={(v) => set({ stockLocationId: v ?? null })} />
              ) : (
                u.stockLocationName ?? '—'
              ),
          },
          { title: t('units.status'), dataIndex: 'status', width: 110, render: (s) => <UnitStatusTag status={s} /> },
          {
            title: t('units.currentProject'),
            width: 180,
            ellipsis: true,
            render: (_, u) => (u.currentProjectId ? <Link to={`/projects/${u.currentProjectId}`}>{u.currentProjectNumber} · {u.currentProjectName}</Link> : '—'),
          },
          {
            title: t('unitDetail.purchaseDate'),
            width: 130,
            render: (_, u) =>
              editing(u) ? (
                <DatePicker size="small" format="DD.MM.YYYY" value={draft!.purchaseDate} onChange={(v) => set({ purchaseDate: v })} />
              ) : (
                formatDate(u.purchaseDate)
              ),
          },
          {
            title: t('unitDetail.warrantyDate'),
            width: 130,
            render: (_, u) =>
              editing(u) ? (
                <DatePicker size="small" format="DD.MM.YYYY" value={draft!.warrantyDate} onChange={(v) => set({ warrantyDate: v })} />
              ) : (
                formatDate(u.warrantyDate)
              ),
          },
          {
            title: t('unitDetail.supplier'),
            width: 170,
            render: (_, u) =>
              editing(u) ? (
                <SupplierSelect size="small" style={{ width: '100%' }} value={draft!.supplierId ?? undefined} currentName={u.supplierName} onChange={(v) => set({ supplierId: v ?? null })} />
              ) : (
                u.supplierName ?? '—'
              ),
          },
          {
            title: t('unitDetail.nextInspection'),
            width: 120,
            render: (_, u) =>
              u.nextInspectionDate ? <Typography.Text type={isInspectionOverdue(u) ? 'danger' : undefined}>{formatDate(u.nextInspectionDate)}</Typography.Text> : '—',
          },
          {
            title: t('units.labels'),
            width: 90,
            render: (_, u) => (u.labelCount ? <Tag color="green">{u.labelCount}</Tag> : <Tag color="orange">{t('labels.noLabel')}</Tag>),
          },
          ...(canManage
            ? [
                {
                  key: 'actions',
                  width: 80,
                  fixed: 'right' as const,
                  render: (_: unknown, u: EquipmentUnit) =>
                    editing(u) ? (
                      <Space size={2}>
                        <Tooltip title={t('common.save')}>
                          <Button size="small" type="text" icon={<CheckOutlined />} loading={saving} onClick={() => saveRow(u)} aria-label={t('common.save')} />
                        </Tooltip>
                        <Tooltip title={t('common.cancel')}>
                          <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => setEditingId(null)} aria-label={t('common.cancel')} />
                        </Tooltip>
                      </Space>
                    ) : (
                      <Button size="small" type="text" icon={<EditOutlined />} disabled={u.isArchived} onClick={() => startEdit(u)} aria-label={t('common.edit')} />
                    ),
                },
              ]
            : []),
        ]}
      />
      <TransferUnitsModal
        unitIds={selected}
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        onDone={() => {
          setSelected([]);
          refresh();
        }}
      />
      <CreateUnitModal equipmentId={equipmentId} open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} />
    </>
  );
}

/** Registers a new device; its existing Rentman label can be scanned right away. */
function CreateUnitModal({ equipmentId, open, onClose, onCreated }: { equipmentId: string; open: boolean; onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
  const showError = useErrorToast();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);

  const save = async (addAnother: boolean) => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      await unitApi.create({
        equipmentId,
        internalRef: v.internalRef.trim(),
        serialNumber: v.serialNumber?.trim() || null,
        stockLocationId: v.stockLocationId ?? null,
        purchaseDate: toApiDate(v.purchaseDate),
        supplierId: v.supplierId ?? null,
        labelCode: v.labelCode?.trim() || null,
      });
      onCreated();
      if (addAnother) form.setFieldsValue({ internalRef: '', serialNumber: '', labelCode: '' });
      else {
        form.resetFields();
        onClose();
      }
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('units.create')}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button loading={busy} onClick={() => save(true)}>
            {t('unitGrid.saveAndAddAnother')}
          </Button>
          <Button type="primary" loading={busy} onClick={() => save(false)}>
            {t('common.save')}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Flex gap={12}>
          <Form.Item name="internalRef" label={t('units.internalRef')} style={{ flex: 1 }} rules={[{ required: true, whitespace: true, message: t('validation.required') }]}>
            <Input maxLength={64} autoFocus />
          </Form.Item>
          <Form.Item name="serialNumber" label={t('units.serialNumber')} style={{ flex: 1 }}>
            <Input maxLength={128} />
          </Form.Item>
        </Flex>
        <Flex gap={12}>
          <Form.Item name="stockLocationId" label={t('units.location')} style={{ flex: 1 }}>
            <StockLocationSelect />
          </Form.Item>
          <Form.Item name="purchaseDate" label={t('unitDetail.purchaseDate')} style={{ flex: 1 }}>
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
        </Flex>
        <Form.Item name="supplierId" label={t('unitDetail.supplier')}>
          <SupplierSelect />
        </Form.Item>
        <Form.Item name="labelCode" label={t('units.labelCode')} extra={t('units.labelCodeHint')}>
          <Input maxLength={512} />
        </Form.Item>
        <ScanInput size="middle" placeholder={t('units.scanToFill')} onScan={(code) => form.setFieldValue('labelCode', code)} />
      </Form>
    </Modal>
  );
}
