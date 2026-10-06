import { EditOutlined, KeyOutlined, LoginOutlined, PlusOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { App, Button, Card, Drawer, Form, Input, Modal, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../../api/endpoints';
import type { User } from '../../api/types';
import { Permissions, roleLabel, useAuth } from '../../auth/AuthContext';
import { LANGUAGES } from '../../i18n';
import { ExportButton } from '../../components/ExcelButtons';
import { useErrorToast } from '../../utils/errors';
import { fetchAllPages } from '../../utils/excel';
import { useFormat } from '../../utils/format';
import { useDebounced } from '../../utils/useDebounced';
import { useGuardedForm } from '../../components/useGuardedModal';

const PAGE_SIZE = 25;

interface UserForm {
  userName: string;
  fullName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  password?: string;
  language: string;
  roleIds: string[];
  companyIds: string[];
}

const passwordRules = (t: (k: string) => string) => [
  { required: true, message: t('validation.required') },
  { pattern: /^(?=.*[A-Za-zÇĞİÖŞÜçğıöşü])(?=.*\d).{8,}$/, message: t('users.passwordRule') },
];

/** Users of the company being worked in; an admin can also sign in as a user to see exactly what they see. */
export function UsersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user: me, company, can, impersonate } = useAuth();
  const { modal, message } = App.useApp();
  const f = useFormat();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<UserForm>();
  const [passwordForm] = Form.useForm<{ newPassword: string }>();
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const guard = useGuardedForm(!!editing, async () => save.mutateAsync(await form.validateFields()));
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const passwordGuard = useGuardedForm(!!passwordUser, async () => resetPassword.mutateAsync(await passwordForm.validateFields()));
  const search = useDebounced(text, 300);

  const list = useQuery({
    queryKey: ['users', search, page],
    queryFn: () => userApi.list({ text: search, skipCount: (page - 1) * PAGE_SIZE, maxResultCount: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const roles = useQuery({ queryKey: ['assignable-roles'], queryFn: userApi.assignableRoles });
  const roleName = (id: string) => roleLabel(t, roles.data?.find((r) => r.id === id)?.name ?? '?');

  const save = useMutation({
    mutationFn: (v: UserForm) =>
      editing && editing !== 'new'
        ? userApi.update(editing.id, {
            fullName: v.fullName,
            email: v.email || null,
            phone: v.phone || null,
            jobTitle: v.jobTitle || null,
            roleIds: v.roleIds,
            companyIds: v.companyIds,
          })
        : userApi.create({ ...v, email: v.email || null, phone: v.phone || null, jobTitle: v.jobTitle || null, password: v.password! }),
    onSuccess: () => {
      message.success(t('common.saved'));
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setEditing(null);
    },
    onError: showError,
  });

  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => userApi.setActive(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: showError,
  });

  const resetPassword = useMutation({
    mutationFn: (v: { newPassword: string }) => userApi.resetPassword(passwordUser!.id, v.newPassword),
    onSuccess: () => { message.success(t('users.passwordReset')); setPasswordUser(null); },
    onError: showError,
  });

  const loginAs = (u: User) =>
    modal.confirm({
      title: t('users.impersonateConfirm', { name: u.fullName }),
      content: t('users.impersonateHint'),
      okText: t('users.impersonate'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await impersonate(u.id);
          navigate('/');
        } catch (e) {
          showError(e);
        }
      },
    });

  const open = (u: User | 'new') => {
    form.resetFields();
    form.setFieldsValue(
      u === 'new'
        ? { language: 'tr', roleIds: [], companyIds: company ? [company.id] : [] }
        : {
            userName: u.userName,
            fullName: u.fullName,
            email: u.email ?? undefined,
            phone: u.phone ?? undefined,
            jobTitle: u.jobTitle ?? undefined,
            language: u.language,
            roleIds: u.roleIds,
            companyIds: u.companyIds,
          },
    );
    setEditing(u);
  };

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('users.title')}</Typography.Title>
        <Space wrap>
          <ExportButton<User>
            fileName={t('users.title')}
            load={() => fetchAllPages((skipCount, maxResultCount) => userApi.list({ text: search, skipCount, maxResultCount }))}
            columns={[
              { header: t('users.fullName'), value: (u) => u.fullName },
              { header: t('users.userName'), value: (u) => u.userName },
              { header: t('users.jobTitle'), value: (u) => u.jobTitle },
              { header: t('users.email'), value: (u) => u.email },
              { header: t('users.phone'), value: (u) => u.phone },
              { header: t('users.roles'), value: (u) => u.roleIds.map(roleName).join(', ') },
              { header: t('users.status'), value: (u) => (u.isActive ? t('users.active') : t('users.inactive')) },
              { header: t('users.created'), value: (u) => f.date(u.creationTime) },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => open('new')}>{t('users.create')}</Button>
        </Space>
      </div>
      <Card size="small">
        <Input.Search allowClear placeholder={t('users.searchPlaceholder')} value={text}
          onChange={(e) => { setText(e.target.value); setPage(1); }} style={{ maxWidth: 360, marginBottom: 12 }} />
        <Table
          size="small"
          rowKey="id"
          loading={list.isFetching}
          dataSource={list.data?.items}
          scroll={{ x: 900 }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.totalCount, onChange: setPage, showSizeChanger: false }}
          columns={[
            {
              title: t('users.fullName'),
              dataIndex: 'fullName',
              ellipsis: true,
              render: (v: string, u) => (
                <>
                  {v}
                  {u.jobTitle && <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{u.jobTitle}</Typography.Text>}
                </>
              ),
            },
            { title: t('users.userName'), dataIndex: 'userName', width: 140 },
            { title: t('users.email'), dataIndex: 'email', width: 200, ellipsis: true, responsive: ['lg'] },
            { title: t('users.phone'), dataIndex: 'phone', width: 150, responsive: ['xl'] },
            { title: t('users.roles'), dataIndex: 'roleIds', render: (ids: string[]) => ids.map((id) => <Tag key={id}>{roleName(id)}</Tag>) },
            {
              title: t('users.status'), dataIndex: 'isActive', width: 100,
              render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? t('users.active') : t('users.inactive')}</Tag>,
            },
            { title: t('users.created'), dataIndex: 'creationTime', width: 110, responsive: ['xl'], render: (v) => f.date(v) },
            {
              title: '', width: 170,
              render: (_, u) => (
                <Space size={4}>
                  <Tooltip title={t('common.edit')}><Button size="small" icon={<EditOutlined />} onClick={() => open(u)} /></Tooltip>
                  <Tooltip title={t('users.resetPassword')}>
                    <Button size="small" icon={<KeyOutlined />} onClick={() => { passwordForm.resetFields(); setPasswordUser(u); }} />
                  </Tooltip>
                  {u.id !== me?.id && (
                    <Tooltip title={u.isActive ? t('users.deactivate') : t('users.activate')}>
                      <Button size="small" icon={u.isActive ? <StopOutlined /> : <CheckCircleOutlined />}
                        onClick={() => setActive.mutate({ id: u.id, isActive: !u.isActive })} />
                    </Tooltip>
                  )}
                  {can(Permissions.Impersonate) && u.id !== me?.id && u.isActive && (
                    <Tooltip title={t('users.impersonate')}>
                      <Button size="small" type="primary" ghost icon={<LoginOutlined />} onClick={() => loginAs(u)} />
                    </Tooltip>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        open={!!editing}
        width={480}
        onClose={guard.guardClose(() => setEditing(null))}
        title={editing === 'new' ? t('users.create') : t('users.edit')}
        destroyOnHidden
        extra={<Button type="primary" loading={save.isPending} onClick={() => form.submit()}>{t('common.save')}</Button>}
      >
        <Form form={form} onValuesChange={guard.onValuesChange} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="userName" label={t('users.userName')}
            rules={[{ required: true, message: t('validation.required') }, { pattern: /^[A-Za-z0-9._@-]{3,64}$/, message: t('users.userNameRule') }]}>
            <Input disabled={editing !== 'new'} autoComplete="off" />
          </Form.Item>
          <Form.Item name="fullName" label={t('users.fullName')} rules={[{ required: true, message: t('validation.required') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="jobTitle" label={t('users.jobTitle')}>
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item name="email" label={t('users.email')} rules={[{ type: 'email', message: t('validation.email') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label={t('users.phone')}>
            <Input maxLength={32} />
          </Form.Item>
          {editing === 'new' && (
            <Form.Item name="password" label={t('users.password')} rules={passwordRules(t)} extra={t('users.passwordRule')}>
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          )}
          <Form.Item name="roleIds" label={t('users.roles')} rules={[{ required: true, type: 'array', min: 1, message: t('validation.required') }]}>
            <Select mode="multiple" loading={roles.isLoading} options={(roles.data ?? []).map((r) => ({ value: r.id, label: roleLabel(t, r.name) }))} />
          </Form.Item>
          <Form.Item name="companyIds" label={t('users.companies')} extra={t('users.companiesHint')}
            rules={[{ required: true, type: 'array', min: 1, message: t('validation.required') }]}>
            <Select mode="multiple" options={(me?.companies ?? []).map((c) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
          <Form.Item name="language" label={t('users.language')}>
            <Select disabled={editing !== 'new'} options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} />
          </Form.Item>
        </Form>
      </Drawer>

      <Modal
        open={!!passwordUser}
        title={t('users.resetPasswordFor', { name: passwordUser?.fullName })}
        onCancel={passwordGuard.guardClose(() => setPasswordUser(null))}
        onOk={() => passwordForm.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={resetPassword.isPending}
        destroyOnHidden
      >
        <Form form={passwordForm} onValuesChange={passwordGuard.onValuesChange} layout="vertical" onFinish={(v) => resetPassword.mutate(v)}>
          <Form.Item name="newPassword" label={t('users.newPassword')} rules={passwordRules(t)} extra={t('users.passwordRule')}>
            <Input.Password autoComplete="new-password" autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
