import { DeleteOutlined, MinusCircleOutlined, PlusOutlined, StarFilled } from '@ant-design/icons';
import { Alert, App, Button, Card, Col, Empty, Flex, Form, Input, InputNumber, List, Row, Space, Switch, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rentalFactorApi } from '../../api/endpoints';
import type { RentalFactorProfile, RentalFactorProfileInput } from '../../api/types';
import { useErrorToast } from '../../utils/errors';
import { useFormat } from '../../utils/format';

/**
 * Day multiplier tables. The company admin defines them (we do not know the customer's multipliers in advance):
 * a quote line costs daily price × quantity × multiplier(rental days).
 */
export function RentalFactorsPage() {
  const { t } = useTranslation();
  const { modal, message } = App.useApp();
  const f = useFormat();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<RentalFactorProfileInput>();
  const [selected, setSelected] = useState<RentalFactorProfile | 'new' | null>(null);

  const profiles = useQuery({ queryKey: ['rental-factors'], queryFn: rentalFactorApi.list });
  const selectedId = selected && selected !== 'new' ? selected.id : null;
  const preview = useQuery({
    queryKey: ['rental-factor-preview', selectedId, selected !== 'new' && selected ? JSON.stringify(selected.steps) + selected.extraDayFactor : ''],
    queryFn: () => rentalFactorApi.preview(selectedId!, 14),
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (!selected && profiles.data?.length) setSelected(profiles.data[0]);
  }, [profiles.data, selected]);

  useEffect(() => {
    form.resetFields();
    if (selected === 'new') form.setFieldsValue({ name: '', isDefault: false, extraDayFactor: 0.5, steps: [{ days: 1, factor: 1 }, { days: 2, factor: 1.5 }] });
    else if (selected) form.setFieldsValue(selected);
  }, [selected, form]);

  const save = useMutation({
    mutationFn: (v: RentalFactorProfileInput) =>
      selected && selected !== 'new' ? rentalFactorApi.update(selected.id, v) : rentalFactorApi.create(v),
    onSuccess: (p) => {
      message.success(t('common.saved'));
      queryClient.invalidateQueries({ queryKey: ['rental-factors'] });
      setSelected(p);
    },
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => rentalFactorApi.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rental-factors'] }); setSelected(null); },
    onError: showError,
  });

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('rentalFactors.title')}</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setSelected('new')}>{t('rentalFactors.create')}</Button>
      </div>
      <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('rentalFactors.explain')} description={t('rentalFactors.explainDetail')} />
      <Row gutter={[12, 12]}>
        <Col xs={24} md={7}>
          <Card size="small" title={t('rentalFactors.profiles')}>
            <List
              loading={profiles.isLoading}
              dataSource={profiles.data}
              renderItem={(p) => (
                <List.Item
                  onClick={() => setSelected(p)}
                  style={{ cursor: 'pointer', fontWeight: selectedId === p.id ? 600 : undefined }}
                  extra={p.isDefault && <Tag icon={<StarFilled />} color="orange">{t('rentalFactors.default')}</Tag>}
                >
                  {p.name}
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card
            size="small"
            title={selected === 'new' ? t('rentalFactors.create') : t('rentalFactors.edit')}
            extra={selectedId && (
              <Button size="small" danger icon={<DeleteOutlined />} aria-label={t('common.delete')}
                onClick={() => modal.confirm({ title: t('rentalFactors.deleteConfirm'), onOk: () => remove.mutateAsync(selectedId) })} />
            )}
          >
            {!selected ? <Empty /> : (
              <Form form={form} layout="vertical" onFinish={(v) => save.mutate({ ...v, steps: [...v.steps].sort((a, b) => a.days - b.days) })}>
                <Form.Item name="name" label={t('rentalFactors.name')} rules={[{ required: true, message: t('validation.required') }]}>
                  <Input />
                </Form.Item>
                <Space size="large" wrap>
                  <Form.Item name="isDefault" label={t('rentalFactors.isDefault')} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name="extraDayFactor" label={t('rentalFactors.extraDayFactor')} tooltip={t('rentalFactors.extraDayFactorHint')}>
                    <InputNumber min={0} step={0.1} />
                  </Form.Item>
                </Space>
                <Typography.Text strong>{t('rentalFactors.steps')}</Typography.Text>
                <Form.List name="steps">
                  {(fields, { add, remove: removeField }) => (
                    <>
                      {fields.map((field) => (
                        <Flex key={field.key} gap={8} align="baseline" style={{ marginTop: 8 }}>
                          <Form.Item name={[field.name, 'days']} rules={[{ required: true, message: t('validation.required') }]} style={{ marginBottom: 0 }}>
                            <InputNumber min={1} max={365} addonAfter={t('rentalFactors.days')} style={{ width: 150 }} />
                          </Form.Item>
                          <span>→ ×</span>
                          <Form.Item name={[field.name, 'factor']} rules={[{ required: true, message: t('validation.required') }]} style={{ marginBottom: 0 }}>
                            <InputNumber min={0.01} step={0.25} style={{ width: 110 }} />
                          </Form.Item>
                          <Button type="text" icon={<MinusCircleOutlined />} onClick={() => removeField(field.name)} aria-label={t('common.delete')} />
                        </Flex>
                      ))}
                      <Button type="dashed" icon={<PlusOutlined />} style={{ marginTop: 8 }}
                        onClick={() => {
                          const steps: { days: number; factor: number }[] = form.getFieldValue('steps') ?? [];
                          const last = steps.reduce((m, s) => (s && s.days > m.days ? s : m), { days: 0, factor: 0.5 });
                          add({ days: last.days + 1, factor: Number((last.factor + 0.5).toFixed(2)) });
                        }}>
                        {t('rentalFactors.addStep')}
                      </Button>
                    </>
                  )}
                </Form.List>
                <Button type="primary" htmlType="submit" block loading={save.isPending} style={{ marginTop: 16 }}>{t('common.save')}</Button>
              </Form>
            )}
          </Card>
        </Col>
        <Col xs={24} md={7}>
          <Card size="small" title={t('rentalFactors.preview')}>
            {!selectedId ? <Typography.Text type="secondary">{t('rentalFactors.previewHint')}</Typography.Text> : (
              <Table
                size="small"
                rowKey="days"
                pagination={false}
                loading={preview.isFetching}
                dataSource={preview.data}
                columns={[
                  { title: t('rentalFactors.days'), dataIndex: 'days', width: 70 },
                  { title: t('rentalFactors.factor'), dataIndex: 'factor', render: (v: number, r) => <span style={{ fontWeight: r.isDefinedStep ? 600 : 400 }}>×{f.number(v, 4)}</span> },
                  { title: '', dataIndex: 'isDefinedStep', width: 90, render: (v: boolean) => (v ? <Tag>{t('rentalFactors.defined')}</Tag> : <Tag color="default">{t('rentalFactors.derived')}</Tag>) },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}
