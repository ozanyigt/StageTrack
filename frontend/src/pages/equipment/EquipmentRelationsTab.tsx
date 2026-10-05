import { DeleteOutlined, EditOutlined, PlusOutlined, StarFilled } from '@ant-design/icons';
import { Button, Card, Flex, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { equipmentApi, supplierApi } from '../../api/endpoints';
import type { EquipmentDetail, EquipmentSupplierLink, RelationKind } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { EquipmentSelect } from '../../components/Selects';
import { useErrorToast } from '../../utils/errors';
import { useFormat } from '../../utils/format';
import { useDebounced } from '../../utils/useDebounced';

function useDetailUpdater(id: string) {
  const queryClient = useQueryClient();
  return (saved: EquipmentDetail) => queryClient.setQueryData(['equipment', id], saved);
}

/** Default content, accessories or alternatives of one equipment item. */
export function EquipmentRelationsTab({ equipment, kind }: { equipment: EquipmentDetail; kind: RelationKind }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const showError = useErrorToast();
  const apply = useDetailUpdater(equipment.id);
  const manage = can(Permissions.EquipmentManage);
  const [picked, setPicked] = useState<string>();
  const [quantity, setQuantity] = useState<number>(1);

  const rows = equipment.relations.filter((r) => r.kind === kind);

  const add = useMutation({
    mutationFn: () => equipmentApi.addRelation(equipment.id, kind, picked!, kind === 'Alternative' ? 1 : quantity),
    onSuccess: (saved) => {
      apply(saved);
      setPicked(undefined);
      setQuantity(1);
    },
    onError: showError,
  });

  const update = (relationId: string, qty: number) => equipmentApi.updateRelation(equipment.id, relationId, qty).then(apply).catch(showError);
  const remove = (relationId: string) => equipmentApi.removeRelation(equipment.id, relationId).then(apply).catch(showError);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        {t(`equipmentDetail.relationHint.${kind}`)}
      </Typography.Paragraph>
      {manage && (
        <Flex gap={8} wrap>
          <EquipmentSelect value={picked} onChange={(v) => setPicked(v as string)} style={{ minWidth: 280, flex: 1 }} />
          {kind !== 'Alternative' && (
            <InputNumber min={1} value={quantity} onChange={(v) => setQuantity(v ?? 1)} style={{ width: 100 }} aria-label={t('equipmentDetail.quantity')} />
          )}
          <Button type="primary" icon={<PlusOutlined />} disabled={!picked} loading={add.isPending} onClick={() => add.mutate()}>
            {t('common.add')}
          </Button>
        </Flex>
      )}
      <Table
        size="small"
        rowKey="id"
        dataSource={rows}
        pagination={false}
        columns={[
          { title: t('equipment.code'), dataIndex: 'equipmentCode', width: 120 },
          { title: t('equipment.name'), dataIndex: 'equipmentName', render: (v, r) => <Link to={`/equipment/${r.equipmentId}`}>{v}</Link> },
          ...(kind !== 'Alternative'
            ? [
                {
                  title: t('equipmentDetail.quantity'),
                  dataIndex: 'quantity',
                  width: 120,
                  render: (v: number, r: { id: string }) =>
                    manage ? (
                      <InputNumber
                        size="small"
                        min={1}
                        defaultValue={v}
                        key={`${r.id}-${v}`}
                        onBlur={(e) => {
                          const next = Number(e.target.value);
                          if (next >= 1 && next !== v) update(r.id, next);
                        }}
                      />
                    ) : (
                      v
                    ),
                },
              ]
            : []),
          { title: t('equipment.stock'), dataIndex: 'stock', width: 90, align: 'end' as const },
          ...(manage
            ? [
                {
                  title: '',
                  width: 50,
                  render: (_: unknown, r: { id: string }) => (
                    <Popconfirm title={t('equipmentDetail.removeConfirm')} onConfirm={() => remove(r.id)}>
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} />
                    </Popconfirm>
                  ),
                },
              ]
            : []),
        ]}
      />
      {kind === 'Content' && equipment.partOf.length > 0 && (
        <Card size="small" title={t('equipmentDetail.partOf')}>
          <Flex vertical gap={4}>
            {equipment.partOf.map((p) => (
              <Link key={p.id} to={`/equipment/${p.equipmentId}`}>
                {p.equipmentCode} · {p.equipmentName} (×{p.quantity})
              </Link>
            ))}
          </Flex>
        </Card>
      )}
    </Space>
  );
}

interface SupplierForm {
  supplierId: string;
  supplierCode?: string | null;
  purchasePrice?: number | null;
  isPreferred: boolean;
}

/** Suppliers that sell this item, with their product code and purchase price. */
export function EquipmentSuppliersTab({ equipment }: { equipment: EquipmentDetail }) {
  const { t } = useTranslation();
  const { can, company } = useAuth();
  const f = useFormat();
  const showError = useErrorToast();
  const apply = useDetailUpdater(equipment.id);
  const manage = can(Permissions.EquipmentManage);
  const showPrice = can(Permissions.Prices);
  const [editing, setEditing] = useState<EquipmentSupplierLink | 'new' | null>(null);
  const [form] = Form.useForm<SupplierForm>();
  const [text, setText] = useState('');
  const search = useDebounced(text, 250);
  const suppliers = useQuery({ queryKey: ['supplier-lookup', search], queryFn: () => supplierApi.lookup(search), enabled: !!editing });

  const save = useMutation({
    mutationFn: (v: SupplierForm) => {
      const input = { ...v, purchasePrice: showPrice ? v.purchasePrice : null, isPreferred: !!v.isPreferred };
      return editing === 'new' || !editing
        ? equipmentApi.addSupplier(equipment.id, input)
        : equipmentApi.updateSupplier(equipment.id, editing.id, input);
    },
    onSuccess: (saved) => {
      apply(saved);
      setEditing(null);
    },
    onError: showError,
  });

  const open = (link: EquipmentSupplierLink | 'new') => {
    setEditing(link);
    form.resetFields();
    if (link !== 'new') form.setFieldsValue(link);
    else form.setFieldsValue({ isPreferred: equipment.suppliers.length === 0 });
  };

  const options = [
    ...(editing && editing !== 'new' ? [{ value: editing.supplierId, label: editing.supplierName }] : []),
    ...(suppliers.data ?? []).filter((s) => editing === 'new' || s.id !== editing?.supplierId).map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {manage && (
        <Button icon={<PlusOutlined />} onClick={() => open('new')}>
          {t('equipmentDetail.addSupplier')}
        </Button>
      )}
      <Table
        size="small"
        rowKey="id"
        dataSource={equipment.suppliers}
        pagination={false}
        columns={[
          {
            title: t('equipmentDetail.supplier'),
            dataIndex: 'supplierName',
            render: (v, r) => (
              <Space>
                {r.isPreferred && <StarFilled style={{ color: '#f59e0b' }} title={t('equipmentDetail.preferred')} />}
                {v}
              </Space>
            ),
          },
          { title: t('equipmentDetail.supplierCode'), dataIndex: 'supplierCode', width: 160, render: (v) => v ?? '—' },
          ...(showPrice
            ? [
                {
                  title: t('equipmentDetail.purchasePrice'),
                  dataIndex: 'purchasePrice',
                  width: 150,
                  align: 'end' as const,
                  render: (v: number | null) => (v == null ? '—' : f.money(v, company?.defaultCurrency ?? 'TRY')),
                },
              ]
            : []),
          ...(manage
            ? [
                {
                  title: '',
                  width: 90,
                  render: (_: unknown, r: EquipmentSupplierLink) => (
                    <Space size={2}>
                      <Button type="text" size="small" icon={<EditOutlined />} onClick={() => open(r)} aria-label={t('common.edit')} />
                      <Popconfirm
                        title={t('equipmentDetail.removeConfirm')}
                        onConfirm={() => equipmentApi.removeSupplier(equipment.id, r.id).then(apply).catch(showError)}
                      >
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} />
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]
            : []),
        ]}
      />
      <Modal
        open={!!editing}
        title={editing === 'new' ? t('equipmentDetail.addSupplier') : t('equipmentDetail.editSupplier')}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={save.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="supplierId" label={t('equipmentDetail.supplier')} rules={[{ required: true, message: t('validation.required') }]}>
            <Select showSearch filterOption={false} onSearch={setText} loading={suppliers.isFetching} options={options} />
          </Form.Item>
          <Form.Item name="supplierCode" label={t('equipmentDetail.supplierCode')}>
            <Input maxLength={64} />
          </Form.Item>
          {showPrice && (
            <Form.Item name="purchasePrice" label={t('equipmentDetail.purchasePrice')}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          )}
          <Form.Item name="isPreferred" label={t('equipmentDetail.preferred')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
