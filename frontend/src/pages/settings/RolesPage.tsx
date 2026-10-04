import { DeleteOutlined, LockOutlined, PlusOutlined, SafetyOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Col, Empty, Flex, Form, Input, List, Modal, Row, Space, Tag, Tree, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { roleApi } from '../../api/endpoints';
import type { PermissionGroup, Role } from '../../api/types';
import { permissionLabelKey, roleLabel, useAuth } from '../../auth/AuthContext';
import { useErrorToast } from '../../utils/errors';

interface PermissionNode {
  key: string;
  title: string;
  checkable?: boolean;
  children: PermissionNode[];
}

/** Group → permission tree, children nested under their parent permission (same tree as the backend definitions). */
function buildTree(groups: PermissionGroup[], t: (k: string) => string): PermissionNode[] {
  return groups.map((group) => {
    const nodeOf = (name: string): PermissionNode => ({
      key: name,
      title: t(permissionLabelKey(name)),
      children: group.permissions.filter((p) => p.parent === name).map((p) => nodeOf(p.name)),
    });
    return {
      key: `group:${group.name}`,
      title: t(`permissionGroups.${group.name}`),
      checkable: false,
      children: group.permissions.filter((p) => !p.parent).map((p) => nodeOf(p.name)),
    };
  });
}

/**
 * ABP-style role management: the permissions of a role are a tree; menus and buttons follow automatically
 * because every menu item and button is bound to a permission.
 */
export function RolesPage() {
  const { t } = useTranslation();
  const { modal, message } = App.useApp();
  const { user, refresh } = useAuth();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [nameModal, setNameModal] = useState<{ role?: Role } | null>(null);
  const [nameForm] = Form.useForm<{ name: string }>();

  const definitions = useQuery({ queryKey: ['permission-definitions'], queryFn: roleApi.definitions });
  const roles = useQuery({ queryKey: ['roles'], queryFn: roleApi.list });
  const selected = roles.data?.find((r) => r.id === selectedId) ?? null;

  const parentOf = useMemo(() => {
    const map = new Map<string, string | null>();
    definitions.data?.forEach((g) => g.permissions.forEach((p) => map.set(p.name, p.parent ?? null)));
    return map;
  }, [definitions.data]);

  const tree = useMemo(() => buildTree(definitions.data ?? [], t), [definitions.data, t]);
  const allPermissions = useMemo(() => [...parentOf.keys()], [parentOf]);

  useEffect(() => {
    if (!selectedId && roles.data?.length) setSelectedId(roles.data[0].id);
  }, [roles.data, selectedId]);

  useEffect(() => {
    setChecked(selected?.permissions ?? []);
  }, [selected]);

  const afterChange = (role?: Role) => {
    queryClient.invalidateQueries({ queryKey: ['roles'] });
    if (role) setSelectedId(role.id);
    // The signed-in user may hold the edited role: reload permissions so menus update right away.
    if (user) refresh().catch(() => undefined);
  };

  const savePermissions = useMutation({
    mutationFn: () => roleApi.setPermissions(selectedId!, checked),
    onSuccess: (role) => { message.success(t('common.saved')); afterChange(role); },
    onError: showError,
  });

  const saveName = useMutation({
    mutationFn: (name: string) => (nameModal?.role ? roleApi.rename(nameModal.role.id, name) : roleApi.create(name)),
    onSuccess: (role) => { setNameModal(null); afterChange(role); },
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => roleApi.remove(id),
    onSuccess: () => { setSelectedId(null); afterChange(); },
    onError: showError,
  });

  /** Checking a permission also checks its parents; unchecking removes its children. */
  const toggle = (name: string, on: boolean) => {
    const next = new Set(checked);
    if (on) {
      for (let p: string | null | undefined = name; p; p = parentOf.get(p)) next.add(p);
    } else {
      const removeWithChildren = (n: string) => {
        next.delete(n);
        allPermissions.filter((c) => parentOf.get(c) === n).forEach(removeWithChildren);
      };
      removeWithChildren(name);
    }
    setChecked([...next]);
  };

  const dirty = !!selected && !selected.isStatic &&
    (selected.permissions.length !== checked.length || selected.permissions.some((p) => !checked.includes(p)));

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('roles.title')}</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { nameForm.resetFields(); setNameModal({}); }}>
          {t('roles.create')}
        </Button>
      </div>
      <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('roles.explain')} />
      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <Card size="small" title={t('roles.list')}>
            <List
              loading={roles.isLoading}
              dataSource={roles.data}
              renderItem={(r) => (
                <List.Item
                  onClick={() => setSelectedId(r.id)}
                  style={{ cursor: 'pointer', fontWeight: r.id === selectedId ? 600 : undefined }}
                  extra={<Space size={4}>
                    {r.isStatic && <Tag icon={<LockOutlined />} color="orange">{t('roles.static')}</Tag>}
                    <Tag>{t('roles.userCount', { count: r.userCount })}</Tag>
                  </Space>}
                >
                  {roleLabel(t, r.name)}
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <Card
            size="small"
            title={selected ? <span><SafetyOutlined /> {t('roles.permissionsOf', { role: roleLabel(t, selected.name) })}</span> : t('roles.permissions')}
            extra={selected && !selected.isStatic && (
              <Space>
                <Button size="small" onClick={() => { nameForm.setFieldsValue({ name: selected.name }); setNameModal({ role: selected }); }}>
                  {t('roles.rename')}
                </Button>
                <Button size="small" danger icon={<DeleteOutlined />} aria-label={t('common.delete')}
                  onClick={() => modal.confirm({ title: t('roles.deleteConfirm'), onOk: () => remove.mutateAsync(selected.id) })} />
              </Space>
            )}
          >
            {!selected ? <Empty /> : (
              <>
                {selected.isStatic && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={t('roles.staticHint')} />}
                {!selected.isStatic && (
                  <Flex gap={8} style={{ marginBottom: 8 }}>
                    <Button size="small" onClick={() => setChecked(allPermissions)}>{t('roles.selectAll')}</Button>
                    <Button size="small" onClick={() => setChecked([])}>{t('roles.clearAll')}</Button>
                  </Flex>
                )}
                <Tree
                  checkable
                  checkStrictly
                  defaultExpandAll
                  selectable={false}
                  disabled={selected.isStatic}
                  treeData={tree}
                  checkedKeys={{ checked, halfChecked: [] }}
                  onCheck={(_, info) => toggle(String(info.node.key), info.checked)}
                />
                {!selected.isStatic && (
                  <Button type="primary" style={{ marginTop: 16 }} disabled={!dirty} loading={savePermissions.isPending} onClick={() => savePermissions.mutate()}>
                    {t('roles.savePermissions')}
                  </Button>
                )}
              </>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        open={!!nameModal}
        title={nameModal?.role ? t('roles.rename') : t('roles.create')}
        onCancel={() => setNameModal(null)}
        onOk={() => nameForm.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saveName.isPending}
        destroyOnHidden
      >
        <Form form={nameForm} layout="vertical" onFinish={(v) => saveName.mutate(v.name)}>
          <Form.Item name="name" label={t('roles.name')} rules={[{ required: true, min: 2, max: 64, message: t('validation.required') }]}>
            <Input autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
