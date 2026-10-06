import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, Col, Flex, Form, Input, InputNumber, Modal, Popconfirm, Row, Space, Table, Tag, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { labelTemplateApi } from '../../api/endpoints';
import type { LabelTemplate, LabelTemplateInput, PrintLabelItem } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useGuardedForm } from '../../components/useGuardedModal';
import { useErrorToast } from '../../utils/errors';
import { LabelPreview } from '../equipment/LabelPreview';

const SAMPLE: PrintLabelItem = {
  equipmentId: 'sample',
  equipmentCode: 'AUD-001',
  equipmentName: 'L-ACOUSTICS K3 LINE ARRAY',
  brand: 'L-Acoustics',
  model: 'K3',
  internalRef: 'AUD-001-07',
  serialNumber: 'K3-2231-0457',
  qrValue: '{"ID":"80000123","cmpID":16,"isCase":0}',
  code: 'RM:16:S:80000123',
  isNew: false,
};

const DEFAULTS: LabelTemplateInput = {
  name: '',
  widthMm: 60,
  heightMm: 30,
  qrSizeMm: 24,
  fontSizePt: 7,
  showName: true,
  showBrand: true,
  showModel: true,
  showCode: false,
  showInternalRef: true,
  showSerialNumber: true,
  showCompanyName: false,
  isDefault: false,
};

const FIELDS = ['showName', 'showBrand', 'showModel', 'showCode', 'showInternalRef', 'showSerialNumber', 'showCompanyName'] as const;

/** Label sizes and contents used when printing QR labels (no letterhead; QR + device information only). */
export function LabelTemplatesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { company } = useAuth();
  const showError = useErrorToast();
  const { data = [], isFetching } = useQuery({ queryKey: ['label-templates'], queryFn: labelTemplateApi.list });
  const [editing, setEditing] = useState<LabelTemplate | 'new' | null>(null);
  const [form] = Form.useForm<LabelTemplateInput>();
  const live = Form.useWatch([], form) as LabelTemplateInput | undefined;
  const [saving, setSaving] = useState(false);
  const guard = useGuardedForm(!!editing, () => save());

  const refresh = () => qc.invalidateQueries({ queryKey: ['label-templates'] });

  const open = (tpl: LabelTemplate | 'new') => {
    setEditing(tpl);
    form.setFieldsValue(tpl === 'new' ? DEFAULTS : tpl);
  };

  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const input = { ...DEFAULTS, ...values, name: values.name.trim() };
      if (editing === 'new') await labelTemplateApi.create(input);
      else if (editing) await labelTemplateApi.update(editing.id, input);
      setEditing(null);
      refresh();
    } catch (e) {
      showError(e);
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const preview = { ...DEFAULTS, ...(live ?? {}) };
  const previewValid = preview.widthMm >= 10 && preview.heightMm >= 10 && preview.qrSizeMm >= 5 && preview.fontSizePt >= 4;

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('labelTemplates.title')}</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => open('new')}>
          {t('labelTemplates.create')}
        </Button>
      </div>
      <Card size="small">
        <Typography.Paragraph type="secondary">{t('labelTemplates.hint')}</Typography.Paragraph>
        <Table
          size="small"
          rowKey="id"
          loading={isFetching}
          dataSource={data}
          pagination={false}
          scroll={{ x: 700 }}
          columns={[
            {
              title: t('labelTemplates.name'),
              dataIndex: 'name',
              render: (v, x) => (
                <Space>
                  {v}
                  {x.isDefault && <Tag color="blue">{t('labelTemplates.default')}</Tag>}
                </Space>
              ),
            },
            { title: t('labelTemplates.size'), width: 130, render: (_, x) => `${x.widthMm} × ${x.heightMm} mm` },
            { title: t('labelTemplates.qrSize'), dataIndex: 'qrSizeMm', width: 100, render: (v) => `${v} mm` },
            {
              title: t('labelTemplates.fields'),
              render: (_, x) => (
                <Space size={[4, 4]} wrap>
                  {FIELDS.filter((f) => x[f]).map((f) => (
                    <Tag key={f}>{t(`labelTemplates.${f}`)}</Tag>
                  ))}
                </Space>
              ),
            },
            {
              key: 'actions',
              width: 90,
              render: (_, x) => (
                <Space size={2}>
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => open(x)} aria-label={t('common.edit')} />
                  <Popconfirm title={t('labelTemplates.deleteConfirm')} onConfirm={() => labelTemplateApi.remove(x.id).then(refresh).catch(showError)}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={!!editing}
        title={editing === 'new' ? t('labelTemplates.create') : t('labelTemplates.edit')}
        onCancel={guard.guardClose(() => setEditing(null))}
        onOk={() => save().catch(() => undefined)}
        okButtonProps={{ loading: saving }}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        width={760}
        forceRender
      >
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form form={form} layout="vertical" initialValues={DEFAULTS} onValuesChange={guard.onValuesChange}>
              <Form.Item name="name" label={t('labelTemplates.name')} rules={[{ required: true, whitespace: true, message: t('validation.required') }]}>
                <Input maxLength={128} />
              </Form.Item>
              <Flex gap={12}>
                <Form.Item name="widthMm" label={t('labelTemplates.widthMm')} style={{ flex: 1 }} rules={[{ required: true, message: t('validation.required') }]}>
                  <InputNumber min={10} max={300} style={{ width: '100%' }} addonAfter="mm" />
                </Form.Item>
                <Form.Item name="heightMm" label={t('labelTemplates.heightMm')} style={{ flex: 1 }} rules={[{ required: true, message: t('validation.required') }]}>
                  <InputNumber min={10} max={300} style={{ width: '100%' }} addonAfter="mm" />
                </Form.Item>
              </Flex>
              <Flex gap={12}>
                <Form.Item name="qrSizeMm" label={t('labelTemplates.qrSize')} style={{ flex: 1 }} rules={[{ required: true, message: t('validation.required') }]}>
                  <InputNumber min={5} max={300} style={{ width: '100%' }} addonAfter="mm" />
                </Form.Item>
                <Form.Item name="fontSizePt" label={t('labelTemplates.fontSize')} style={{ flex: 1 }} rules={[{ required: true, message: t('validation.required') }]}>
                  <InputNumber min={4} max={24} step={0.5} style={{ width: '100%' }} addonAfter="pt" />
                </Form.Item>
              </Flex>
              <Typography.Text strong>{t('labelTemplates.fields')}</Typography.Text>
              <Row>
                {FIELDS.map((f) => (
                  <Col span={12} key={f}>
                    <Form.Item name={f} valuePropName="checked" style={{ marginBottom: 4 }}>
                      <Checkbox>{t(`labelTemplates.${f}`)}</Checkbox>
                    </Form.Item>
                  </Col>
                ))}
              </Row>
              <Form.Item name="isDefault" valuePropName="checked" style={{ marginTop: 8 }}>
                <Checkbox>{t('labelTemplates.isDefault')}</Checkbox>
              </Form.Item>
            </Form>
          </Col>
          <Col xs={24} md={12}>
            <Typography.Text strong>{t('labelTemplates.preview')}</Typography.Text>
            <div style={{ marginTop: 8, padding: 16, background: '#e9e9ef', borderRadius: 8, overflow: 'auto', display: 'grid', placeItems: 'center', minHeight: 160 }}>
              {previewValid && (
                <div style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
                  <LabelPreview template={preview} item={SAMPLE} companyName={company?.name} />
                </div>
              )}
            </div>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
              {t('labelTemplates.previewHint')}
            </Typography.Paragraph>
          </Col>
        </Row>
      </Modal>
    </>
  );
}
