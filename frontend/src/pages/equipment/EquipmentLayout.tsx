import { DeleteOutlined, EditOutlined, FolderOutlined, InboxOutlined, PlusOutlined, FolderAddOutlined } from '@ant-design/icons';
import { Button, Card, Drawer, Empty, Flex, Input, Popconfirm, Tree, Typography, theme } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import { equipmentApi, folderApi } from '../../api/endpoints';
import type { EquipmentFolder } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { useUnsavedChanges } from '../../components/UnsavedChanges';
import { useErrorToast } from '../../utils/errors';
import { buildFolderTree, type FolderNode } from './folderTree';

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
 * archive and device detail change on the right.
 */
export function EquipmentLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { can } = useAuth();
  const { token } = theme.useToken();
  const manage = can(Permissions.EquipmentManage);
  const [managerOpen, setManagerOpen] = useState(false);

  const detailMatch = useMatch('/equipment/:id');
  const detailId = detailMatch && !['units', 'archive'].includes(detailMatch.params.id!) ? detailMatch.params.id : undefined;
  const detail = useQuery({ queryKey: ['equipment', detailId], queryFn: () => equipmentApi.get(detailId!), enabled: !!detailId });

  const folders = useQuery({ queryKey: ['folders'], queryFn: folderApi.list });
  const list = folders.data ?? [];
  const onList = location.pathname === '/equipment';
  const onArchive = location.pathname.startsWith('/equipment/archive');
  const selectedFolder = detailId ? detail.data?.folderId ?? null : params.get('folder');

  const [expanded, setExpanded] = useState<string[] | null>(null);
  const autoExpanded = ancestorsOf(list, selectedFolder);
  const expandedKeys = expanded ? Array.from(new Set([...expanded, ...autoExpanded])) : autoExpanded;

  const decorate = (nodes: FolderNode[]): TreeNode[] =>
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

  const totalEquipment = list.reduce((s, f) => s + f.equipmentCount, 0);

  return (
    <div className="master-detail">
      <Card
        size="small"
        className="master"
        title={t('equipment.folders')}
        extra={
          manage && (
            <Button size="small" type="text" icon={<FolderAddOutlined />} aria-label={t('folderManager.title')} title={t('folderManager.title')}
              onClick={() => setManagerOpen(true)} />
          )
        }
      >
        <Flex vertical gap={2} style={{ marginBottom: 6 }}>
          <Button
            type="text"
            size="small"
            icon={<FolderOutlined />}
            onClick={() => navigate('/equipment')}
            style={{ justifyContent: 'flex-start', background: onList && !params.get('folder') ? token.controlItemBgActive : undefined }}
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
            icon={<InboxOutlined />}
            onClick={() => navigate('/equipment/archive')}
            style={{ justifyContent: 'flex-start', background: onArchive ? token.controlItemBgActive : undefined }}
          >
            {t('archivePage.title')}
          </Button>
        </Flex>
        <Tree
          blockNode
          showLine={{ showLeafIcon: false }}
          treeData={decorate(buildFolderTree(list))}
          selectedKeys={selectedFolder && !onArchive ? [selectedFolder] : []}
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

      <FolderManagerDrawer open={managerOpen} folders={list} onClose={() => setManagerOpen(false)} />
    </div>
  );
}

type Editing = { mode: 'add'; parentId: string | null } | { mode: 'rename'; id: string };

/** Whole folder tree: add a root folder, add a sub-folder under any folder, rename or delete — each change saves at once. */
function FolderManagerDrawer({ open, folders, onClose }: { open: boolean; folders: EquipmentFolder[]; onClose: () => void }) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const queryClient = useQueryClient();
  const showError = useErrorToast();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [name, setName] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['folders'] });

  // Like Rentman's folder manager, the whole tree is open when the panel opens.
  useEffect(() => {
    if (open) setExpanded(folders.map((f) => f.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = useMutation({
    mutationFn: async () => {
      const value = name.trim();
      if (!value || !editing) return;
      if (editing.mode === 'add') await folderApi.create({ name: value, parentId: editing.parentId });
      else await folderApi.update(editing.id, { name: value, parentId: folders.find((f) => f.id === editing.id)?.parentId ?? null });
    },
    onSuccess: () => {
      if (editing?.mode === 'add' && editing.parentId) setExpanded((e) => Array.from(new Set([...e, editing.parentId!])));
      setEditing(null);
      setName('');
      refresh();
    },
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => folderApi.remove(id),
    onSuccess: () => {
      refresh();
      navigate('/equipment');
    },
    onError: showError,
  });

  // A typed but unsaved folder name: Escape asks before throwing it away (leaving the field saves it).
  const [originalName, setOriginalName] = useState('');
  const ignoreBlur = useRef(false);
  const nameDirty = !!editing && name.trim() !== '' && name.trim() !== originalName;
  const { confirmLeave } = useUnsavedChanges(nameDirty, () => save.mutateAsync());
  const cancelEditing = async () => {
    ignoreBlur.current = true;
    try {
      if (await confirmLeave()) setEditing(null);
    } finally {
      ignoreBlur.current = false;
    }
  };

  const startAdd = (parentId: string | null) => {
    setEditing({ mode: 'add', parentId });
    setName('');
    setOriginalName('');
    if (parentId) setExpanded((e) => Array.from(new Set([...e, parentId])));
  };

  const editor = (
    <Input
      size="small"
      autoFocus
      value={name}
      maxLength={128}
      placeholder={t('equipment.folderName')}
      onChange={(e) => setName(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') save.mutate();
        if (e.key === 'Escape') cancelEditing();
      }}
      onBlur={() => {
        if (ignoreBlur.current) return;
        if (name.trim()) save.mutate();
        else setEditing(null);
      }}
      disabled={save.isPending}
      style={{ maxWidth: 280 }}
    />
  );

  const addRow = (parentId: string | null): TreeNode => ({ key: `__new_${parentId ?? 'root'}`, title: editor, children: [] });

  const build = (nodes: FolderNode[], parentId: string | null): TreeNode[] => {
    const rows: TreeNode[] = nodes.map((n) => ({
      key: n.key,
      title:
        editing?.mode === 'rename' && editing.id === n.key ? (
          editor
        ) : (
          <Flex justify="space-between" align="center" gap={8} className="folder-row">
            <Typography.Text ellipsis>{n.title}</Typography.Text>
            <Flex gap={2} className="folder-row-actions" onClick={(e) => e.stopPropagation()}>
              <Button size="small" type="text" icon={<PlusOutlined />} aria-label={t('folderManager.addSub')} title={t('folderManager.addSub')}
                onClick={() => startAdd(n.key)} />
              <Button size="small" type="text" icon={<EditOutlined />} aria-label={t('equipment.renameFolder')} title={t('equipment.renameFolder')}
                onClick={() => { setEditing({ mode: 'rename', id: n.key }); setName(n.title); setOriginalName(n.title); }} />
              <Popconfirm title={t('folderManager.deleteConfirm', { name: n.title })} onConfirm={() => remove.mutate(n.key)}
                okText={t('common.delete')} cancelText={t('common.cancel')} okButtonProps={{ danger: true }}>
                <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} title={t('common.delete')} />
              </Popconfirm>
            </Flex>
          </Flex>
        ),
      children: build(n.children, n.key),
    }));
    if (editing?.mode === 'add' && editing.parentId === parentId) rows.push(addRow(parentId));
    return rows;
  };

  const tree = build(buildFolderTree(folders), null);

  return (
    <Drawer
      open={open}
      onClose={() => { setEditing(null); onClose(); }}
      width={520}
      title={t('folderManager.title')}
      destroyOnHidden
      extra={
        <Button type="link" icon={<PlusOutlined />} onClick={() => startAdd(null)}>
          {t('folderManager.addRoot')}
        </Button>
      }
    >
      <style>{`
        .folder-row .folder-row-actions { opacity: 0; transition: opacity .15s; }
        .folder-row:hover .folder-row-actions, .folder-row:focus-within .folder-row-actions { opacity: 1; }
        @media (hover: none) { .folder-row .folder-row-actions { opacity: 1; } }
      `}</style>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        {t('folderManager.hint')}
      </Typography.Paragraph>
      {tree.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('folderManager.empty')} />
      ) : (
        <Tree
          blockNode
          selectable={false}
          showLine={{ showLeafIcon: false }}
          treeData={tree}
          expandedKeys={expanded}
          onExpand={(keys) => setExpanded(keys as string[])}
          style={{ background: token.colorBgContainer }}
        />
      )}
    </Drawer>
  );
}
