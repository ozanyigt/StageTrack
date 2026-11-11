import { DeleteOutlined, InboxOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Empty, Flex, InputNumber, Modal, Popconfirm, Radio, Select, Space, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { equipmentApi } from '../../api/endpoints';
import type { CaseContentLine, CaseContents, CaseUnitOption, EquipmentDetail, Guid } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { useErrorToast } from '../../utils/errors';
import { useFormat } from '../../utils/format';

/**
 * What is physically in this case. Not the model's recipe (that is the Content tab of a set) but the box
 * itself: a device goes in by name, everything else by count, and a device can only be in one box.
 */
export function CaseContentTab({ equipment }: { equipment: EquipmentDetail }) {
  const { t } = useTranslation();
  const { can, company } = useAuth();
  const f = useFormat();
  const { message } = App.useApp();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const manage = can(Permissions.EquipmentManage);
  const [adding, setAdding] = useState(false);

  const key = ['case-contents', equipment.id];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => equipmentApi.caseContents(equipment.id) });
  const put = (next: CaseContents) => queryClient.setQueryData(key, next);

  const setQuantity = useMutation({
    mutationFn: ({ lineId, quantity }: { lineId: Guid; quantity: number }) =>
      equipmentApi.setCaseContentQuantity(equipment.id, lineId, quantity),
    onSuccess: put,
    onError: showError,
  });
  const remove = useMutation({
    mutationFn: (lineId: Guid) => equipmentApi.removeCaseContent(equipment.id, lineId),
    onSuccess: (next) => { put(next); message.success(t('caseContent.removed')); },
    onError: showError,
  });

  return (
    <>
      <Flex align="center" justify="space-between" wrap gap={8} style={{ marginBottom: 12 }}>
        <Space size={16} wrap>
          <Summary label={t('caseContent.items')} value={String(data?.itemCount ?? 0)} />
          <Summary label={t('caseContent.emptyWeight')} value={data?.emptyWeightKg != null ? `${f.number(data.emptyWeightKg)} kg` : '—'} />
          <Summary label={t('caseContent.loadedWeight')} value={`${f.number(data?.loadedWeightKg ?? 0)} kg`} strong />
          {data?.contentPriceTotal != null && (
            <Summary label={t('caseContent.contentPrice')} value={f.money(data.contentPriceTotal, company?.defaultCurrency ?? '')} />
          )}
        </Space>
        {manage && <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdding(true)}>{t('caseContent.add')}</Button>}
      </Flex>

      {!isLoading && (data?.lines.length ?? 0) === 0 ? (
        <Empty image={<InboxOutlined style={{ fontSize: 40, opacity: 0.35 }} />} description={t('caseContent.empty')} />
      ) : (
        <Table<CaseContentLine>
          size="small"
          rowKey="id"
          loading={isLoading}
          dataSource={data?.lines}
          pagination={false}
          columns={[
            { title: t('equipment.code'), dataIndex: 'equipmentCode', width: 120 },
            {
              title: t('equipment.name'),
              ellipsis: true,
              render: (_: unknown, l: CaseContentLine) => (
                <>
                  {l.equipmentName}
                  {l.unitInternalRef && <Tag style={{ marginInlineStart: 8 }}>{l.unitInternalRef}</Tag>}
                </>
              ),
            },
            {
              title: t('caseContent.quantity'),
              width: 140,
              align: 'end',
              render: (_: unknown, l: CaseContentLine) =>
                l.unitId ? (
                  <Typography.Text type="secondary">1</Typography.Text>
                ) : manage ? (
                  <InputNumber
                    size="small"
                    min={1}
                    max={10000}
                    value={l.quantity}
                    style={{ width: 90 }}
                    onChange={(v) => v && v !== l.quantity && setQuantity.mutate({ lineId: l.id, quantity: v })}
                  />
                ) : (
                  l.quantity
                ),
            },
            {
              title: t('caseContent.weight'),
              width: 120,
              align: 'end',
              render: (_: unknown, l: CaseContentLine) => (l.weightKg != null ? `${f.number(l.weightKg * l.quantity)} kg` : '—'),
            },
            ...(manage
              ? [{
                  title: '',
                  width: 60,
                  render: (_: unknown, l: CaseContentLine) => (
                    <Popconfirm title={t('caseContent.removeConfirm')} onConfirm={() => remove.mutate(l.id)}
                      okText={t('common.delete')} cancelText={t('common.cancel')}>
                      <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ),
                }]
              : []),
          ]}
        />
      )}

      <AddContentModal open={adding} caseId={equipment.id} onClose={() => setAdding(false)} onAdded={put} />
    </>
  );
}

function Summary({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{label}</Typography.Text>{' '}
      <Typography.Text strong={strong}>{value}</Typography.Text>
    </span>
  );
}

/**
 * Putting something in: pick the equipment, then - if it is serial-tracked - the device itself. Devices that
 * are in another case or out on a job are listed with the reason and cannot be picked.
 */
function AddContentModal({ open, caseId, onClose, onAdded }: {
  open: boolean;
  caseId: Guid;
  onClose: () => void;
  onAdded: (next: CaseContents) => void;
}) {
  const { t } = useTranslation();
  const showError = useErrorToast();
  const [equipmentId, setEquipmentId] = useState<Guid | null>(null);
  const [unitId, setUnitId] = useState<Guid | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [text, setText] = useState('');

  const lookup = useQuery({
    queryKey: ['equipment-lookup', text],
    queryFn: () => equipmentApi.lookup(text),
    enabled: open,
  });
  const picked = lookup.data?.find((e) => e.id === equipmentId);
  const options = useQuery({
    queryKey: ['case-unit-options', caseId, equipmentId],
    queryFn: () => equipmentApi.caseUnitOptions(caseId, equipmentId!),
    enabled: open && !!equipmentId && !!picked?.isSerialized,
  });

  const close = () => {
    setEquipmentId(null);
    setUnitId(null);
    setQuantity(1);
    onClose();
  };

  const add = useMutation({
    mutationFn: () => equipmentApi.addCaseContent(caseId, { equipmentId: equipmentId!, unitId, quantity }),
    onSuccess: (next) => { onAdded(next); close(); },
    onError: showError,
  });

  const needsUnit = !!picked?.isSerialized;
  const ready = !!equipmentId && (!needsUnit || !!unitId);

  return (
    <Modal open={open} onCancel={close} title={t('caseContent.add')} okText={t('common.add')} cancelText={t('common.cancel')}
      okButtonProps={{ disabled: !ready, loading: add.isPending }} onOk={() => add.mutate()}>
      <Flex vertical gap={12} style={{ marginTop: 12 }}>
        <Select
          showSearch
          allowClear
          placeholder={t('caseContent.pickEquipment')}
          value={equipmentId}
          filterOption={false}
          onSearch={setText}
          onChange={(v) => { setEquipmentId(v ?? null); setUnitId(null); }}
          options={(lookup.data ?? []).map((e) => ({ value: e.id, label: `${e.code} · ${e.name}` }))}
        />

        {needsUnit && (
          <>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('caseContent.pickUnit')}</Typography.Text>
            <Radio.Group value={unitId} onChange={(e) => setUnitId(e.target.value)} style={{ width: '100%' }}>
              <Flex vertical gap={4} style={{ maxHeight: 260, overflow: 'auto' }}>
                {(options.data ?? []).map((u: CaseUnitOption) => (
                  <Radio key={u.unitId} value={u.unitId} disabled={!u.isAvailable}>
                    <Space size={6}>
                      <span>{u.internalRef}</span>
                      {u.serialNumber && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{u.serialNumber}</Typography.Text>}
                      {u.inCaseName && <Tag color="orange">{t('caseContent.inCase', { name: u.inCaseName })}</Tag>}
                      {!u.inCaseName && u.onProjectName && <Tag color="blue">{u.onProjectName}</Tag>}
                      {!u.inCaseName && !u.onProjectName && !u.isAvailable && <Tag>{t(`enums.unitStatus.${u.status}`)}</Tag>}
                    </Space>
                  </Radio>
                ))}
                {options.data?.length === 0 && <Typography.Text type="secondary">{t('caseContent.noUnits')}</Typography.Text>}
              </Flex>
            </Radio.Group>
          </>
        )}

        {!needsUnit && equipmentId && (
          <Space>
            <Typography.Text type="secondary">{t('caseContent.quantity')}</Typography.Text>
            <InputNumber min={1} max={10000} value={quantity} onChange={(v) => setQuantity(v ?? 1)} />
          </Space>
        )}
      </Flex>
    </Modal>
  );
}
