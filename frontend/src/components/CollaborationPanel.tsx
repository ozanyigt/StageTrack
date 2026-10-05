import { DeleteOutlined, DownloadOutlined, EditOutlined, PaperClipOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Checkbox, DatePicker, Empty, Flex, Form, Input, List, Modal, Popconfirm, Select, Space, Tabs, Tag, Typography, Upload } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collaborationApi, crewApi } from '../api/endpoints';
import type { OwnerType, TaskItem } from '../api/types';
import { useErrorToast } from '../utils/errors';
import { downloadBlob } from '../utils/excel';
import { formatDate, formatDateTime } from '../utils/format';

const formatSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Notes, tasks and files of one equipment item, device or project (tabs, like Rentman's side panels). */
export function CollaborationPanel({ ownerType, ownerId, readOnly = false }: { ownerType: OwnerType; ownerId: string; readOnly?: boolean }) {
  const { t } = useTranslation();
  const notes = useQuery({ queryKey: ['notes', ownerType, ownerId], queryFn: () => collaborationApi.notes(ownerType, ownerId) });
  const tasks = useQuery({ queryKey: ['tasks', ownerType, ownerId], queryFn: () => collaborationApi.tasks(ownerType, ownerId) });
  const files = useQuery({ queryKey: ['files', ownerType, ownerId], queryFn: () => collaborationApi.files(ownerType, ownerId) });
  const openTasks = (tasks.data ?? []).filter((x) => !x.isCompleted).length;

  return (
    <Tabs
      size="small"
      items={[
        { key: 'notes', label: `${t('collab.notes')} (${notes.data?.length ?? 0})`, children: <NotesTab ownerType={ownerType} ownerId={ownerId} readOnly={readOnly} /> },
        { key: 'tasks', label: `${t('collab.tasks')} (${openTasks})`, children: <TasksTab ownerType={ownerType} ownerId={ownerId} readOnly={readOnly} /> },
        { key: 'files', label: `${t('collab.files')} (${files.data?.length ?? 0})`, children: <FilesTab ownerType={ownerType} ownerId={ownerId} readOnly={readOnly} /> },
      ]}
    />
  );
}

function NotesTab({ ownerType, ownerId, readOnly }: { ownerType: OwnerType; ownerId: string; readOnly: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const showError = useErrorToast();
  const key = ['notes', ownerType, ownerId];
  const { data = [], isLoading } = useQuery({ queryKey: key, queryFn: () => collaborationApi.notes(ownerType, ownerId) });
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const add = useMutation({
    mutationFn: () => collaborationApi.addNote(ownerType, ownerId, text.trim()),
    onSuccess: () => {
      setText('');
      refresh();
    },
    onError: showError,
  });

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {!readOnly && (
        <Flex gap={8} align="start">
          <Input.TextArea value={text} onChange={(e) => setText(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} placeholder={t('collab.notePlaceholder')} maxLength={4000} />
          <Button type="primary" disabled={!text.trim()} loading={add.isPending} onClick={() => add.mutate()}>
            {t('common.add')}
          </Button>
        </Flex>
      )}
      <List
        loading={isLoading}
        dataSource={data}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('collab.noNotes')} /> }}
        renderItem={(n) => (
          <List.Item
            actions={
              n.canEdit && !readOnly
                ? [
                    <Button key="e" type="text" size="small" icon={<EditOutlined />} onClick={() => setEditing({ id: n.id, text: n.text })} aria-label={t('common.edit')} />,
                    <Popconfirm key="d" title={t('collab.deleteNoteConfirm')} onConfirm={() => collaborationApi.removeNote(n.id).then(refresh).catch(showError)}>
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} />
                    </Popconfirm>,
                  ]
                : []
            }
          >
            <List.Item.Meta
              title={
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {n.authorName ?? '—'} · {formatDateTime(n.creationTime)}
                </Typography.Text>
              }
              description={<Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{n.text}</Typography.Paragraph>}
            />
          </List.Item>
        )}
      />
      <Modal
        open={!!editing}
        title={t('collab.editNote')}
        onCancel={() => setEditing(null)}
        onOk={() =>
          editing &&
          collaborationApi
            .updateNote(editing.id, editing.text.trim())
            .then(() => {
              setEditing(null);
              refresh();
            })
            .catch(showError)
        }
        okButtonProps={{ disabled: !editing?.text.trim() }}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
      >
        <Input.TextArea value={editing?.text} onChange={(e) => editing && setEditing({ ...editing, text: e.target.value })} autoSize={{ minRows: 3 }} maxLength={4000} />
      </Modal>
    </Space>
  );
}

function TasksTab({ ownerType, ownerId, readOnly }: { ownerType: OwnerType; ownerId: string; readOnly: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const showError = useErrorToast();
  const key = ['tasks', ownerType, ownerId];
  const { data = [], isLoading } = useQuery({ queryKey: key, queryFn: () => collaborationApi.tasks(ownerType, ownerId) });
  const users = useQuery({ queryKey: ['crew-directory'], queryFn: crewApi.directory, enabled: !readOnly });
  const [editing, setEditing] = useState<TaskItem | 'new' | null>(null);
  const [form] = Form.useForm();
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const openEditor = (task: TaskItem | 'new') => {
    setEditing(task);
    form.setFieldsValue(
      task === 'new'
        ? { title: '', description: '', assignedUserId: null, dueDate: null }
        : { ...task, dueDate: task.dueDate ? dayjs(task.dueDate) : null },
    );
  };

  const save = async () => {
    const values = await form.validateFields();
    const input = { ...values, dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : null };
    try {
      if (editing === 'new') await collaborationApi.addTask(ownerType, ownerId, input);
      else if (editing) await collaborationApi.updateTask(editing.id, input);
      setEditing(null);
      refresh();
    } catch (e) {
      showError(e);
    }
  };

  const sorted = [...data].sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted));

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {!readOnly && (
        <Button icon={<PlusOutlined />} onClick={() => openEditor('new')}>
          {t('collab.addTask')}
        </Button>
      )}
      <List
        loading={isLoading}
        dataSource={sorted}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('collab.noTasks')} /> }}
        renderItem={(task) => {
          const overdue = !task.isCompleted && task.dueDate && dayjs(task.dueDate).isBefore(dayjs(), 'day');
          return (
            <List.Item
              actions={
                readOnly
                  ? []
                  : [
                      <Button key="e" type="text" size="small" icon={<EditOutlined />} onClick={() => openEditor(task)} aria-label={t('common.edit')} />,
                      <Popconfirm key="d" title={t('collab.deleteTaskConfirm')} onConfirm={() => collaborationApi.removeTask(task.id).then(refresh).catch(showError)}>
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} />
                      </Popconfirm>,
                    ]
              }
            >
              <Flex gap={10} align="start" style={{ width: '100%' }}>
                <Checkbox
                  checked={task.isCompleted}
                  disabled={readOnly}
                  onChange={(e) => collaborationApi.setTaskCompleted(task.id, e.target.checked).then(refresh).catch(showError)}
                />
                <div style={{ flex: 1 }}>
                  <Typography.Text delete={task.isCompleted}>{task.title}</Typography.Text>
                  {task.description && (
                    <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>
                      {task.description}
                    </Typography.Paragraph>
                  )}
                  <Space size={4} wrap style={{ marginTop: 2 }}>
                    {task.assignedUserName && <Tag>{task.assignedUserName}</Tag>}
                    {task.dueDate && <Tag color={overdue ? 'red' : undefined}>{formatDate(task.dueDate)}</Tag>}
                  </Space>
                </div>
              </Flex>
            </List.Item>
          );
        }}
      />
      <Modal
        open={!!editing}
        title={editing === 'new' ? t('collab.addTask') : t('collab.editTask')}
        onCancel={() => setEditing(null)}
        onOk={save}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label={t('collab.taskTitle')} rules={[{ required: true, whitespace: true, message: t('validation.required') }]}>
            <Input maxLength={256} />
          </Form.Item>
          <Form.Item name="description" label={t('collab.taskDescription')}>
            <Input.TextArea autoSize={{ minRows: 2 }} maxLength={2000} />
          </Form.Item>
          <Flex gap={12}>
            <Form.Item name="assignedUserId" label={t('collab.assignedTo')} style={{ flex: 1 }}>
              <Select allowClear options={(users.data ?? []).map((u) => ({ value: u.userId, label: u.fullName }))} />
            </Form.Item>
            <Form.Item name="dueDate" label={t('collab.dueDate')} style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
            </Form.Item>
          </Flex>
        </Form>
      </Modal>
    </Space>
  );
}

function FilesTab({ ownerType, ownerId, readOnly }: { ownerType: OwnerType; ownerId: string; readOnly: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const showError = useErrorToast();
  const key = ['files', ownerType, ownerId];
  const { data = [], isLoading } = useQuery({ queryKey: key, queryFn: () => collaborationApi.files(ownerType, ownerId) });
  const [uploading, setUploading] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {!readOnly && (
        <Upload
          showUploadList={false}
          multiple
          beforeUpload={(file) => {
            setUploading(true);
            collaborationApi
              .uploadFile(ownerType, ownerId, file)
              .then(refresh)
              .catch(showError)
              .finally(() => setUploading(false));
            return false;
          }}
        >
          <Button icon={<PaperClipOutlined />} loading={uploading}>
            {t('collab.uploadFile')}
          </Button>
        </Upload>
      )}
      <List
        loading={isLoading}
        dataSource={data}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('collab.noFiles')} /> }}
        renderItem={(f) => (
          <List.Item
            actions={[
              <Button
                key="dl"
                type="text"
                size="small"
                icon={<DownloadOutlined />}
                aria-label={t('collab.download')}
                onClick={() => collaborationApi.download(f.id).then((blob) => downloadBlob(blob, f.fileName)).catch(showError)}
              />,
              ...(readOnly
                ? []
                : [
                    <Popconfirm key="d" title={t('collab.deleteFileConfirm')} onConfirm={() => collaborationApi.removeFile(f.id).then(refresh).catch(showError)}>
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} />
                    </Popconfirm>,
                  ]),
            ]}
          >
            <List.Item.Meta
              avatar={<PaperClipOutlined />}
              title={f.fileName}
              description={
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {formatSize(f.size)} · {f.uploaderName ?? '—'} · {formatDateTime(f.creationTime)}
                </Typography.Text>
              }
            />
          </List.Item>
        )}
      />
    </Space>
  );
}
