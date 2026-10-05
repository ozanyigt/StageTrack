import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Divider, Form, Input, Modal, Row, Statistic, Table, Typography } from 'antd';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { hostApi } from '../../api/endpoints';
import type { Tenant, TenantAdminInput, TenantLocationInput } from '../../api/types';
import { useErrorToast } from '../../utils/errors';
import { useFormat } from '../../utils/format';
import { useDebounced } from '../../utils/useDebounced';
import {
  AdminFields, formToTenant, LocationFields, normalizeLocation, TenantFields, TenantStatusTag, type TenantFormValues,
} from './TenantForms';

const PAGE_SIZE = 25;

type CreateValues = TenantFormValues & { location: TenantLocationInput; admin: TenantAdminInput };

/** Platform admin home: subscribed firms with their status and usage. */
export function HostTenantsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const showError = useErrorToast();
  const f = useFormat();
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm<CreateValues>();
  const search = useDebounced(text, 300);

  const summary = useQuery({ queryKey: ['host-summary'], queryFn: hostApi.summary });
  const list = useQuery({
    queryKey: ['host-tenants', search, page],
    queryFn: () => hostApi.list({ text: search, skipCount: (page - 1) * PAGE_SIZE, maxResultCount: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const create = useMutation({
    mutationFn: (v: CreateValues) =>
      hostApi.create({ ...formToTenant(v), location: normalizeLocation(v.location), admin: { ...v.admin, userName: v.admin.userName.trim() } }),
    onSuccess: (created) => {
      message.success(t('host.created'));
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['host-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['host-summary'] });
      navigate(`/host/tenants/${created.id}`);
    },
    onError: showError,
  });

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      planName: t('host.plans.pro'),
      period: [dayjs().startOf('day'), dayjs().add(1, 'year').subtract(1, 'day')],
      location: { countryCode: 'TR', currency: 'TRY', vatRate: 20, code: 'TR' } as TenantLocationInput,
      admin: { language: 'tr' } as TenantAdminInput,
    });
    setCreateOpen(true);
  };

  const usage = (used: number, max?: number | null) => t('host.usage', { used, max: max ?? '∞' });

  return (
    <>
      <div className="page-header">
        <div>
          <Typography.Title level={3}>{t('host.title')}</Typography.Title>
          <Typography.Text type="secondary">{t('host.subtitle')}</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          {t('host.newTenant')}
        </Button>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title={t('host.summary.total')} value={summary.data?.total ?? 0} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title={t('host.summary.active')} value={summary.data?.active ?? 0} valueStyle={{ color: '#16a34a' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title={t('host.summary.expiringSoon')} value={summary.data?.expiringSoon ?? 0} valueStyle={{ color: '#d97706' }} /></Card></Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title={t('host.summary.suspendedOrExpired')} value={(summary.data?.suspended ?? 0) + (summary.data?.expired ?? 0)} valueStyle={{ color: '#dc2626' }} />
          </Card>
        </Col>
      </Row>

      <Card size="small">
        <Input.Search allowClear placeholder={t('host.search')} value={text} style={{ maxWidth: 360, marginBottom: 12 }}
          onChange={(e) => { setText(e.target.value); setPage(1); }} />
        <Table<Tenant>
          size="small"
          rowKey="id"
          loading={list.isFetching}
          dataSource={list.data?.items}
          scroll={{ x: 1000 }}
          onRow={(x) => ({ onClick: () => navigate(`/host/tenants/${x.id}`), style: { cursor: 'pointer' } })}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.totalCount, onChange: setPage, showSizeChanger: false }}
          columns={[
            { title: t('host.code'), dataIndex: 'code', width: 110 },
            { title: t('host.name'), dataIndex: 'name', ellipsis: true },
            { title: t('host.contactName'), dataIndex: 'contactName', width: 170, ellipsis: true },
            { title: t('host.plan'), dataIndex: 'planName', width: 130 },
            { title: t('host.statusColumn'), width: 120, render: (_, x) => <TenantStatusTag status={x.status} /> },
            {
              title: t('host.endDate'),
              width: 170,
              render: (_, x) =>
                x.endDate ? (
                  <span>
                    {f.date(x.endDate)}{' '}
                    <Typography.Text type={x.daysLeft! < 0 ? 'danger' : x.daysLeft! <= 14 ? 'warning' : 'secondary'} style={{ fontSize: 12 }}>
                      ({x.daysLeft! < 0 ? t('host.expiredDaysAgo', { count: -x.daysLeft! }) : t('host.daysLeft', { count: x.daysLeft! })})
                    </Typography.Text>
                  </span>
                ) : (
                  <Typography.Text type="secondary">{t('host.openEnded')}</Typography.Text>
                ),
            },
            { title: t('host.users'), width: 100, align: 'end', render: (_, x) => usage(x.userCount, x.maxUsers) },
            { title: t('host.locations'), width: 100, align: 'end', render: (_, x) => usage(x.locationCount, x.maxLocations) },
          ]}
        />
      </Card>

      <Modal
        open={createOpen}
        title={t('host.newTenant')}
        width={760}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={create.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(v) => create.mutate(v)} requiredMark="optional">
          <TenantFields />
          <Divider orientation="left" plain>{t('host.firstLocation')}</Divider>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>{t('host.firstLocationHint')}</Typography.Paragraph>
          <LocationFields prefix={['location']} />
          <Divider orientation="left" plain>{t('host.adminUser')}</Divider>
          <AdminFields />
        </Form>
      </Modal>
    </>
  );
}
