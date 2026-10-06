import { Col, Form, Input, Modal, Row } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { customerApi } from '../api/endpoints';
import type { Customer } from '../api/types';
import { useErrorToast } from '../utils/errors';
import { useUnsavedChanges } from './UnsavedChanges';

type Values = Omit<Customer, 'id'>;

/** New customer straight from a customer picker (e.g. while creating a quote for a first-time customer). */
export function CustomerQuickCreateModal({
  open,
  initialName,
  onClose,
  onCreated,
}: {
  open: boolean;
  initialName?: string;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}) {
  const { t } = useTranslation();
  const showError = useErrorToast();
  const [form] = Form.useForm<Values>();
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ name: initialName ?? '', country: 'Türkiye' } as Values);
    setDirty(false);
  }, [open, initialName, form]);

  const create = useMutation({
    mutationFn: (v: Values) =>
      customerApi.create({
        ...v,
        name: v.name.trim(),
        taxNumber: v.taxNumber?.trim() || null,
        taxOffice: v.taxOffice?.trim() || null,
        contactPerson: v.contactPerson?.trim() || null,
        email: v.email?.trim() || null,
        phone: v.phone?.trim() || null,
        address: v.address?.trim() || null,
        city: v.city?.trim() || null,
        country: v.country?.trim() || null,
        notes: null,
      }),
    onSuccess: (c) => {
      setDirty(false);
      onCreated(c);
    },
    onError: showError,
  });

  const save = () => form.validateFields().then((v) => create.mutateAsync(v));
  const { confirmLeave } = useUnsavedChanges(open && dirty, save);
  const close = async () => {
    if (await confirmLeave()) {
      setDirty(false);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      title={t('customerQuick.title')}
      onCancel={close}
      onOk={() => form.submit()}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={create.isPending}
      width={640}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={(v) => create.mutate(v)} onValuesChange={() => setDirty(true)}>
        <Form.Item name="name" label={t('customers.name')} rules={[{ required: true, whitespace: true, message: t('validation.required') }]}>
          <Input autoFocus maxLength={256} />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item name="taxNumber" label={t('customers.taxNumber')}>
              <Input maxLength={32} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="taxOffice" label={t('customers.taxOffice')}>
              <Input maxLength={128} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="contactPerson" label={t('customers.contactPerson')}>
              <Input maxLength={128} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="phone" label={t('customers.phone')}>
              <Input maxLength={32} />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="email" label={t('customers.email')} rules={[{ type: 'email', message: t('validation.email') }]}>
              <Input maxLength={256} />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="address" label={t('customers.address')}>
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={512} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="city" label={t('customers.city')}>
              <Input maxLength={128} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="country" label={t('customers.country')}>
              <Input maxLength={128} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
