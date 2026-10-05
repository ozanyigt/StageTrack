import { SaveOutlined } from '@ant-design/icons';
import { App, Button, Col, Descriptions, Divider, Form, Input, InputNumber, Row, Select, Switch, TreeSelect } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { equipmentApi, folderApi } from '../../api/endpoints';
import { EQUIPMENT_TYPES, type EquipmentDetail, type EquipmentInput } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { useErrorToast } from '../../utils/errors';
import { useFormat } from '../../utils/format';
import { buildFolderTree } from './folderTree';

/** Full update payload built from the loaded detail; tabs change only their own fields. */
export function toEquipmentInput(e: EquipmentDetail, canSeePrice: boolean): EquipmentInput {
  return {
    code: e.code,
    name: e.name,
    brand: e.brand,
    model: e.model,
    folderId: e.folderId,
    type: e.type,
    isSerialized: e.isSerialized,
    countryOfOrigin: e.countryOfOrigin,
    stockQuantity: e.stockQuantity,
    rentalPrice: canSeePrice ? e.rentalPrice : null,
    lengthCm: e.lengthCm,
    widthCm: e.widthCm,
    heightCm: e.heightCm,
    weightKg: e.weightKg,
    volumeM3: e.volumeM3,
    powerW: e.powerW,
    currentA: e.currentA,
    packedPer: e.packedPer || 1,
    inspectionIntervalMonths: e.inspectionIntervalMonths,
    inspectionDescription: e.inspectionDescription,
    notes: e.notes,
  };
}

/** Rentman "Properties" tab: edited in place, saved with one button. Read-only without Equipment.Manage. */
export function EquipmentPropertiesTab({ equipment }: { equipment: EquipmentDetail }) {
  const { t } = useTranslation();
  const { can, company } = useAuth();
  const { message } = App.useApp();
  const f = useFormat();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<EquipmentInput>();
  const manage = can(Permissions.EquipmentManage);
  const showPrice = can(Permissions.Prices);
  const { data: folders = [] } = useQuery({ queryKey: ['folders'], queryFn: folderApi.list });

  useEffect(() => {
    form.setFieldsValue(toEquipmentInput(equipment, showPrice));
  }, [equipment, form, showPrice]);

  const [length, width, height, isSerialized] = [
    Form.useWatch('lengthCm', form),
    Form.useWatch('widthCm', form),
    Form.useWatch('heightCm', form),
    Form.useWatch('isSerialized', form),
  ];
  const computedVolume = length && width && height ? (length * width * height) / 1_000_000 : null;

  const save = useMutation({
    mutationFn: (values: EquipmentInput) =>
      equipmentApi.update(equipment.id, {
        ...toEquipmentInput(equipment, showPrice),
        ...values,
        volumeM3: computedVolume ?? values.volumeM3,
        rentalPrice: showPrice ? values.rentalPrice : null,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['equipment', equipment.id], saved);
      queryClient.invalidateQueries({ queryKey: ['equipment', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      message.success(t('common.saved'));
    },
    onError: showError,
  });

  if (!manage) {
    const dim = (v?: number | null, unit = '') => (v == null ? '—' : `${f.number(v, 3)}${unit}`);
    return (
      <Descriptions size="small" bordered column={{ xs: 1, md: 2 }}>
        <Descriptions.Item label={t('equipment.code')}>{equipment.code}</Descriptions.Item>
        <Descriptions.Item label={t('equipment.name')}>{equipment.name}</Descriptions.Item>
        <Descriptions.Item label={t('equipment.brand')}>{equipment.brand ?? '—'}</Descriptions.Item>
        <Descriptions.Item label={t('equipment.model')}>{equipment.model ?? '—'}</Descriptions.Item>
        <Descriptions.Item label={t('equipment.folder')}>{equipment.folderPath ?? '—'}</Descriptions.Item>
        <Descriptions.Item label={t('equipment.type')}>{t(`enums.equipmentType.${equipment.type}`)}</Descriptions.Item>
        <Descriptions.Item label={t('equipment.countryOfOrigin')}>{equipment.countryOfOrigin ?? '—'}</Descriptions.Item>
        {equipment.rentalPrice != null && (
          <Descriptions.Item label={t('equipment.dailyPrice')}>{f.money(equipment.rentalPrice, company?.defaultCurrency ?? 'TRY')}</Descriptions.Item>
        )}
        <Descriptions.Item label={t('equipment.dimensions')}>
          {dim(equipment.lengthCm)} × {dim(equipment.widthCm)} × {dim(equipment.heightCm)} cm
        </Descriptions.Item>
        <Descriptions.Item label={t('equipment.weightKg')}>{dim(equipment.weightKg)}</Descriptions.Item>
        <Descriptions.Item label={t('equipment.volumeM3')}>{dim(equipment.volumeM3)}</Descriptions.Item>
        <Descriptions.Item label={t('equipment.powerW')}>{dim(equipment.powerW)}</Descriptions.Item>
        <Descriptions.Item label={t('equipment.currentA')}>{dim(equipment.currentA)}</Descriptions.Item>
        <Descriptions.Item label={t('equipment.packedPer')}>{equipment.packedPer}</Descriptions.Item>
        <Descriptions.Item label={t('common.notes')} span={2}>
          <span style={{ whiteSpace: 'pre-wrap' }}>{equipment.notes ?? '—'}</span>
        </Descriptions.Item>
      </Descriptions>
    );
  }

  const num = (name: keyof EquipmentInput, label: string, extra?: string, step = 1) => (
    <Col xs={12} md={6}>
      <Form.Item name={name} label={label} extra={extra}>
        <InputNumber min={0} step={step} style={{ width: '100%' }} />
      </Form.Item>
    </Col>
  );

  return (
    <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
      <Row gutter={12}>
        <Col xs={24} md={8}>
          <Form.Item name="code" label={t('equipment.code')} rules={[{ required: true, message: t('validation.required') }, { max: 64 }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={16}>
          <Form.Item name="name" label={t('equipment.name')} rules={[{ required: true, message: t('validation.required') }, { max: 256 }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={12} md={8}>
          <Form.Item name="brand" label={t('equipment.brand')}>
            <Input maxLength={128} />
          </Form.Item>
        </Col>
        <Col xs={12} md={8}>
          <Form.Item name="model" label={t('equipment.model')}>
            <Input maxLength={128} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="countryOfOrigin" label={t('equipment.countryOfOrigin')}>
            <Input maxLength={64} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="folderId" label={t('equipment.folder')}>
            <TreeSelect allowClear treeDefaultExpandAll treeData={buildFolderTree(folders)} />
          </Form.Item>
        </Col>
        <Col xs={12} md={8}>
          <Form.Item name="type" label={t('equipment.type')}>
            <Select options={EQUIPMENT_TYPES.map((v) => ({ value: v, label: t(`enums.equipmentType.${v}`) }))} />
          </Form.Item>
        </Col>
        <Col xs={12} md={8}>
          <Form.Item name="isSerialized" label={t('equipment.isSerialized')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        {showPrice && (
          <Col xs={12} md={8}>
            <Form.Item name="rentalPrice" label={t('equipment.rentalPrice', { currency: company?.defaultCurrency })} extra={t('equipment.rentalPriceHint')}>
              <InputNumber min={0} step={50} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        )}
        {!isSerialized && (
          <Col xs={12} md={8}>
            <Form.Item name="stockQuantity" label={t('equipment.stockQuantity')}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        )}
      </Row>

      <Divider orientation="left" plain>
        {t('equipment.physical')}
      </Divider>
      <Row gutter={12}>
        {num('lengthCm', t('equipment.lengthCm'))}
        {num('widthCm', t('equipment.widthCm'))}
        {num('heightCm', t('equipment.heightCm'))}
        {num('weightKg', t('equipment.weightKg'), undefined, 0.5)}
        <Col xs={12} md={6}>
          <Form.Item
            name="volumeM3"
            label={t('equipment.volumeM3')}
            extra={computedVolume != null ? t('equipment.volumeAuto', { value: f.number(computedVolume, 3) }) : undefined}
          >
            <InputNumber min={0} step={0.01} disabled={computedVolume != null} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        {num('powerW', t('equipment.powerW'))}
        {num('currentA', t('equipment.currentA'), undefined, 0.1)}
        <Col xs={12} md={6}>
          <Form.Item name="packedPer" label={t('equipment.packedPer')} extra={t('equipment.packedPerHint')}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="notes" label={t('common.notes')}>
        <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} maxLength={4000} />
      </Form.Item>
      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={save.isPending}>
        {t('common.save')}
      </Button>
    </Form>
  );
}
