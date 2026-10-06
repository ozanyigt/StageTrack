import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Form, Input, Modal, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { stockLocationApi } from '../../api/endpoints';
import { STOCK_LOCATION_TYPES, type StockLocation } from '../../api/types';
import { ExportButton } from '../../components/ExcelButtons';
import { useErrorToast } from '../../utils/errors';
import { useGuardedForm } from '../../components/useGuardedModal';

type LocationForm = Omit<StockLocation, 'id'>;

export function StockLocationsPage() {
  const { t } = useTranslation();
  const { modal } = App.useApp();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<LocationForm>();
  const [editing, setEditing] = useState<StockLocation | 'new' | null>(null);
  const guard = useGuardedForm(!!editing, async () => save.mutateAsync(await form.validateFields()));
  const { data, isLoading } = useQuery({ queryKey: ['stock-locations'], queryFn: stockLocationApi.list });

  const save = useMutation({
    mutationFn: (v: LocationForm) => (editing && editing !== 'new' ? stockLocationApi.update(editing.id, v) : stockLocationApi.create(v)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['stock-locations'] }); setEditing(null); },
    onError: showError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => stockLocationApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stock-locations'] }),
    onError: showError,
  });

  const open = (l: StockLocation | 'new') => {
    form.resetFields();
    form.setFieldsValue(l === 'new' ? { type: 'Warehouse', isActive: true } : l);
    setEditing(l);
  };

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('stockLocations.title')}</Typography.Title>
        <Space wrap>
          <ExportButton<StockLocation>
            fileName={t('stockLocations.title')}
            load={async () => data ?? []}
            columns={[
              { header: t('stockLocations.name'), value: (l) => l.name },
              { header: t('stockLocations.type'), value: (l) => t(`enums.stockLocationType.${l.type}`) },
              { header: t('stockLocations.address'), value: (l) => l.address },
              { header: t('stockLocations.city'), value: (l) => l.city },
              { header: t('stockLocations.active'), value: (l) => (l.isActive ? t('common.yes') : t('common.no')) },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => open('new')}>{t('stockLocations.create')}</Button>
        </Space>
      </div>
      <Card size="small">
        <Table
          size="small"
          rowKey="id"
          loading={isLoading}
          dataSource={data}
          pagination={false}
          onRow={(l) => ({ onClick: () => open(l), style: { cursor: 'pointer' } })}
          columns={[
            { title: t('stockLocations.name'), dataIndex: 'name' },
            { title: t('stockLocations.type'), dataIndex: 'type', render: (v) => t(`enums.stockLocationType.${v}`) },
            { title: t('stockLocations.address'), dataIndex: 'address', ellipsis: true, responsive: ['md'] },
            { title: t('stockLocations.city'), dataIndex: 'city' },
            { title: t('stockLocations.active'), dataIndex: 'isActive', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? t('common.yes') : t('common.no')}</Tag> },
            {
              title: '', width: 50,
              render: (_, l) => (
                <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t('common.delete')}
                  onClick={(e) => { e.stopPropagation(); modal.confirm({ title: t('stockLocations.deleteConfirm'), onOk: () => remove.mutateAsync(l.id) }); }} />
              ),
            },
          ]}
        />
      </Card>
      <Modal
        open={!!editing}
        title={editing === 'new' ? t('stockLocations.create') : t('stockLocations.edit')}
        onCancel={guard.guardClose(() => setEditing(null))}
        onOk={() => form.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={save.isPending}
        destroyOnHidden
      >
        <Form form={form} onValuesChange={guard.onValuesChange} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="name" label={t('stockLocations.name')} rules={[{ required: true, message: t('validation.required') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label={t('stockLocations.type')}>
            <Select options={STOCK_LOCATION_TYPES.map((v) => ({ value: v, label: t(`enums.stockLocationType.${v}`) }))} />
          </Form.Item>
          <Form.Item name="address" label={t('stockLocations.address')}>
            <Input />
          </Form.Item>
          <Space>
            <Form.Item name="city" label={t('stockLocations.city')}>
              <Input />
            </Form.Item>
            <Form.Item name="isActive" label={t('stockLocations.active')} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  );
}
