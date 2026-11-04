import { Alert, App, Form, InputNumber, Modal, Segmented, Select, Space, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { equipmentApi, folderApi, ledApi } from '../../api/endpoints';
import type { LedRole } from '../../api/ledTypes';
import type { EquipmentDiscipline } from '../../api/types';
import { TRADE_COLOR } from '../draft/stageProps';
import { useErrorToast } from '../../utils/errors';
import { buildFolderTree } from './folderTree';

interface CommonProps {
  open: boolean;
  ids: string[];
  onClose: () => void;
  onDone: () => void;
}

/**
 * Moving a selection into one folder. The folder is also what gives a product its trade, so this is how forty
 * products get classified in one go - the same job every rental system does with a "change product group" bulk
 * action, and the reason nobody has to open forty cards.
 */
export function MoveToFolderModal({ open, ids, onClose, onDone }: CommonProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const [folderId, setFolderId] = useState<string | null>(null);

  const folders = useQuery({ queryKey: ['folders'], queryFn: folderApi.list, enabled: open });

  useEffect(() => {
    if (open) setFolderId(null);
  }, [open]);

  /** The trade the selection ends up in, so the effect of the move is on screen before it happens. */
  const tradeOf = (id: string | null): EquipmentDiscipline | null => {
    let current = id;
    for (let guard = 0; current && guard < 64; guard++) {
      const folder = folders.data?.find((f) => f.id === current);
      if (folder?.discipline) return folder.discipline;
      current = folder?.parentId ?? null;
    }
    return null;
  };

  const move = useMutation({
    mutationFn: () => equipmentApi.move(ids, folderId),
    onSuccess: (count) => {
      message.success(t('bulk.moved', { count }));
      void queryClient.invalidateQueries({ queryKey: ['equipment'] });
      void queryClient.invalidateQueries({ queryKey: ['folders'] });
      onDone();
      onClose();
    },
    onError: showError,
  });

  const trade = tradeOf(folderId);

  return (
    <Modal
      open={open}
      title={t('bulk.moveTitle', { count: ids.length })}
      okText={t('bulk.move')}
      cancelText={t('common.cancel')}
      onCancel={onClose}
      onOk={() => move.mutate()}
      okButtonProps={{ loading: move.isPending }}
      destroyOnHidden
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>{t('bulk.moveHint')}</Typography.Paragraph>
        <Select
          showSearch
          allowClear
          optionFilterProp="label"
          style={{ width: '100%' }}
          placeholder={t('bulk.pickFolder')}
          value={folderId ?? undefined}
          onChange={(value) => setFolderId(value ?? null)}
          options={flatten(folders.data ?? [])}
        />
        {trade ? (
          <Alert
            type="success"
            showIcon
            message={t('bulk.willBeTrade', { trade: t(`enums.equipmentDiscipline.${trade}`) })}
            style={{ borderInlineStartColor: TRADE_COLOR[trade] }}
          />
        ) : (
          <Alert type="warning" showIcon message={t('bulk.folderHasNoTrade')} description={t('bulk.folderHasNoTradeHint')} />
        )}
      </Space>
    </Modal>
  );
}

/** The folder tree as an indented flat list, which is all a picker needs. */
function flatten(folders: { id: string; name: string; parentId?: string | null }[]) {
  const out: { value: string; label: string }[] = [];
  const walk = (nodes: ReturnType<typeof buildFolderTree>, depth: number) => {
    for (const node of nodes) {
      out.push({ value: node.key, label: `${'— '.repeat(depth)}${node.title}` });
      walk(node.children, depth + 1);
    }
  };
  walk(buildFolderTree(folders as never), 0);
  return out;
}

const ROLES: LedRole[] = ['Panel', 'Processor', 'Extender'];

/**
 * Making a selection into LED panels, processors or extenders at once. Unlike the trade, these carry technical
 * data the calculation really uses - pitch, pixels, ports - so the values are asked for here and written to
 * every selected product. That makes it a tool for one model at a time, which is said plainly on the dialog:
 * sending forty different cabinets through it with one pitch would quietly poison every quote they touch.
 */
export function BulkLedRoleModal({ open, ids, onClose, onDone }: CommonProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<LedRole>('Panel');
  const [form] = Form.useForm();

  useEffect(() => {
    if (!open) return;
    setRole('Panel');
    form.resetFields();
    form.setFieldsValue({ pitchMm: 3.9, widthMm: 500, heightMm: 1000, pixelWidth: 128, pixelHeight: 256, totalPixels: 2_300_000, ethernetPorts: 6, optPorts: 2, fiberPorts: 2, maxPixels: 1_300_000 });
  }, [open, form]);

  const apply = useMutation({
    mutationFn: async () => {
      const v = await form.validateFields();
      for (const id of ids) {
        if (role === 'Panel') {
          await ledApi.savePanel(id, {
            pitchMm: v.pitchMm,
            widthMm: v.widthMm,
            heightMm: v.heightMm,
            pixelWidth: v.pixelWidth,
            pixelHeight: v.pixelHeight,
            panelType: 'Flat',
            group: 'Indoor',
            transportKind: 'Case',
            hasExclusiveProcessors: false,
            compatibleProcessorIds: [],
          } as never);
        } else if (role === 'Processor') {
          await ledApi.saveProcessor(id, { totalPixels: v.totalPixels, ethernetPorts: v.ethernetPorts, optPorts: v.optPorts } as never);
        } else {
          await ledApi.saveExtender(id, { ethernetPorts: v.ethernetPorts, fiberPorts: v.fiberPorts, maxPixels: v.maxPixels } as never);
        }
      }
      return ids.length;
    },
    onSuccess: (count) => {
      message.success(t('bulk.roleApplied', { count, role: t(`enums.ledRole.${role}`) }));
      void queryClient.invalidateQueries({ queryKey: ['led-inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['led-spec'] });
      onDone();
      onClose();
    },
    onError: showError,
  });

  const number = (name: string, label: string, step = 1) => (
    <Form.Item name={name} label={label} rules={[{ required: true, message: t('validation.required') }]} style={{ flex: '1 1 150px' }}>
      <InputNumber min={0} step={step} style={{ width: '100%' }} />
    </Form.Item>
  );

  return (
    <Modal
      open={open}
      title={t('bulk.roleTitle', { count: ids.length })}
      okText={t('bulk.applyRole')}
      cancelText={t('common.cancel')}
      onCancel={onClose}
      onOk={() => apply.mutate()}
      okButtonProps={{ loading: apply.isPending }}
      width={620}
      destroyOnHidden
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Segmented
          block
          value={role}
          onChange={(value) => setRole(value as LedRole)}
          options={ROLES.map((r) => ({ value: r, label: t(`enums.ledRole.${r}`) }))}
        />
        <Alert type="warning" showIcon message={t('bulk.sameValuesWarning')} description={t('bulk.sameValuesHint')} />

        <Form form={form} layout="vertical">
          {role === 'Panel' && (
            <Space wrap style={{ width: '100%' }}>
              {number('pitchMm', t('led.pitch'), 0.1)}
              {number('widthMm', `${t('led.panelSize')} (mm, G)`)}
              {number('heightMm', `${t('led.panelSize')} (mm, Y)`)}
              {number('pixelWidth', t('led.pixelWidth'))}
              {number('pixelHeight', t('led.pixelHeight'))}
            </Space>
          )}
          {role === 'Processor' && (
            <Space wrap style={{ width: '100%' }}>
              {number('totalPixels', t('led.totalPixels'), 10000)}
              {number('ethernetPorts', t('led.ethernetPorts'))}
              {number('optPorts', t('led.optPorts'))}
            </Space>
          )}
          {role === 'Extender' && (
            <Space wrap style={{ width: '100%' }}>
              {number('maxPixels', t('led.maxPixels'), 10000)}
              {number('ethernetPorts', t('led.ethernetPorts'))}
              {number('fiberPorts', t('led.fiberPorts'))}
            </Space>
          )}
        </Form>

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('bulk.roleAfterHint')}</Typography.Text>
      </Space>
    </Modal>
  );
}
