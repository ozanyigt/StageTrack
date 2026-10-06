import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Drawer, Form, Input, Row, Space, Table, Typography } from 'antd';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supplierApi } from '../../api/endpoints';
import type { Supplier, SupplierInput } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { ExportButton } from '../../components/ExcelButtons';
import { useErrorToast } from '../../utils/errors';
import { fetchAllPages } from '../../utils/excel';
import { useDebounced } from '../../utils/useDebounced';
import { useGuardedForm } from '../../components/useGuardedModal';

const PAGE_SIZE = 25;

/** Suppliers of equipment, devices and repairs (kept separately from customers). */
export function SupplierListPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { modal, message } = App.useApp();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<SupplierInput>();
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
  const guard = useGuardedForm(!!editing, async () => save.mutateAsync(await form.validateFields()));
  const search = useDebounced(text, 300);
  const manage = can(Permissions.SuppliersManage);

  const list = useQuery({
    queryKey: ['suppliers', search, page],
    queryFn: () => supplierApi.list({ text: search, skipCount: (page - 1) * PAGE_SIZE, maxResultCount: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    queryClient.invalidateQueries({ queryKey: ['supplier-lookup'] });
  };

  const save = useMutation({
    mutationFn: (v: SupplierInput) => (editing && editing !== 'new' ? supplierApi.update(editing.id, v) : supplierApi.create(v)),
    onSuccess: () => {
      message.success(t('common.saved'));
      refresh();
      setEditing(null);
    },
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => supplierApi.remove(id),
    onSuccess: () => {
      refresh();
      setEditing(null);
    },
    onError: showError,
  });

  const open = (s: Supplier | 'new') => {
    form.resetFields();
    if (s !== 'new') form.setFieldsValue(s);
    setEditing(s);
  };

  const fields: { key: keyof SupplierInput; label: string }[] = [
    { key: 'name', label: t('suppliers.name') },
    { key: 'contactPerson', label: t('suppliers.contactPerson') },
    { key: 'email', label: t('suppliers.email') },
    { key: 'phone', label: t('suppliers.phone') },
    { key: 'taxNumber', label: t('suppliers.taxNumber') },
    { key: 'taxOffice', label: t('suppliers.taxOffice') },
    { key: 'address', label: t('suppliers.address') },
    { key: 'city', label: t('suppliers.city') },
    { key: 'country', label: t('suppliers.country') },
    { key: 'website', label: t('suppliers.website') },
    { key: 'notes', label: t('common.notes') },
  ];

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('suppliers.title')}</Typography.Title>
        <Space wrap>
          <ExportButton<Supplier>
            fileName={t('suppliers.title')}
            load={() => fetchAllPages((skipCount, maxResultCount) => supplierApi.list({ text: search, skipCount, maxResultCount }))}
            columns={fields.map((f) => ({ header: f.label, value: (s: Supplier) => s[f.key] }))}
          />
          {manage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => open('new')}>
              {t('suppliers.create')}
            </Button>
          )}
        </Space>
      </div>
      <Card size="small">
        <Input.Search
          allowClear
          placeholder={t('suppliers.searchPlaceholder')}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPage(1);
          }}
          style={{ maxWidth: 360, marginBottom: 12 }}
        />
        <Table
          size="small"
          rowKey="id"
          loading={list.isFetching}
          dataSource={list.data?.items}
          scroll={{ x: 800 }}
          onRow={(s) => ({ onClick: () => manage && open(s), style: { cursor: manage ? 'pointer' : undefined } })}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.totalCount, onChange: setPage, showSizeChanger: false }}
          columns={[
            { title: t('suppliers.name'), dataIndex: 'name', ellipsis: true },
            { title: t('suppliers.contactPerson'), dataIndex: 'contactPerson', width: 170, responsive: ['md'] },
            {
              title: t('suppliers.phone'),
              dataIndex: 'phone',
              width: 150,
              render: (v?: string | null) => (v ? <a href={`tel:${v}`} onClick={(e) => e.stopPropagation()}>{v}</a> : null),
            },
            {
              title: t('suppliers.email'),
              dataIndex: 'email',
              width: 200,
              ellipsis: true,
              responsive: ['lg'],
              render: (v?: string | null) => (v ? <a href={`mailto:${v}`} onClick={(e) => e.stopPropagation()}>{v}</a> : null),
            },
            { title: t('suppliers.city'), dataIndex: 'city', width: 120 },
            { title: t('suppliers.taxNumber'), dataIndex: 'taxNumber', width: 130, responsive: ['xl'] },
          ]}
        />
      </Card>

      <Drawer
        open={!!editing}
        width={520}
        onClose={guard.guardClose(() => setEditing(null))}
        title={editing === 'new' ? t('suppliers.create') : t('suppliers.edit')}
        destroyOnHidden
        extra={
          <Space>
            {editing && editing !== 'new' && (
              <Button
                danger
                icon={<DeleteOutlined />}
                aria-label={t('common.delete')}
                onClick={() => modal.confirm({ title: t('suppliers.deleteConfirm'), onOk: () => remove.mutateAsync(editing.id) })}
              />
            )}
            <Button type="primary" loading={save.isPending} onClick={() => form.submit()}>
              {t('common.save')}
            </Button>
          </Space>
        }
      >
        <Form form={form} onValuesChange={guard.onValuesChange} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="name" label={t('suppliers.name')} rules={[{ required: true, whitespace: true, message: t('validation.required') }]}>
            <Input maxLength={256} />
          </Form.Item>
          <Form.Item name="contactPerson" label={t('suppliers.contactPerson')}>
            <Input maxLength={128} />
          </Form.Item>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="email" label={t('suppliers.email')} rules={[{ type: 'email', message: t('validation.email') }]}>
                <Input maxLength={256} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label={t('suppliers.phone')}>
                <Input maxLength={32} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="taxNumber" label={t('suppliers.taxNumber')}>
                <Input maxLength={32} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="taxOffice" label={t('suppliers.taxOffice')}>
                <Input maxLength={128} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label={t('suppliers.address')}>
            <Input.TextArea rows={2} maxLength={512} />
          </Form.Item>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="city" label={t('suppliers.city')}>
                <Input maxLength={128} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="country" label={t('suppliers.country')}>
                <Input maxLength={128} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="website" label={t('suppliers.website')}>
            <Input maxLength={256} />
          </Form.Item>
          <Form.Item name="notes" label={t('common.notes')}>
            <Input.TextArea rows={3} maxLength={2000} />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
