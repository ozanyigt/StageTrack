import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Input, Segmented, Table, Tag, Typography } from 'antd';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { equipmentApi, folderApi } from '../../api/endpoints';
import type { Equipment, EquipmentImportRow } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { ExportButton, ImportButton } from '../../components/ExcelButtons';
import { fetchAllPages, type ImportField } from '../../utils/excel';
import { useFormat } from '../../utils/format';
import { useDebounced } from '../../utils/useDebounced';
import { EquipmentFormDrawer } from './EquipmentFormDrawer';

const PAGE_SIZE = 25;

export function EquipmentListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { can, company } = useAuth();
  const f = useFormat();
  const queryClient = useQueryClient();

  const folderId = params.get('folder');
  const [text, setText] = useState('');
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [pageFolder, setPageFolder] = useState(folderId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const search = useDebounced(text, 300);
  if (pageFolder !== folderId) {
    setPageFolder(folderId);
    setPage(1);
  }

  const folders = useQuery({ queryKey: ['folders'], queryFn: folderApi.list });
  const folderName = folders.data?.find((x) => x.id === folderId)?.name;
  const filter = { folderId: folderId ?? undefined, includeSubfolders: true, text: search, isArchived: archived };
  const list = useQuery({
    queryKey: ['equipment', 'list', filter, page],
    queryFn: () => equipmentApi.list({ ...filter, skipCount: (page - 1) * PAGE_SIZE, maxResultCount: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const manage = can(Permissions.EquipmentManage);
  const currency = company?.defaultCurrency ?? 'TRY';
  const showPrice = can(Permissions.Prices);

  const importFields: ImportField[] = [
    { key: 'code', header: t('equipment.code'), required: true },
    { key: 'name', header: t('equipment.name'), required: true },
    { key: 'brand', header: t('equipment.brand') },
    { key: 'model', header: t('equipment.model') },
    { key: 'folder', header: t('equipment.importFolder') },
    { key: 'isSerialized', header: t('equipment.isSerialized'), type: 'boolean' },
    { key: 'stockQuantity', header: t('equipment.stockQuantity'), type: 'number' },
    ...(can(Permissions.Prices) ? [{ key: 'rentalPrice', header: t('equipment.dailyPrice'), type: 'number' as const }] : []),
    { key: 'weightKg', header: t('equipment.weightKg'), type: 'number' },
    { key: 'lengthCm', header: t('equipment.lengthCm'), type: 'number' },
    { key: 'widthCm', header: t('equipment.widthCm'), type: 'number' },
    { key: 'heightCm', header: t('equipment.heightCm'), type: 'number' },
    { key: 'powerW', header: t('equipment.powerW'), type: 'number' },
    { key: 'notes', header: t('common.notes') },
  ];

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{folderName ?? t('equipment.title')}</Typography.Title>
        <Flex gap={8} wrap>
          <Segmented
            value={archived ? 'archived' : 'active'}
            onChange={(v) => {
              setArchived(v === 'archived');
              setPage(1);
            }}
            options={[
              { value: 'active', label: t('equipment.active') },
              { value: 'archived', label: t('equipment.archived') },
            ]}
          />
          <ExportButton<Equipment>
            fileName={t('equipment.exportFile')}
            load={() => fetchAllPages((skipCount, maxResultCount) => equipmentApi.list({ ...filter, skipCount, maxResultCount }))}
            columns={[
              { header: t('equipment.code'), value: (e) => e.code, width: 14 },
              { header: t('equipment.name'), value: (e) => e.name, width: 40 },
              { header: t('equipment.brand'), value: (e) => e.brand },
              { header: t('equipment.model'), value: (e) => e.model },
              { header: t('equipment.type'), value: (e) => t(`enums.equipmentType.${e.type}`) },
              { header: t('equipment.tracking'), value: (e) => (e.isSerialized ? t('equipment.serialized') : t('equipment.bulk')) },
              { header: t('equipment.stock'), value: (e) => e.stock },
              ...(showPrice ? [{ header: t('equipment.dailyPrice'), value: (e: Equipment) => e.rentalPrice ?? null }] : []),
              { header: t('equipment.weightKg'), value: (e) => e.weightKg },
              { header: t('equipment.volumeM3'), value: (e) => e.volumeM3 },
              { header: t('common.notes'), value: (e) => e.notes },
            ]}
          />
          {manage && (
            <ImportButton
              title={t('equipment.importTitle')}
              templateName={t('equipment.importTemplate')}
              fields={importFields}
              onImport={(rows) => equipmentApi.import(rows as unknown as EquipmentImportRow[])}
              onDone={() => {
                queryClient.invalidateQueries({ queryKey: ['equipment'] });
                queryClient.invalidateQueries({ queryKey: ['folders'] });
              }}
            />
          )}
          {manage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
              {t('equipment.create')}
            </Button>
          )}
        </Flex>
      </div>
      <Card size="small">
        <Input.Search
          allowClear
          placeholder={t('equipment.searchPlaceholder')}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPage(1);
          }}
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
            ...(showPrice
              ? [
                  {
                    title: t('equipment.dailyPrice'),
                    dataIndex: 'rentalPrice',
                    width: 130,
                    align: 'end' as const,
                    render: (v: number | null) => (v == null ? '—' : f.money(v, currency)),
                  },
                ]
              : []),
          ]}
        />
      </Card>

      <EquipmentFormDrawer
        open={drawerOpen}
        defaultFolderId={folderId}
        onClose={() => setDrawerOpen(false)}
        onSaved={(e) => {
          setDrawerOpen(false);
          navigate(`/equipment/${e.id}`);
        }}
      />
    </>
  );
}
