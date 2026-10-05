import { Button, Drawer, Form, Input, InputNumber, Select, Space, Switch, TreeSelect } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { equipmentApi, folderApi } from '../../api/endpoints';
import { EQUIPMENT_TYPES, type Equipment, type EquipmentInput } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
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
    form.setFieldsValue({ type: 'Physical', isSerialized: true, stockQuantity: 0, rentalPrice: 0, packedPer: 1, folderId: defaultFolderId ?? null });
  }, [open, defaultFolderId, form]);

  const save = useMutation({
    mutationFn: (values: EquipmentInput) => equipmentApi.create({ ...values, packedPer: 1, rentalPrice: showPrice ? values.rentalPrice : null }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      onSaved(saved);
    },
    onError: showError,
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={480}
      title={t('equipment.createTitle')}
      destroyOnHidden
      extra={
        <Space>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="primary" loading={save.isPending} onClick={() => form.submit()}>
            {t('common.save')}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
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
        <Form.Item name="isSerialized" label={t('equipment.isSerialized')} valuePropName="checked" extra={t('equipment.isSerializedHint')}>
          <Switch />
        </Form.Item>
        {!isSerialized && (
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
