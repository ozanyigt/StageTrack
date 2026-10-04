import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Drawer, Form, Input, Row, Space, Table, Typography } from 'antd';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { customerApi } from '../../api/endpoints';
import type { Customer } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { useErrorToast } from '../../utils/errors';
import { useDebounced } from '../../utils/useDebounced';

const PAGE_SIZE = 25;
type CustomerForm = Omit<Customer, 'id'>;

export function CustomerListPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { modal } = App.useApp();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<CustomerForm>();
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Customer | 'new' | null>(null);
  const search = useDebounced(text, 300);
  const manage = can(Permissions.CustomersManage);

  const list = useQuery({
    queryKey: ['customers', search, page],
    queryFn: () => customerApi.list({ text: search, skipCount: (page - 1) * PAGE_SIZE, maxResultCount: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const save = useMutation({
    mutationFn: (v: CustomerForm) => (editing && editing !== 'new' ? customerApi.update(editing.id, v) : customerApi.create(v)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setEditing(null); },
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => customerApi.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setEditing(null); },
    onError: showError,
  });

  const open = (c: Customer | 'new') => {
    form.resetFields();
    form.setFieldsValue(c === 'new' ? { country: 'Türkiye' } : c);
    setEditing(c);
  };

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('customers.title')}</Typography.Title>
        {manage && <Button type="primary" icon={<PlusOutlined />} onClick={() => open('new')}>{t('customers.create')}</Button>}
      </div>
      <Card size="small">
        <Input.Search allowClear placeholder={t('customers.searchPlaceholder')} value={text}
          onChange={(e) => { setText(e.target.value); setPage(1); }} style={{ maxWidth: 360, marginBottom: 12 }} />
        <Table
          size="small"
          rowKey="id"
          loading={list.isFetching}
          dataSource={list.data?.items}
          scroll={{ x: 800 }}
          onRow={(c) => ({ onClick: () => manage && open(c), style: { cursor: manage ? 'pointer' : undefined } })}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.totalCount, onChange: setPage, showSizeChanger: false }}
          columns={[
            { title: t('customers.name'), dataIndex: 'name', ellipsis: true },
            { title: t('customers.taxNumber'), dataIndex: 'taxNumber', width: 130 },
            { title: t('customers.taxOffice'), dataIndex: 'taxOffice', width: 150, responsive: ['lg'] },
            { title: t('customers.contactPerson'), dataIndex: 'contactPerson', width: 170, responsive: ['md'] },
            { title: t('customers.city'), dataIndex: 'city', width: 120 },
            { title: t('customers.phone'), dataIndex: 'phone', width: 140, responsive: ['xl'] },
          ]}
        />
      </Card>

      <Drawer
        open={!!editing}
        width={520}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? t('customers.create') : t('customers.edit')}
        destroyOnHidden
        extra={
          <Space>
            {editing && editing !== 'new' && (
              <Button danger icon={<DeleteOutlined />} aria-label={t('common.delete')}
                onClick={() => modal.confirm({ title: t('customers.deleteConfirm'), onOk: () => remove.mutateAsync(editing.id) })} />
            )}
            <Button type="primary" loading={save.isPending} onClick={() => form.submit()}>{t('common.save')}</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="name" label={t('customers.name')} rules={[{ required: true, message: t('validation.required') }]}>
            <Input />
          </Form.Item>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="taxNumber" label={t('customers.taxNumber')} rules={[{ pattern: /^[0-9A-Za-z-]{5,32}$/, message: t('validation.invalid') }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="taxOffice" label={t('customers.taxOffice')}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="contactPerson" label={t('customers.contactPerson')}>
            <Input />
          </Form.Item>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="email" label={t('customers.email')} rules={[{ type: 'email', message: t('validation.email') }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label={t('customers.phone')}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label={t('customers.address')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="city" label={t('customers.city')}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="country" label={t('customers.country')}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label={t('common.notes')}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
