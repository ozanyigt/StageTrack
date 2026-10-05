import { BarcodeOutlined, DeleteOutlined, EditOutlined, FolderAddOutlined, FolderOutlined } from '@ant-design/icons';
import { App, Button, Card, Flex, Form, Input, Modal, Tree, TreeSelect, Typography, theme } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import { equipmentApi, folderApi } from '../../api/endpoints';
import type { EquipmentFolder } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { useErrorToast } from '../../utils/errors';
import { buildFolderTree } from './folderTree';

interface TreeNode {
  key: string;
  title: ReactNode;
  children: TreeNode[];
}

/** Equipment count of a folder including its sub-folders. */
function totalCount(folders: EquipmentFolder[], id: string): number {
  const own = folders.find((f) => f.id === id)?.equipmentCount ?? 0;
  return own + folders.filter((f) => f.parentId === id).reduce((sum, child) => sum + totalCount(folders, child.id), 0);
}

function ancestorsOf(folders: EquipmentFolder[], id: string | null | undefined): string[] {
  const result: string[] = [];
  let current = folders.find((f) => f.id === id);
  while (current?.parentId) {
    result.push(current.parentId);
    current = folders.find((f) => f.id === current!.parentId);
  }
  return result;
}

/**
 * Equipment module shell: the folder tree stays on the left while the list, equipment detail,
 * device list and device detail change on the right (like Rentman's equipment screen).
 */
export function EquipmentLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { can } = useAuth();
  const { modal } = App.useApp();
  const { token } = theme.useToken();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const manage = can(Permissions.EquipmentManage);

  const detailMatch = useMatch('/equipment/:id');
  const detailId = detailMatch && detailMatch.params.id !== 'units' ? detailMatch.params.id : undefined;
  const detail = useQuery({ queryKey: ['equipment', detailId], queryFn: () => equipmentApi.get(detailId!), enabled: !!detailId });

  const folders = useQuery({ queryKey: ['folders'], queryFn: folderApi.list });
  const list = folders.data ?? [];
  const selectedFolder = detailId ? detail.data?.folderId ?? null : params.get('folder');
  const onList = location.pathname === '/equipment';
  const onUnits = location.pathname.startsWith('/equipment/units');

  const [expanded, setExpanded] = useState<string[] | null>(null);
  const autoExpanded = ancestorsOf(list, selectedFolder);
  const expandedKeys = expanded ? Array.from(new Set([...expanded, ...autoExpanded])) : autoExpanded;

  const [folderModal, setFolderModal] = useState<{ id?: string } | null>(null);
  const [folderForm] = Form.useForm<{ name: string; parentId?: string | null }>();

  const saveFolder = useMutation({
    mutationFn: (v: { name: string; parentId?: string | null }) =>
      folderModal?.id ? folderApi.update(folderModal.id, v) : folderApi.create(v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setFolderModal(null);
    },
    onError: showError,
  });

  const deleteFolder = useMutation({
    mutationFn: (id: string) => folderApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      navigate('/equipment');
    },
    onError: showError,
  });

  const decorate = (nodes: ReturnType<typeof buildFolderTree>): TreeNode[] =>
    nodes.map((n) => ({
      key: n.key,
      title: (
        <Flex justify="space-between" gap={6}>
          <Typography.Text ellipsis>{n.title}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {totalCount(list, n.key)}
          </Typography.Text>
        </Flex>
      ),
      children: decorate(n.children),
    }));

  const openFolderModal = (id?: string) => {
    const folder = list.find((f) => f.id === id);
    folderForm.resetFields();
    folderForm.setFieldsValue(folder ? { name: folder.name, parentId: folder.parentId ?? null } : { parentId: selectedFolder ?? null });
    setFolderModal({ id });
  };

  const selectedOnList = onList ? params.get('folder') : null;
  const totalEquipment = list.reduce((s, f) => s + f.equipmentCount, 0);

  return (
    <div className="master-detail">
      <Card
        size="small"
        className="master"
        title={t('equipment.folders')}
        extra={
          manage && (
            <Flex gap={2}>
              <Button size="small" type="text" icon={<FolderAddOutlined />} aria-label={t('equipment.addFolder')} onClick={() => openFolderModal()} />
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                disabled={!selectedOnList}
                aria-label={t('equipment.renameFolder')}
                onClick={() => openFolderModal(selectedOnList!)}
              />
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={!selectedOnList}
                aria-label={t('common.delete')}
                onClick={() => modal.confirm({ title: t('equipment.deleteFolderConfirm'), onOk: () => deleteFolder.mutateAsync(selectedOnList!) })}
              />
            </Flex>
          )
        }
      >
        <Flex vertical gap={2} style={{ marginBottom: 6 }}>
          <Button
            type="text"
            size="small"
            icon={<FolderOutlined />}
            onClick={() => navigate('/equipment')}
            style={{
              justifyContent: 'flex-start',
              background: onList && !params.get('folder') ? token.controlItemBgActive : undefined,
            }}
          >
            <Flex justify="space-between" style={{ flex: 1 }}>
              <span>{t('equipment.allFolders')}</span>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {totalEquipment}
              </Typography.Text>
            </Flex>
          </Button>
          <Button
            type="text"
            size="small"
            icon={<BarcodeOutlined />}
            onClick={() => navigate('/equipment/units')}
            style={{ justifyContent: 'flex-start', background: onUnits ? token.controlItemBgActive : undefined }}
          >
            {t('nav.units')}
          </Button>
        </Flex>
        <Tree
          blockNode
          showLine={{ showLeafIcon: false }}
          treeData={decorate(buildFolderTree(list))}
          selectedKeys={selectedFolder && !onUnits ? [selectedFolder] : []}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpanded(keys as string[])}
          onSelect={(keys) => {
            const key = keys[0] as string | undefined;
            navigate(key ? `/equipment?folder=${key}` : '/equipment');
          }}
        />
      </Card>

      <div style={{ minWidth: 0 }}>
        <Outlet />
      </div>

      <Modal
        open={!!folderModal}
        title={folderModal?.id ? t('equipment.renameFolder') : t('equipment.addFolder')}
        onCancel={() => setFolderModal(null)}
        onOk={() => folderForm.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saveFolder.isPending}
        destroyOnHidden
      >
        <Form form={folderForm} layout="vertical" onFinish={(v) => saveFolder.mutate(v)}>
          <Form.Item name="name" label={t('equipment.folderName')} rules={[{ required: true, whitespace: true, message: t('validation.required') }]}>
            <Input autoFocus maxLength={128} />
          </Form.Item>
          <Form.Item name="parentId" label={t('equipment.parentFolder')}>
            <TreeSelect
              allowClear
              treeDefaultExpandAll
              treeData={buildFolderTree(list.filter((f) => f.id !== folderModal?.id))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
