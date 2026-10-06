import { UndoOutlined } from '@ant-design/icons';
import { App, Button, Card, Flex, Input, Table, Tabs, Typography } from 'antd';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { equipmentApi, unitApi } from '../../api/endpoints';
import type { Equipment, EquipmentUnit } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { ExportButton } from '../../components/ExcelButtons';
import { useErrorToast } from '../../utils/errors';
import { fetchAllPages } from '../../utils/excel';
import { useDebounced } from '../../utils/useDebounced';

const PAGE_SIZE = 25;

/** Archived equipment and archived devices; both can be restored. */
export function EquipmentArchivePage() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const search = useDebounced(text, 300);

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('archivePage.title')}</Typography.Title>
        <Input.Search allowClear placeholder={t('equipment.searchPlaceholder')} value={text} onChange={(e) => setText(e.target.value)}
          style={{ maxWidth: 320 }} />
      </div>
      <Card size="small">
        <Tabs
          items={[
            { key: 'equipment', label: t('archivePage.equipment'), children: <ArchivedEquipment search={search} /> },
            { key: 'units', label: t('archivePage.units'), children: <ArchivedUnits search={search} /> },
          ]}
        />
      </Card>
    </>
  );
}

function ArchivedEquipment({ search }: { search: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { can } = useAuth();
  const { message } = App.useApp();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const filter = { isArchived: true, folderId: params.get('folder') ?? undefined, includeSubfolders: true, text: search };

  const list = useQuery({
    queryKey: ['equipment', 'archived', filter, page],
    queryFn: () => equipmentApi.list({ ...filter, skipCount: (page - 1) * PAGE_SIZE, maxResultCount: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const restore = useMutation({
    mutationFn: (id: string) => equipmentApi.restore(id),
    onSuccess: () => {
      message.success(t('archivePage.restored'));
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
    onError: showError,
  });

  return (
    <>
      <Flex justify="flex-end" style={{ marginBottom: 8 }}>
        <ExportButton<Equipment>
          size="small"
          fileName={t('archivePage.equipmentFile')}
          load={() => fetchAllPages((skipCount, maxResultCount) => equipmentApi.list({ ...filter, skipCount, maxResultCount }))}
          columns={[
            { header: t('equipment.code'), value: (e) => e.code, width: 14 },
            { header: t('equipment.name'), value: (e) => e.name, width: 40 },
            { header: t('equipment.brand'), value: (e) => e.brand },
            { header: t('equipment.model'), value: (e) => e.model },
            { header: t('equipment.folder'), value: (e) => e.folderName },
          ]}
        />
      </Flex>
      <Table<Equipment>
        size="small"
        rowKey="id"
        loading={list.isFetching}
        dataSource={list.data?.items}
        scroll={{ x: 700 }}
        onRow={(e) => ({
          onClick: (ev) => {
            if ((ev.target as HTMLElement).closest('button')) return;
            navigate(`/equipment/${e.id}`);
          },
          style: { cursor: 'pointer' },
        })}
        pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.totalCount, onChange: setPage, showSizeChanger: false }}
        columns={[
          { title: t('equipment.code'), dataIndex: 'code', width: 110 },
          { title: t('equipment.name'), dataIndex: 'name', ellipsis: true },
          { title: t('equipment.brand'), dataIndex: 'brand', width: 130 },
          { title: t('equipment.model'), dataIndex: 'model', width: 140 },
          { title: t('equipment.folder'), dataIndex: 'folderName', width: 140 },
          ...(can(Permissions.EquipmentManage)
            ? [
                {
                  title: '',
                  width: 150,
                  render: (_: unknown, e: Equipment) => (
                    <Button size="small" icon={<UndoOutlined />} loading={restore.isPending && restore.variables === e.id}
                      onClick={() => restore.mutate(e.id)}>
                      {t('equipment.restore')}
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />
    </>
  );
}

function ArchivedUnits({ search }: { search: string }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { message } = App.useApp();
  const showError = useErrorToast();
  const queryClient = useQueryClient();

  // The device list has no "archived only" filter: archived devices are picked from the list that includes them.
  const units = useQuery({
    queryKey: ['units', 'archived', search],
    queryFn: () => fetchAllPages((skipCount, maxResultCount) => unitApi.list({ text: search, includeArchived: true, skipCount, maxResultCount })),
    select: (items) => items.filter((u) => u.isArchived),
  });

  const restore = useMutation({
    mutationFn: (id: string) => unitApi.restore(id),
    onSuccess: () => {
      message.success(t('archivePage.restored'));
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
    onError: showError,
  });

  return (
    <>
      <Flex justify="flex-end" style={{ marginBottom: 8 }}>
        <ExportButton<EquipmentUnit>
          size="small"
          fileName={t('archivePage.unitsFile')}
          load={async () => units.data ?? []}
          columns={[
            { header: t('equipment.code'), value: (u) => u.equipmentCode, width: 14 },
            { header: t('equipment.name'), value: (u) => u.equipmentName, width: 40 },
            { header: t('units.internalRef'), value: (u) => u.internalRef, width: 16 },
            { header: t('units.serialNumber'), value: (u) => u.serialNumber, width: 20 },
          ]}
        />
      </Flex>
      <Table<EquipmentUnit>
        size="small"
        rowKey="id"
        loading={units.isFetching}
        dataSource={units.data}
        scroll={{ x: 700 }}
        pagination={{ pageSize: PAGE_SIZE, showSizeChanger: false }}
        columns={[
          { title: t('equipment.code'), dataIndex: 'equipmentCode', width: 110 },
          {
            title: t('equipment.name'),
            ellipsis: true,
            render: (_, u) => <Link to={`/equipment/${u.equipmentId}`}>{u.equipmentName}</Link>,
          },
          {
            title: t('units.internalRef'),
            width: 140,
            render: (_, u) => <Link to={`/equipment/units/${u.id}`}>{u.internalRef}</Link>,
          },
          { title: t('units.serialNumber'), dataIndex: 'serialNumber', width: 160, render: (v) => v ?? '—' },
          ...(can(Permissions.EquipmentManage)
            ? [
                {
                  title: '',
                  width: 150,
                  render: (_: unknown, u: EquipmentUnit) => (
                    <Button size="small" icon={<UndoOutlined />} loading={restore.isPending && restore.variables === u.id}
                      onClick={() => restore.mutate(u.id)}>
                      {t('equipment.restore')}
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
