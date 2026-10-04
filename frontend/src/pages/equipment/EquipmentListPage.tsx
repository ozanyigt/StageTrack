import { DeleteOutlined, FolderAddOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Flex, Form, Input, Modal, Row, Segmented, Table, Tag, Tree, TreeSelect, Typography } from 'antd';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { equipmentApi, folderApi } from '../../api/endpoints';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { useErrorToast } from '../../utils/errors';
import { useFormat } from '../../utils/format';
import { useDebounced } from '../../utils/useDebounced';
import { EquipmentFormDrawer } from './EquipmentFormDrawer';
import { buildFolderTree } from './folderTree';

const PAGE_SIZE = 25;

export function EquipmentListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can, company } = useAuth();
  const { modal } = App.useApp();
  const f = useFormat();
  const showError = useErrorToast();
  const queryClient = useQueryClient();

  const [folderId, setFolderId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [folderModal, setFolderModal] = useState(false);
  const [folderForm] = Form.useForm<{ name: string; parentId?: string }>();
  const search = useDebounced(text, 300);

  const folders = useQuery({ queryKey: ['folders'], queryFn: folderApi.list });
  const list = useQuery({
    queryKey: ['equipment', folderId, search, archived, page],
    queryFn: () =>
      equipmentApi.list({ folderId: folderId ?? undefined, text: search, isArchived: archived, skipCount: (page - 1) * PAGE_SIZE, maxResultCount: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const createFolder = useMutation({
    mutationFn: (v: { name: string; parentId?: string }) => folderApi.create(v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setFolderModal(false);
    },
    onError: showError,
  });

  const deleteFolder = useMutation({
    mutationFn: (id: string) => folderApi.remove(id),
    onSuccess: () => {
      setFolderId(null);
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
    onError: showError,
  });

  const tree = buildFolderTree(folders.data ?? []);
  const manage = can(Permissions.EquipmentManage);

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('equipment.title')}</Typography.Title>
        <Flex gap={8} wrap>
          <Segmented
            value={archived ? 'archived' : 'active'}
            onChange={(v) => { setArchived(v === 'archived'); setPage(1); }}
            options={[{ value: 'active', label: t('equipment.active') }, { value: 'archived', label: t('equipment.archived') }]}
          />
          {manage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
              {t('equipment.create')}
            </Button>
          )}
        </Flex>
      </div>
      <Row gutter={12}>
        <Col xs={24} md={7} lg={6}>
          <Card
            size="small"
            title={t('equipment.folders')}
            style={{ marginBottom: 12 }}
            extra={
              manage && (
                <Flex gap={4}>
                  <Button size="small" type="text" icon={<FolderAddOutlined />} aria-label={t('equipment.addFolder')}
                    onClick={() => { folderForm.resetFields(); folderForm.setFieldsValue({ parentId: folderId ?? undefined }); setFolderModal(true); }} />
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled={!folderId} aria-label={t('common.delete')}
                    onClick={() => modal.confirm({ title: t('equipment.deleteFolderConfirm'), onOk: () => deleteFolder.mutateAsync(folderId!) })} />
                </Flex>
              )
            }
          >
            <Button type={folderId ? 'text' : 'link'} size="small" onClick={() => { setFolderId(null); setPage(1); }} style={{ paddingInline: 4 }}>
              {t('equipment.allFolders')}
            </Button>
            <Tree
              treeData={tree}
              selectedKeys={folderId ? [folderId] : []}
              onSelect={(keys) => { setFolderId((keys[0] as string) ?? null); setPage(1); }}
              defaultExpandAll={false}
              blockNode
            />
          </Card>
        </Col>
        <Col xs={24} md={17} lg={18}>
          <Card size="small">
            <Input.Search
              allowClear
              placeholder={t('equipment.searchPlaceholder')}
              value={text}
              onChange={(e) => { setText(e.target.value); setPage(1); }}
              style={{ marginBottom: 12, maxWidth: 360 }}
            />
            <Table
              size="small"
              rowKey="id"
              loading={list.isFetching}
              dataSource={list.data?.items}
              scroll={{ x: 760 }}
              onRow={(e) => ({ onClick: () => navigate(`/equipment/${e.id}`), style: { cursor: 'pointer' } })}
              pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.totalCount, onChange: setPage, showSizeChanger: false }}
              columns={[
                { title: t('equipment.code'), dataIndex: 'code', width: 110 },
                { title: t('equipment.name'), dataIndex: 'name', ellipsis: true },
                { title: t('equipment.brand'), dataIndex: 'brand', width: 120, responsive: ['lg'] },
                { title: t('equipment.model'), dataIndex: 'model', width: 140, responsive: ['xl'] },
                {
                  title: t('equipment.tracking'),
                  dataIndex: 'isSerialized',
                  width: 120,
                  render: (v: boolean) => <Tag color={v ? 'blue' : 'default'}>{v ? t('equipment.serialized') : t('equipment.bulk')}</Tag>,
                },
                { title: t('equipment.stock'), dataIndex: 'stock', width: 80, align: 'end' },
                {
                  title: t('equipment.dailyPrice'),
                  dataIndex: 'rentalPrice',
                  width: 130,
                  align: 'end',
                  render: (v: number) => f.money(v, company?.defaultCurrency ?? 'TRY'),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <EquipmentFormDrawer
        open={drawerOpen}
        defaultFolderId={folderId}
        onClose={() => setDrawerOpen(false)}
        onSaved={(e) => { setDrawerOpen(false); navigate(`/equipment/${e.id}`); }}
      />

      <Modal
        open={folderModal}
        title={t('equipment.addFolder')}
        onCancel={() => setFolderModal(false)}
        onOk={() => folderForm.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={createFolder.isPending}
      >
        <Form form={folderForm} layout="vertical" onFinish={(v) => createFolder.mutate(v)}>
          <Form.Item name="name" label={t('equipment.folderName')} rules={[{ required: true, message: t('validation.required') }]}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item name="parentId" label={t('equipment.parentFolder')}>
            <TreeSelect allowClear treeDefaultExpandAll treeData={tree} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
