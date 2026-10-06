import { ArrowLeftOutlined, CheckCircleOutlined, EditOutlined, KeyOutlined, LoginOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import { App, Button, Card, Descriptions, Form, Input, Modal, Progress, Skeleton, Space, Table, Tabs, Tag, Tooltip, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { hostApi } from '../../api/endpoints';
import type { TenantDetail, TenantLocation, TenantLocationInput, TenantUser } from '../../api/types';
import { roleLabel, useAuth } from '../../auth/AuthContext';
import { useErrorToast } from '../../utils/errors';
import { useFormat } from '../../utils/format';
import { formToTenant, LocationFields, normalizeLocation, TenantFields, TenantStatusTag, tenantToForm, type TenantFormValues } from './TenantForms';
import { useGuardedForm } from '../../components/useGuardedModal';

/** One customer firm: subscription, locations and users; the platform admin can sign in as any of its users. */
export function HostTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const showError = useErrorToast();
  const f = useFormat();
  const { impersonateFromHost } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [location, setLocation] = useState<TenantLocation | 'new' | null>(null);
  const [passwordUser, setPasswordUser] = useState<TenantUser | null>(null);
  const [tenantForm] = Form.useForm<TenantFormValues>();
  const tenantGuard = useGuardedForm(editOpen, async () => update.mutateAsync(await tenantForm.validateFields()));
  const [locationForm] = Form.useForm<TenantLocationInput>();
  const locationGuard = useGuardedForm(!!location, async () => saveLocation.mutateAsync(await locationForm.validateFields()));
  const [passwordForm] = Form.useForm<{ newPassword: string }>();
  const passwordGuard = useGuardedForm(!!passwordUser, async () => resetPassword.mutateAsync(await passwordForm.validateFields()));

  const tenant = useQuery({ queryKey: ['host-tenant', id], queryFn: () => hostApi.get(id!) });

  const apply = (d: TenantDetail) => {
    queryClient.setQueryData(['host-tenant', id], d);
    queryClient.invalidateQueries({ queryKey: ['host-tenants'] });
    queryClient.invalidateQueries({ queryKey: ['host-summary'] });
  };

  const update = useMutation({
    mutationFn: (v: TenantFormValues) => hostApi.update(id!, formToTenant(v)),
    onSuccess: (d) => { apply(d); setEditOpen(false); message.success(t('host.saved')); },
    onError: showError,
  });
  const setActive = useMutation({ mutationFn: (active: boolean) => hostApi.setActive(id!, active), onSuccess: apply, onError: showError });
  const saveLocation = useMutation({
    mutationFn: (v: TenantLocationInput) =>
      location === 'new' ? hostApi.addLocation(id!, normalizeLocation(v)) : hostApi.updateLocation(id!, (location as TenantLocation).id, normalizeLocation(v)),
    onSuccess: (d) => { apply(d); setLocation(null); message.success(t('host.saved')); },
    onError: showError,
  });
  const resetPassword = useMutation({
    mutationFn: (v: { newPassword: string }) => hostApi.resetPassword(id!, passwordUser!.id, v.newPassword),
    onSuccess: () => { setPasswordUser(null); message.success(t('host.passwordReset')); },
    onError: showError,
  });

  const x = tenant.data;
  if (!x) return <Skeleton active />;

  const percent = (used: number, max?: number | null) => (max ? Math.min(100, Math.round((used / max) * 100)) : 0);
  const usageCell = (used: number, max?: number | null) => (
    <Space>
      <span>{t('host.usage', { used, max: max ?? t('host.unlimited') })}</span>
      {max && <Progress percent={percent(used, max)} size="small" style={{ width: 90, margin: 0 }} showInfo={false}
        status={used >= max ? 'exception' : 'normal'} />}
    </Space>
  );

  const openLocation = (l: TenantLocation | 'new') => {
    locationForm.resetFields();
    locationForm.setFieldsValue(
      l === 'new'
        ? { countryCode: 'AE', currency: 'AED', vatRate: 5 }
        : { name: l.name, code: l.code, currency: l.defaultCurrency, vatRate: l.defaultVatRate, countryCode: l.countryCode, rentmanWorkspaceId: l.rentmanWorkspaceId },
    );
    setLocation(l);
  };

  const loginAs = (u: TenantUser) =>
    impersonateFromHost(u.id).then(() => navigate('/')).catch(showError);

  return (
    <>
      <div className="page-header">
        <Space align="center" wrap>
          <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/')} aria-label={t('host.backToList')} />
          <Typography.Title level={3}>{x.name}</Typography.Title>
          <Tag>{x.code}</Tag>
          <TenantStatusTag status={x.status} />
        </Space>
        <Space wrap>
          <Button icon={<EditOutlined />} onClick={() => { tenantForm.setFieldsValue(tenantToForm(x)); setEditOpen(true); }}>
            {t('host.editTenant')}
          </Button>
          {x.isActive ? (
            <Button danger icon={<StopOutlined />} loading={setActive.isPending}
              onClick={() => modal.confirm({ title: t('host.suspend'), content: t('host.suspendConfirm'), okButtonProps: { danger: true },
                okText: t('host.suspend'), cancelText: t('common.cancel'), onOk: () => setActive.mutateAsync(false) })}>
              {t('host.suspend')}
            </Button>
          ) : (
            <Button type="primary" icon={<CheckCircleOutlined />} loading={setActive.isPending} onClick={() => setActive.mutate(true)}>
              {t('host.activate')}
            </Button>
          )}
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
          <Descriptions.Item label={t('host.plan')}>{x.planName}</Descriptions.Item>
          <Descriptions.Item label={t('host.period')}>
            {f.date(x.startDate)} – {x.endDate ? f.date(x.endDate) : t('host.openEnded')}
            {x.daysLeft != null && (
              <Typography.Text type={x.daysLeft < 0 ? 'danger' : x.daysLeft <= 14 ? 'warning' : 'secondary'} style={{ marginInlineStart: 6 }}>
                ({x.daysLeft < 0 ? t('host.expiredDaysAgo', { count: -x.daysLeft }) : t('host.daysLeft', { count: x.daysLeft })})
              </Typography.Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label={t('host.contactName')}>{x.contactName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('host.users')}>{usageCell(x.userCount, x.maxUsers)}</Descriptions.Item>
          <Descriptions.Item label={t('host.locations')}>{usageCell(x.locationCount, x.maxLocations)}</Descriptions.Item>
          <Descriptions.Item label={t('host.email')}>{x.email ? <a href={`mailto:${x.email}`}>{x.email}</a> : '—'}</Descriptions.Item>
          <Descriptions.Item label={t('host.phone')}>{x.phone ? <a href={`tel:${x.phone}`}>{x.phone}</a> : '—'}</Descriptions.Item>
          <Descriptions.Item label={t('host.createdAt')}>{f.date(x.creationTime)}</Descriptions.Item>
          {x.notes && <Descriptions.Item label={t('host.notes')} span={3}>{x.notes}</Descriptions.Item>}
        </Descriptions>
      </Card>

      <Card size="small">
        <Tabs
          items={[
            {
              key: 'users',
              label: `${t('host.users')} (${x.users.length})`,
              children: (
                <>
                  <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>{t('host.loginAsHint')}</Typography.Paragraph>
                  <Table<TenantUser>
                    size="small"
                    rowKey="id"
                    pagination={false}
                    dataSource={x.users}
                    columns={[
                      { title: t('host.fullName'), dataIndex: 'fullName' },
                      { title: t('host.userName'), dataIndex: 'userName', width: 180 },
                      { title: t('host.email'), dataIndex: 'email', width: 220, ellipsis: true },
                      { title: t('host.roles'), width: 200, render: (_, u) => u.roles.map((r) => <Tag key={r}>{roleLabel(t, r)}</Tag>) },
                      {
                        title: '', width: 120,
                        render: (_, u) => <Tag color={u.isActive ? 'green' : 'default'}>{u.isActive ? t('host.active') : t('host.inactive')}</Tag>,
                      },
                      {
                        title: '', width: 110, align: 'end',
                        render: (_, u) => (
                          <Space size={2}>
                            <Tooltip title={t('host.loginAs')}>
                              <Button size="small" type="text" icon={<LoginOutlined />} disabled={!u.isActive || x.status !== 'Active'}
                                onClick={() => loginAs(u)} aria-label={t('host.loginAs')} />
                            </Tooltip>
                            <Tooltip title={t('host.resetPassword')}>
                              <Button size="small" type="text" icon={<KeyOutlined />} aria-label={t('host.resetPassword')}
                                onClick={() => { passwordForm.resetFields(); setPasswordUser(u); }} />
                            </Tooltip>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </>
              ),
            },
            {
              key: 'locations',
              label: `${t('host.locations')} (${x.locations.length})`,
              children: (
                <>
                  <Button icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => openLocation('new')}
                    disabled={x.maxLocations != null && x.locationCount >= x.maxLocations}>
                    {t('host.addLocation')}
                  </Button>
                  <Table<TenantLocation>
                    size="small"
                    rowKey="id"
                    pagination={false}
                    dataSource={x.locations}
                    columns={[
                      { title: t('host.locationCode'), dataIndex: 'code', width: 90 },
                      { title: t('host.locationName'), dataIndex: 'name' },
                      { title: t('host.country'), dataIndex: 'countryCode', width: 90 },
                      { title: t('host.currency'), dataIndex: 'defaultCurrency', width: 100 },
                      { title: t('host.vatRate'), dataIndex: 'defaultVatRate', width: 80 },
                      { title: 'cmpID', dataIndex: 'rentmanWorkspaceId', width: 90, render: (v) => v ?? '—' },
                      {
                        title: '', width: 60,
                        render: (_, l) => <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openLocation(l)} aria-label={t('host.editLocation')} />,
                      },
                    ]}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={editOpen} title={t('host.editTenant')} width={760} onCancel={tenantGuard.guardClose(() => setEditOpen(false))} onOk={() => tenantForm.submit()}
        okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={update.isPending} destroyOnHidden forceRender>
        <Form form={tenantForm} onValuesChange={tenantGuard.onValuesChange} layout="vertical" onFinish={(v) => update.mutate(v)} requiredMark="optional">
          <TenantFields />
        </Form>
      </Modal>

      <Modal open={!!location} title={location === 'new' ? t('host.addLocation') : t('host.editLocation')} width={640}
        onCancel={locationGuard.guardClose(() => setLocation(null))} onOk={() => locationForm.submit()} okText={t('common.save')} cancelText={t('common.cancel')}
        confirmLoading={saveLocation.isPending} forceRender>
        <Form form={locationForm} onValuesChange={locationGuard.onValuesChange} layout="vertical" onFinish={(v) => saveLocation.mutate(v)} requiredMark="optional">
          <LocationFields isNew={location === 'new'} />
        </Form>
      </Modal>

      <Modal open={!!passwordUser} title={`${t('host.resetPassword')} · ${passwordUser?.fullName ?? ''}`} onCancel={passwordGuard.guardClose(() => setPasswordUser(null))}
        onOk={() => passwordForm.submit()} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={resetPassword.isPending} forceRender>
        <Form form={passwordForm} onValuesChange={passwordGuard.onValuesChange} layout="vertical" onFinish={(v) => resetPassword.mutate(v)}>
          <Form.Item name="newPassword" label={t('host.newPassword')}
            rules={[{ required: true, message: t('validation.required') }, { pattern: /^(?=.*[A-Za-zÇĞİÖŞÜçğıöşü])(?=.*\d).{8,}$/, message: t('users.passwordRule') }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
