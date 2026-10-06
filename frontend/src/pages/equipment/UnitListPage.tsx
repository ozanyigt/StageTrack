import { PrinterOutlined, SwapOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, Flex, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLabelGenerator } from '../../components/LabelGenerator';
import { Link } from 'react-router-dom';
import { unitApi } from '../../api/endpoints';
import { UNIT_STATUSES, type UnitImportRow, type UnitStatus } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { ExportButton, ImportButton } from '../../components/ExcelButtons';
import { StockLocationSelect } from '../../components/Selects';
import { UnitStatusTag } from '../../components/StatusTags';
import { fetchAllPages } from '../../utils/excel';
import { formatDate } from '../../utils/format';
import { useDebounced } from '../../utils/useDebounced';
import { TransferUnitsModal, useCanTransfer } from './TransferUnitsModal';
import { isInspectionOverdue } from './UnitGrid';
import { unitExportColumns, unitImportFields } from './unitExcel';

const PAGE_SIZE = 50;

/** All devices across equipment, like Rentman's "Serial numbers" screen; also finds a device by its label code. */
export function UnitListPage() {
  const { t } = useTranslation();
  const labels = useLabelGenerator();
  const qc = useQueryClient();
  const { can } = useAuth();
  const canTransfer = useCanTransfer();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<UnitStatus>();
  const [locationId, setLocationId] = useState<string>();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const search = useDebounced(text, 300);

  const filter = { text: search, status, stockLocationId: locationId, includeArchived };
  const list = useQuery({
    queryKey: ['units', 'all', filter, page],
    queryFn: () => unitApi.list({ ...filter, skipCount: (page - 1) * PAGE_SIZE, maxResultCount: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const resetPage = () => setPage(1);

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('units.allTitle')}</Typography.Title>
        <Space wrap>
          {can(Permissions.EquipmentManage) && (
            <ImportButton
              title={t('unitGrid.importTitle')}
              templateName="serial-numbers-template"
              fields={unitImportFields(t)}
              onImport={(rows) => unitApi.import(rows as unknown as UnitImportRow[])}
              onDone={() => qc.invalidateQueries({ queryKey: ['units'] })}
            />
          )}
          <ExportButton
            fileName="serial-numbers"
            columns={unitExportColumns(t)}
            load={() => fetchAllPages((skipCount, maxResultCount) => unitApi.list({ ...filter, skipCount, maxResultCount }))}
          />
        </Space>
      </div>
      <Card size="small">
        <Flex gap={8} wrap align="center" style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder={t('units.searchPlaceholder')}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              resetPage();
            }}
            style={{ maxWidth: 360 }}
          />
          <Select
            allowClear
            placeholder={t('units.status')}
            value={status}
            style={{ width: 160 }}
            onChange={(v) => {
              setStatus(v);
              resetPage();
            }}
            options={UNIT_STATUSES.map((s) => ({ value: s, label: t(`enums.unitStatus.${s}`) }))}
          />
          <StockLocationSelect
            placeholder={t('units.location')}
            value={locationId}
            style={{ width: 180 }}
            onChange={(v) => {
              setLocationId(v);
              resetPage();
            }}
          />
          <Checkbox
            checked={includeArchived}
            onChange={(e) => {
              setIncludeArchived(e.target.checked);
              resetPage();
            }}
          >
            {t('unitGrid.showArchived')}
          </Checkbox>
          <Space style={{ marginInlineStart: 'auto' }} wrap>
            <Button icon={<PrinterOutlined />} disabled={selected.length === 0} onClick={() => labels.open({ unitIds: selected })}>
              {t('unitGrid.printLabels', { count: selected.length })}
            </Button>
            {canTransfer && (
              <Button icon={<SwapOutlined />} disabled={selected.length === 0} onClick={() => setTransferOpen(true)}>
                {t('transfer.button')}
              </Button>
            )}
          </Space>
        </Flex>
        <Table
          size="small"
          rowKey="id"
          loading={list.isFetching}
          dataSource={list.data?.items}
          scroll={{ x: 1100 }}
          rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys as string[]), preserveSelectedRowKeys: true }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.totalCount, onChange: setPage, showSizeChanger: false }}
          columns={[
            { title: t('equipment.code'), dataIndex: 'equipmentCode', width: 110, render: (v, u) => <Link to={`/equipment/${u.equipmentId}`}>{v}</Link> },
            { title: t('equipment.name'), dataIndex: 'equipmentName', ellipsis: true },
            {
              title: t('units.internalRef'),
              dataIndex: 'internalRef',
              width: 160,
              render: (v, u) => (
                <Space size={4}>
                  <Link to={`/equipment/units/${u.id}`}>{v}</Link>
                  {u.isArchived && <Tag>{t('unitGrid.archived')}</Tag>}
                </Space>
              ),
            },
            { title: t('units.serialNumber'), dataIndex: 'serialNumber', width: 140 },
            { title: t('units.location'), dataIndex: 'stockLocationName', width: 110 },
            { title: t('units.status'), dataIndex: 'status', width: 110, render: (s) => <UnitStatusTag status={s} /> },
            {
              title: t('units.currentProject'),
              width: 190,
              ellipsis: true,
              render: (_, u) => (u.currentProjectId ? <Link to={`/projects/${u.currentProjectId}`}>{u.currentProjectNumber} · {u.currentProjectName}</Link> : '—'),
            },
            {
              title: t('unitDetail.nextInspection'),
              width: 120,
              render: (_, u) =>
                u.nextInspectionDate ? <Typography.Text type={isInspectionOverdue(u) ? 'danger' : undefined}>{formatDate(u.nextInspectionDate)}</Typography.Text> : '—',
            },
            {
              title: t('units.labels'),
              width: 90,
              render: (_, u) => (u.labelCount ? <Tag color="green">{u.labelCount}</Tag> : <Tag color="orange">{t('labels.noLabel')}</Tag>),
            },
          ]}
        />
      </Card>
      <TransferUnitsModal
        unitIds={selected}
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        onDone={() => {
          setSelected([]);
          qc.invalidateQueries({ queryKey: ['units'] });
        }}
      />
    </>
  );
}
