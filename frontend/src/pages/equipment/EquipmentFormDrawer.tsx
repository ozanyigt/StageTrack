import { Button, Drawer, Form, Input, InputNumber, Radio, Select, Space, TreeSelect, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { equipmentApi, folderApi } from '../../api/endpoints';
import { EQUIPMENT_TYPES, type Equipment, type EquipmentInput } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { useGuardedForm } from '../../components/useGuardedModal';
import { useErrorToast } from '../../utils/errors';
import { buildFolderTree } from './folderTree';

interface Props {
  open: boolean;
  defaultFolderId?: string | null;
  onClose: () => void;
  onSaved: (equipment: Equipment) => void;
}

/** Quick "new equipment" drawer; everything else (dimensions, content, suppliers…) is edited on the detail page. */
export function EquipmentFormDrawer({ open, defaultFolderId, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const { company, can } = useAuth();
  const [form] = Form.useForm<EquipmentInput>();
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const { data: folders = [] } = useQuery({ queryKey: ['folders'], queryFn: folderApi.list });
  const isSerialized = Form.useWatch('isSerialized', form);
  const showPrice = can(Permissions.Prices);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    // No default tracking: the user must decide between quantity and serial numbers.
    form.setFieldsValue({ type: 'Physical', stockQuantity: 0, rentalPrice: 0, packedPer: 1, folderId: defaultFolderId ?? null, showInQuotes: true });
  }, [open, defaultFolderId, form]);

  const save = useMutation({
    mutationFn: (values: EquipmentInput) =>
      equipmentApi.create({
        ...values,
        stockQuantity: values.isSerialized ? 0 : values.stockQuantity ?? 0,
        packedPer: 1,
        rentalPrice: showPrice ? values.rentalPrice : null,
      }),
    onSuccess: (saved) => {
      guard.markSaved();
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      onSaved(saved);
    },
    onError: showError,
  });

  const guard = useGuardedForm(open, async () => save.mutateAsync(await form.validateFields()));
  const close = guard.guardClose(onClose);

  return (
    <Drawer
      open={open}
      onClose={close}
      width={480}
      title={t('equipment.createTitle')}
      destroyOnHidden
      extra={
        <Space>
          <Button onClick={close}>{t('common.cancel')}</Button>
          <Button type="primary" loading={save.isPending} onClick={() => form.submit()}>
            {t('common.save')}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} onValuesChange={guard.onValuesChange}>
        <Form.Item name="code" label={t('equipment.code')} rules={[{ required: true, message: t('validation.required') }, { max: 64 }]}>
          <Input placeholder="VID-020" />
        </Form.Item>
        <Form.Item name="name" label={t('equipment.name')} rules={[{ required: true, message: t('validation.required') }, { max: 256 }]}>
          <Input />
        </Form.Item>
        <Space.Compact block>
          <Form.Item name="brand" label={t('equipment.brand')} style={{ flex: 1 }}>
            <Input />
          </Form.Item>
          <Form.Item name="model" label={t('equipment.model')} style={{ flex: 1 }}>
            <Input />
          </Form.Item>
        </Space.Compact>
        <Form.Item name="folderId" label={t('equipment.folder')}>
          <TreeSelect allowClear treeDefaultExpandAll treeData={buildFolderTree(folders)} />
        </Form.Item>
        <Form.Item name="type" label={t('equipment.type')}>
          <Select options={EQUIPMENT_TYPES.map((v) => ({ value: v, label: t(`enums.equipmentType.${v}`) }))} />
        </Form.Item>
        <Form.Item name="showInQuotes" label={t('equipmentQuote.showInQuotes')} extra={t('equipmentQuote.showInQuotesHint')}>
          <Select options={[{ value: true, label: t('common.yes') }, { value: false, label: t('common.no') }]} />
        </Form.Item>
        <Form.Item
          name="isSerialized"
          label={t('equipmentTracking.label')}
          rules={[{ required: true, message: t('equipmentTracking.required') }]}
        >
          <Radio.Group style={{ width: '100%' }}>
            <Space direction="vertical">
              <Radio value={false}>
                {t('equipmentTracking.quantity')}
                <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{t('equipmentTracking.quantityHint')}</Typography.Text>
              </Radio>
              <Radio value={true}>
                {t('equipmentTracking.serial')}
                <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{t('equipmentTracking.serialHint')}</Typography.Text>
              </Radio>
            </Space>
          </Radio.Group>
        </Form.Item>
        {isSerialized === false && (
          <Form.Item name="stockQuantity" label={t('equipment.stockQuantity')} rules={[{ required: true, message: t('validation.required') }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        )}
        {showPrice && (
          <Form.Item name="rentalPrice" label={t('equipment.rentalPrice', { currency: company?.defaultCurrency })} extra={t('equipment.rentalPriceHint')}>
            <InputNumber min={0} step={50} style={{ width: '100%' }} />
          </Form.Item>
        )}
      </Form>
    </Drawer>
  );
}
