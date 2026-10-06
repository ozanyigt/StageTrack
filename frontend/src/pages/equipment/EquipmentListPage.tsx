import { DeleteOutlined, DownOutlined, FileExcelOutlined, InboxOutlined, MoreOutlined, PlusOutlined, PrinterOutlined, UploadOutlined } from '@ant-design/icons';
import { App, Button, Card, Checkbox, Dropdown, Flex, Input, Popover, Space, Table, Tag, Typography, theme, type TableColumnsType } from 'antd';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { equipmentApi, folderApi, unitApi } from '../../api/endpoints';
import type { Equipment, EquipmentImportRow } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { ImportButton } from '../../components/ExcelButtons';
import { useLabelGenerator } from '../../components/LabelGenerator';
import { UnitStatusTag } from '../../components/StatusTags';
import { useErrorToast } from '../../utils/errors';
import { exportToExcel, fetchAllPages, type ExcelColumn, type ImportField } from '../../utils/excel';
import { formatDate, useFormat } from '../../utils/format';
import { useDebounced } from '../../utils/useDebounced';
import { EquipmentFormDrawer } from './EquipmentFormDrawer';

const PAGE_SIZE = 25;
const COLUMNS_KEY = 'stagetrack.equipmentColumns';

const ALL_COLUMNS = [
  'code', 'name', 'brand', 'model', 'folder', 'type', 'tracking', 'stock', 'price', 'weight', 'volume', 'dimensions', 'power',
  'country', 'showInQuotes', 'purchaseDate', 'warrantyEndDate', 'supplier', 'notes', 'containedIn',
] as const;
type ColumnKey = (typeof ALL_COLUMNS)[number];
const DEFAULT_COLUMNS: ColumnKey[] = ['code', 'name', 'brand', 'model', 'tracking', 'stock', 'price'];

function readColumns(): ColumnKey[] {
  try {
    const raw = localStorage.getItem(COLUMNS_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : null;
    const valid = parsed?.filter((c): c is ColumnKey => (ALL_COLUMNS as readonly string[]).includes(c));
    return valid && valid.length > 0 ? valid : DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

function writeColumns(columns: ColumnKey[]) {
  try {
    localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns));
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
}

interface ColumnDef {
  title: string;
  width?: number;
  align?: 'end';
  render: (e: Equipment) => ReactNode;
  excel: (e: Equipment) => string | number | Date | null | undefined;
}

export function EquipmentListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { can, company } = useAuth();
  const { modal, message } = App.useApp();
  const showError = useErrorToast();
  const f = useFormat();
  const queryClient = useQueryClient();
  const labels = useLabelGenerator();
  const importRef = useRef<HTMLSpanElement>(null);

  const folderId = params.get('folder');
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const [pageFolder, setPageFolder] = useState(folderId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [visible, setVisible] = useState<ColumnKey[]>(readColumns);
  const [selected, setSelected] = useState<Map<string, Equipment>>(new Map());
  const [exporting, setExporting] = useState(false);
  const search = useDebounced(text, 300);
  if (pageFolder !== folderId) {
    setPageFolder(folderId);
    setPage(1);
  }

  const folders = useQuery({ queryKey: ['folders'], queryFn: folderApi.list });
  const folderName = folders.data?.find((x) => x.id === folderId)?.name;
  const filter = { folderId: folderId ?? undefined, includeSubfolders: true, text: search, isArchived: false };
  const list = useQuery({
    queryKey: ['equipment', 'list', filter, page],
    queryFn: () => equipmentApi.list({ ...filter, skipCount: (page - 1) * PAGE_SIZE, maxResultCount: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const manage = can(Permissions.EquipmentManage);
  const currency = company?.defaultCurrency ?? 'TRY';
  const showPrice = can(Permissions.Prices);
  const yesNo = (v: boolean) => (v ? t('common.yes') : t('common.no'));
  const dims = (e: Equipment) =>
    e.lengthCm != null || e.widthCm != null || e.heightCm != null ? `${e.lengthCm ?? '–'} × ${e.widthCm ?? '–'} × ${e.heightCm ?? '–'}` : null;

  const defs: Record<ColumnKey, ColumnDef> = {
    code: { title: t('equipment.code'), width: 110, render: (e) => e.code, excel: (e) => e.code },
    name: {
      title: t('equipment.name'),
      render: (e) => (
        <>
          <div>{e.name}</div>
          {visible.includes('containedIn') ? null : <ContainedIn e={e} />}
        </>
      ),
      excel: (e) => e.name,
    },
    brand: { title: t('equipment.brand'), width: 120, render: (e) => e.brand, excel: (e) => e.brand },
    model: { title: t('equipment.model'), width: 140, render: (e) => e.model, excel: (e) => e.model },
    folder: { title: t('equipment.folder'), width: 140, render: (e) => e.folderName, excel: (e) => e.folderName },
    type: { title: t('equipment.type'), width: 130, render: (e) => t(`enums.equipmentType.${e.type}`), excel: (e) => t(`enums.equipmentType.${e.type}`) },
    tracking: {
      title: t('equipment.tracking'),
      width: 110,
      render: (e) => <Tag color={e.isSerialized ? 'blue' : 'default'}>{e.isSerialized ? t('equipment.serialized') : t('equipment.bulk')}</Tag>,
      excel: (e) => (e.isSerialized ? t('equipment.serialized') : t('equipment.bulk')),
    },
    stock: { title: t('equipment.stock'), width: 80, align: 'end', render: (e) => e.stock, excel: (e) => e.stock },
    price: {
      title: t('equipment.dailyPrice'),
      width: 130,
      align: 'end',
      render: (e) => (e.rentalPrice == null ? '—' : f.money(e.rentalPrice, currency)),
      excel: (e) => e.rentalPrice ?? null,
    },
    weight: { title: t('equipment.weightKg'), width: 100, align: 'end', render: (e) => e.weightKg, excel: (e) => e.weightKg },
    volume: { title: t('equipment.volumeM3'), width: 100, align: 'end', render: (e) => e.volumeM3, excel: (e) => e.volumeM3 },
    dimensions: { title: t('equipmentList.dimensionsCm'), width: 150, render: (e) => dims(e), excel: (e) => dims(e) },
    power: { title: t('equipment.powerW'), width: 90, align: 'end', render: (e) => e.powerW, excel: (e) => e.powerW },
    country: { title: t('equipment.countryOfOrigin'), width: 120, render: (e) => e.countryOfOrigin, excel: (e) => e.countryOfOrigin },
    showInQuotes: {
      title: t('equipmentList.showInQuotes'),
      width: 120,
      render: (e) => <Tag color={e.showInQuotes ? 'green' : 'default'}>{yesNo(e.showInQuotes)}</Tag>,
      excel: (e) => yesNo(e.showInQuotes),
    },
    purchaseDate: {
      title: t('equipmentList.purchaseDate'),
      width: 120,
      render: (e) => (e.purchaseDate ? formatDate(e.purchaseDate) : null),
      excel: (e) => (e.purchaseDate ? new Date(e.purchaseDate) : null),
    },
    warrantyEndDate: {
      title: t('equipmentList.warrantyEndDate'),
      width: 120,
      render: (e) => (e.warrantyEndDate ? formatDate(e.warrantyEndDate) : null),
      excel: (e) => (e.warrantyEndDate ? new Date(e.warrantyEndDate) : null),
    },
    supplier: { title: t('equipmentList.purchaseSupplier'), width: 160, render: (e) => e.purchaseSupplierName, excel: (e) => e.purchaseSupplierName },
    notes: {
      title: t('common.notes'),
      width: 200,
      render: (e) => <Typography.Text ellipsis style={{ maxWidth: 190 }}>{e.notes}</Typography.Text>,
      excel: (e) => e.notes,
    },
    containedIn: {
      title: t('equipmentList.containedIn'),
      width: 200,
      render: (e) => <ContainedIn e={e} />,
      excel: (e) => e.containedIn.map((c) => `${c.code} ${c.name}`).join(', '),
    },
  };

  const available = ALL_COLUMNS.filter((c) => c !== 'price' || showPrice);
  const shown = available.filter((c) => visible.includes(c));

  const columns: TableColumnsType<Equipment> = shown.map((key) => ({
    key,
    title: defs[key].title,
    width: defs[key].width,
    align: defs[key].align,
    ellipsis: key === 'name' ? false : undefined,
    render: (_: unknown, e: Equipment) => defs[key].render(e),
  }));

  const excelColumns: ExcelColumn<Equipment>[] = shown.map((key) => ({
    header: defs[key].title,
    value: defs[key].excel,
    width: key === 'name' ? 40 : undefined,
  }));

  const setColumns = (next: ColumnKey[]) => {
    const ordered = ALL_COLUMNS.filter((c) => next.includes(c));
    setVisible(ordered);
    writeColumns(ordered);
  };

  const runExport = async (rows: () => Promise<Equipment[]>) => {
    setExporting(true);
    try {
      await exportToExcel(t('equipment.exportFile'), excelColumns, await rows());
    } catch (e) {
      showError(e);
    } finally {
      setExporting(false);
    }
  };

  const deleteSelected = () =>
    modal.confirm({
      title: t('equipmentDelete.selectedConfirmTitle', { count: selected.size }),
      content: t('equipmentDelete.confirm'),
      okText: t('common.delete'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        let deleted = 0;
        for (const id of selected.keys()) {
          try {
            await equipmentApi.remove(id);
            deleted++;
          } catch (e) {
            showError(e);
          }
        }
        if (deleted > 0) message.success(t('equipmentDelete.deleted', { count: deleted }));
        setSelected(new Map());
        queryClient.invalidateQueries({ queryKey: ['equipment'] });
        queryClient.invalidateQueries({ queryKey: ['folders'] });
      },
    });

  const archiveSelected = () =>
    modal.confirm({
      title: t('equipmentList.archiveSelectedConfirm', { count: selected.size }),
      okText: t('equipment.archive'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          for (const id of selected.keys()) await equipmentApi.archive(id);
          message.success(t('equipmentList.archived', { count: selected.size }));
          setSelected(new Map());
        } catch (e) {
          showError(e);
        } finally {
          queryClient.invalidateQueries({ queryKey: ['equipment'] });
          queryClient.invalidateQueries({ queryKey: ['folders'] });
        }
      },
    });

  const importFields: ImportField[] = [
    { key: 'code', header: t('equipment.code'), required: true },
    { key: 'name', header: t('equipment.name'), required: true },
    { key: 'brand', header: t('equipment.brand') },
    { key: 'model', header: t('equipment.model') },
    { key: 'folder', header: t('equipment.importFolder') },
    { key: 'isSerialized', header: t('equipment.isSerialized'), type: 'boolean' },
    { key: 'stockQuantity', header: t('equipment.stockQuantity'), type: 'number' },
    ...(showPrice ? [{ key: 'rentalPrice', header: t('equipment.dailyPrice'), type: 'number' as const }] : []),
    { key: 'weightKg', header: t('equipment.weightKg'), type: 'number' },
    { key: 'lengthCm', header: t('equipment.lengthCm'), type: 'number' },
    { key: 'widthCm', header: t('equipment.widthCm'), type: 'number' },
    { key: 'heightCm', header: t('equipment.heightCm'), type: 'number' },
    { key: 'powerW', header: t('equipment.powerW'), type: 'number' },
    { key: 'notes', header: t('common.notes') },
  ];

  const columnChooser = (
    <div style={{ width: 240 }}>
      <Flex vertical gap={4} style={{ maxHeight: 360, overflow: 'auto' }}>
        {available.map((key) => (
          <Checkbox
            key={key}
            checked={visible.includes(key)}
            disabled={key === 'code' || key === 'name'}
            onChange={(e) => setColumns(e.target.checked ? [...visible, key] : visible.filter((c) => c !== key))}
          >
            {defs[key].title}
          </Checkbox>
        ))}
      </Flex>
      <Button type="link" size="small" style={{ paddingInline: 0, marginTop: 8 }} onClick={() => setColumns(DEFAULT_COLUMNS)}>
        {t('equipmentList.resetColumns')}
      </Button>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{folderName ?? t('equipment.title')}</Typography.Title>
        <Flex gap={8} wrap>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'export', icon: <FileExcelOutlined />, label: t('equipmentList.exportAll') },
                ...(manage ? [{ key: 'import', icon: <UploadOutlined />, label: t('excel.import') }] : []),
              ],
              onClick: ({ key }) => {
                if (key === 'export')
                  runExport(() => fetchAllPages((skipCount, maxResultCount) => equipmentApi.list({ ...filter, skipCount, maxResultCount })));
                if (key === 'import') importRef.current?.querySelector('button')?.click();
              },
            }}
          >
            <Button loading={exporting}>
              {t('equipmentList.more')} <DownOutlined />
            </Button>
          </Dropdown>
          {manage && (
            // The import dialog is opened from the "More" menu; its own trigger button stays hidden.
            <span ref={importRef} style={{ display: 'none' }}>
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
            </span>
          )}
          {manage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
              {t('equipment.create')}
            </Button>
          )}
        </Flex>
      </div>
      <Card size="small">
        <Flex gap={8} justify="space-between" align="center" wrap style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder={t('equipment.searchPlaceholder')}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPage(1);
            }}
            style={{ maxWidth: 360 }}
          />
          <Popover trigger="click" placement="bottomRight" title={t('equipmentList.columns')} content={columnChooser}>
            <Button type="text" icon={<MoreOutlined />} aria-label={t('equipmentList.columns')} title={t('equipmentList.columns')} />
          </Popover>
        </Flex>

        {selected.size > 0 && (
          <SelectionBar>
            <Typography.Text strong>{t('equipmentList.selected', { count: selected.size })}</Typography.Text>
            <Space wrap>
              <Button size="small" icon={<FileExcelOutlined />} loading={exporting} onClick={() => runExport(async () => [...selected.values()])}>
                {t('equipmentList.exportSelected')}
              </Button>
              <Button size="small" icon={<PrinterOutlined />} onClick={() => labels.open({ equipmentIds: [...selected.keys()] })}>
                {t('equipmentList.createLabels')}
              </Button>
              {manage && (
                <Button size="small" danger icon={<InboxOutlined />} onClick={archiveSelected}>
                  {t('equipment.archive')}
                </Button>
              )}
              {can(Permissions.EquipmentDelete) && (
                <Button size="small" danger icon={<DeleteOutlined />} onClick={deleteSelected}>
                  {t('common.delete')}
                </Button>
              )}
              <Button size="small" type="link" onClick={() => setSelected(new Map())}>
                {t('equipmentList.clearSelection')}
              </Button>
            </Space>
          </SelectionBar>
        )}

        <Table<Equipment>
          size="small"
          rowKey="id"
          loading={list.isFetching}
          dataSource={list.data?.items}
          scroll={{ x: Math.max(760, shown.length * 120) }}
          rowSelection={{
            selectedRowKeys: [...selected.keys()],
            preserveSelectedRowKeys: true,
            onChange: (_keys, rows) => {
              const next = new Map(selected);
              const pageIds = new Set((list.data?.items ?? []).map((e) => e.id));
              for (const id of pageIds) next.delete(id);
              rows.filter(Boolean).forEach((r) => next.set(r.id, r));
              setSelected(next);
            },
          }}
          expandable={{
            rowExpandable: (e) => e.isSerialized,
            expandedRowRender: (e) => <SerialNumbers equipmentId={e.id} />,
          }}
          onRow={(e) => ({
            onClick: (ev) => {
              const target = ev.target as HTMLElement;
              if (target.closest('a, button, input, .ant-table-selection-column, .ant-table-row-expand-icon-cell')) return;
              navigate(`/equipment/${e.id}`);
            },
            style: { cursor: 'pointer' },
          })}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.totalCount, onChange: setPage, showSizeChanger: false }}
          columns={columns}
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

function SelectionBar({ children }: { children: ReactNode }) {
  const { token } = theme.useToken();
  return (
    <Flex
      align="center"
      justify="space-between"
      gap={8}
      wrap
      style={{ padding: '6px 10px', marginBottom: 8, borderRadius: token.borderRadius, background: token.controlItemBgActive }}
    >
      {children}
    </Flex>
  );
}

/** "Part of a case" note: the cases/sets whose default content includes this equipment. */
function ContainedIn({ e }: { e: Equipment }) {
  const { t } = useTranslation();
  if (!e.containedIn?.length) return null;
  return (
    <Flex vertical gap={0}>
      {e.containedIn.map((c) => (
        <Typography.Text key={c.id} type="secondary" style={{ fontSize: 12 }}>
          📦{' '}
          <Link to={`/equipment/${c.id}`} onClick={(ev) => ev.stopPropagation()}>
            {t('equipmentList.containedInNote', { code: c.code, name: c.name })}
          </Link>
        </Typography.Text>
      ))}
    </Flex>
  );
}

/** Devices (serial numbers) of one serialized equipment, shown when its row is expanded. */
function SerialNumbers({ equipmentId }: { equipmentId: string }) {
  const { t } = useTranslation();
  const units = useQuery({
    queryKey: ['units', 'equipment-list', equipmentId],
    queryFn: () => unitApi.list({ equipmentId, maxResultCount: 500 }),
  });
  return (
    <Table
      size="small"
      rowKey="id"
      loading={units.isLoading}
      dataSource={units.data?.items}
      pagination={false}
      style={{ marginBlock: 4 }}
      columns={[
        {
          title: t('units.internalRef'),
          width: 140,
          render: (_, u) => <Link to={`/equipment/units/${u.id}`}>{u.internalRef}</Link>,
        },
        { title: t('units.serialNumber'), dataIndex: 'serialNumber', width: 160, render: (v) => v ?? '—' },
        { title: t('units.location'), dataIndex: 'stockLocationName', width: 140, render: (v) => v ?? '—' },
        { title: t('units.status'), dataIndex: 'status', width: 120, render: (s) => <UnitStatusTag status={s} /> },
        {
          title: t('units.currentProject'),
          render: (_, u) =>
            u.currentProjectId ? (
              <Link to={`/projects/${u.currentProjectId}`}>{`${u.currentProjectNumber} · ${u.currentProjectName}`}</Link>
            ) : (
              '—'
            ),
        },
        { title: t('equipmentList.purchaseDate'), dataIndex: 'purchaseDate', width: 120, render: (v) => (v ? formatDate(v) : '—') },
      ]}
    />
  );
}
