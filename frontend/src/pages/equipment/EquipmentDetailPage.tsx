import { ArrowLeftOutlined, CameraOutlined, DeleteOutlined, InboxOutlined, PrinterOutlined, ScanOutlined, UndoOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Flex, Modal, Popconfirm, Skeleton, Space, Table, Tabs, Tag, Typography, Upload } from 'antd';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { equipmentApi, labelApi, warehouseApi } from '../../api/endpoints';
import { UNIT_STATUSES, type EquipmentDetail, type Movement } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { AuthImage } from '../../components/AuthImage';
import { CollaborationPanel } from '../../components/CollaborationPanel';
import { ScanInput } from '../../components/ScanInput';
import { useLabelGenerator } from '../../components/LabelGenerator';
import { useErrorToast } from '../../utils/errors';
import { useFormat } from '../../utils/format';
import { EquipmentInspectionTab, EquipmentRepairsTab } from './EquipmentMaintenanceTabs';
import { EquipmentPropertiesTab } from './EquipmentPropertiesTab';
import { EquipmentRelationsTab, EquipmentSuppliersTab } from './EquipmentRelationsTab';
import { UnitGrid } from './UnitGrid';

export function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { modal } = App.useApp();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const manage = can(Permissions.EquipmentManage);
  const [tab, setTab] = useState('properties');
  const propertiesGuard = useRef<(() => Promise<boolean>) | null>(null);

  const equipment = useQuery({ queryKey: ['equipment', id], queryFn: () => equipmentApi.get(id!) });
  const apply = (saved: EquipmentDetail) => queryClient.setQueryData(['equipment', id], saved);

  const archive = useMutation({
    mutationFn: () => (equipment.data!.isArchived ? equipmentApi.restore(id!) : equipmentApi.archive(id!)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipment'] }),
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: () => equipmentApi.remove(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      navigate(equipment.data?.folderId ? `/equipment?folder=${equipment.data.folderId}` : '/equipment');
    },
    onError: showError,
  });

  const setImage = useMutation({ mutationFn: (file: File) => equipmentApi.setImage(id!, file), onSuccess: apply, onError: showError });
  const removeImage = useMutation({ mutationFn: () => equipmentApi.removeImage(id!), onSuccess: apply, onError: showError });

  if (equipment.isLoading || !equipment.data) return <Skeleton active />;
  const e = equipment.data;
  const backTo = e.folderId ? `/equipment?folder=${e.folderId}` : '/equipment';

  const tabs = [
    {
      key: 'properties',
      label: t('equipmentDetail.tabs.properties'),
      children: <EquipmentPropertiesTab equipment={e} onLeaveGuard={(fn) => (propertiesGuard.current = fn)} />,
    },
    // Serial numbers only for serial-tracked equipment; quantity-tracked items keep just a stock count.
    ...(e.isSerialized
      ? [{ key: 'units', label: `${t('equipmentDetail.tabs.manufacturerSerials')} (${e.stock})`, children: <UnitGrid equipmentId={e.id} canManage={manage} /> }]
      : []),
    {
      key: 'content',
      label: `${t('equipmentDetail.tabs.content')} (${e.relations.filter((r) => r.kind === 'Content').length})`,
      children: <EquipmentRelationsTab equipment={e} kind="Content" />,
    },
    {
      key: 'accessories',
      label: `${t('equipmentDetail.tabs.accessories')} (${e.relations.filter((r) => r.kind === 'Accessory').length})`,
      children: <EquipmentRelationsTab equipment={e} kind="Accessory" />,
    },
    {
      key: 'alternatives',
      label: `${t('equipmentDetail.tabs.alternatives')} (${e.relations.filter((r) => r.kind === 'Alternative').length})`,
      children: <EquipmentRelationsTab equipment={e} kind="Alternative" />,
    },
    { key: 'suppliers', label: `${t('equipmentDetail.tabs.suppliers')} (${e.suppliers.length})`, children: <EquipmentSuppliersTab equipment={e} /> },
    { key: 'inspection', label: t('equipmentDetail.tabs.inspection'), children: <EquipmentInspectionTab equipment={e} /> },
    ...(can(Permissions.Maintenance) ? [{ key: 'repairs', label: t('equipmentDetail.tabs.repairs'), children: <EquipmentRepairsTab equipment={e} /> }] : []),
    { key: 'history', label: t('equipmentDetail.tabs.history'), children: <HistoryTab equipmentId={e.id} /> },
  ];

  return (
    <>
      <div className="page-header">
        <Space align="center">
          <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate(backTo)} aria-label={t('common.back')} />
          <Typography.Title level={3}>
            {e.code} · {e.name}
          </Typography.Title>
          {e.isArchived && <Tag>{t('equipment.archived')}</Tag>}
        </Space>
        <Space>
          {manage && (
            <Button
              icon={e.isArchived ? <UndoOutlined /> : <InboxOutlined />}
              loading={archive.isPending}
              onClick={() => (e.isArchived ? archive.mutate() : modal.confirm({ title: t('equipment.archiveConfirm'), onOk: () => archive.mutateAsync() }))}
            >
              {e.isArchived ? t('equipment.restore') : t('equipment.archive')}
            </Button>
          )}
          {can(Permissions.EquipmentDelete) && (
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={remove.isPending}
              onClick={() =>
                modal.confirm({
                  title: t('equipmentDelete.confirmTitle', { code: e.code }),
                  content: t('equipmentDelete.confirm'),
                  okText: t('common.delete'),
                  cancelText: t('common.cancel'),
                  okButtonProps: { danger: true },
                  onOk: () => remove.mutateAsync(),
                })
              }
            >
              {t('common.delete')}
            </Button>
          )}
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Flex gap={16} wrap align="start">
          <Flex vertical gap={6} align="center">
            <AuthImage attachmentId={e.imageAttachmentId} size={140} />
            {manage && (
              <Space size={4}>
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    setImage.mutate(file);
                    return false;
                  }}
                >
                  <Button size="small" icon={<CameraOutlined />} loading={setImage.isPending}>
                    {e.imageAttachmentId ? t('equipmentDetail.changeImage') : t('equipmentDetail.addImage')}
                  </Button>
                </Upload>
                {e.imageAttachmentId && (
                  <Popconfirm title={t('equipmentDetail.removeImageConfirm')} onConfirm={() => removeImage.mutate()}>
                    <Button size="small" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} />
                  </Popconfirm>
                )}
              </Space>
            )}
          </Flex>
          <Flex vertical gap={6} style={{ flex: 1, minWidth: 240 }}>
            <Typography.Text type="secondary">{e.folderPath ?? t('equipmentDetail.noFolder')}</Typography.Text>
            <Typography.Text>
              {[e.brand, e.model].filter(Boolean).join(' · ') || '—'}
            </Typography.Text>
            <Space wrap size={4}>
              <Tag color={e.isSerialized ? 'blue' : 'default'}>{e.isSerialized ? t('equipment.serialized') : t('equipment.bulk')}</Tag>
              <Tag>{t(`enums.equipmentType.${e.type}`)}</Tag>
              <Tag color="geekblue">
                {t('equipment.stock')}: {e.stock}
              </Tag>
              {!e.showInQuotes && <Tag color="orange">{t('equipmentQuote.notInQuotes')}</Tag>}
              {e.isSerialized &&
                UNIT_STATUSES.filter((s) => e.unitStatusCounts[s]).map((s) => (
                  <Tag key={s}>
                    {t(`enums.unitStatus.${s}`)}: {e.unitStatusCounts[s]}
                  </Tag>
                ))}
            </Space>
            {e.containedIn.length > 0 && (
              <Alert
                type="info"
                showIcon
                style={{ padding: '4px 10px' }}
                message={
                  <span>
                    {t('equipmentQuote.containedIn')}{' '}
                    {e.containedIn.map((c, i) => (
                      <span key={c.id}>
                        {i > 0 && ', '}
                        <Link to={`/equipment/${c.id}`}>
                          {c.code} {c.name}
                        </Link>
                      </span>
                    ))}
                  </span>
                }
              />
            )}
            {!e.isSerialized && <EquipmentLabels equipment={e} />}
          </Flex>
        </Flex>
      </Card>

      <Card size="small">
        <Tabs
          activeKey={tabs.some((x) => x.key === tab) ? tab : 'properties'}
          onChange={async (key) => {
            if (tab === 'properties' && propertiesGuard.current && !(await propertiesGuard.current())) return;
            setTab(key);
          }}
          items={tabs}
        />
      </Card>

      <Card size="small" style={{ marginTop: 12 }}>
        <CollaborationPanel ownerType="Equipment" ownerId={e.id} />
      </Card>
    </>
  );
}

/** Labels of quantity-tracked equipment: list, print a new one, or scan an existing label to link it. */
function EquipmentLabels({ equipment }: { equipment: EquipmentDetail }) {
  const { t } = useTranslation();
  const labels = useLabelGenerator();
  const { can } = useAuth();
  const { message } = App.useApp();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const [scanOpen, setScanOpen] = useState(false);
  const assignAllowed = can(Permissions.LabelsAssign);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['equipment', equipment.id] });

  const assign = useMutation({
    mutationFn: (code: string) => labelApi.assign({ code, type: 'RentmanQr', equipmentId: equipment.id, unitId: null }),
    onSuccess: (label) => {
      message.success(t('labels.assigned', { code: label.code }));
      setScanOpen(false);
      refresh();
    },
    onError: showError,
  });

  return (
    <div>
      <Typography.Text strong>{t('labels.equipmentLabels')}</Typography.Text>
      <Flex gap={6} wrap align="center" style={{ marginTop: 4 }}>
        {equipment.labels.length === 0 && <Typography.Text type="secondary">{t('labels.none')}</Typography.Text>}
        {equipment.labels.map((l) => (
          <Tag
            key={l.id}
            closable={assignAllowed}
            onClose={(ev) => {
              ev.preventDefault();
              Modal.confirm({
                title: t('equipmentDetail.removeLabelConfirm', { code: l.code }),
                onOk: () => labelApi.remove(l.id).then(refresh).catch(showError),
              });
            }}
          >
            {l.code} · {t(`enums.labelType.${l.type}`)}
          </Tag>
        ))}
        <Button size="small" icon={<PrinterOutlined />} onClick={() => labels.open({ equipmentIds: [equipment.id] })}>
          {t('equipmentDetail.createLabel')}
        </Button>
        {assignAllowed && (
          <Button size="small" icon={<ScanOutlined />} onClick={() => setScanOpen(true)}>
            {t('equipmentDetail.scanLabel')}
          </Button>
        )}
      </Flex>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '4px 0 0' }}>
        {t('labels.bulkHint')}
      </Typography.Paragraph>
      <Modal open={scanOpen} title={t('labels.addTitle', { target: equipment.name })} footer={null} onCancel={() => setScanOpen(false)} destroyOnHidden>
        <Typography.Paragraph type="secondary">{t('labels.addHint')}</Typography.Paragraph>
        <ScanInput autoFocus disabled={assign.isPending} onScan={(code) => assign.mutate(code)} />
      </Modal>
    </div>
  );
}


const HISTORY_PAGE = 20;

function HistoryTab({ equipmentId }: { equipmentId: string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [page, setPage] = useState(1);
  const movements = useQuery({
    queryKey: ['movements', 'equipment', equipmentId, page],
    queryFn: () => warehouseApi.movements({ equipmentId, skipCount: (page - 1) * HISTORY_PAGE, maxResultCount: HISTORY_PAGE }),
    placeholderData: keepPreviousData,
  });

  return (
    <Table<Movement>
      size="small"
      rowKey="id"
      loading={movements.isFetching}
      dataSource={movements.data?.items}
      scroll={{ x: 800 }}
      pagination={{ current: page, pageSize: HISTORY_PAGE, total: movements.data?.totalCount, onChange: setPage, showSizeChanger: false }}
      columns={[
        { title: t('movements.time'), dataIndex: 'creationTime', width: 140, render: (v) => f.utcDateTime(v) },
        { title: t('movements.action'), dataIndex: 'action', width: 150, render: (a) => t(`enums.movementAction.${a}`) },
        {
          title: t('movements.unit'),
          dataIndex: 'unitInternalRef',
          width: 140,
          render: (v, m) => (m.unitId ? <Link to={`/equipment/units/${m.unitId}`}>{v}</Link> : '—'),
        },
        {
          title: t('movements.project'),
          render: (_, m) => (m.projectId ? <Link to={`/projects/${m.projectId}`}>{m.projectNumber} · {m.projectName}</Link> : m.note ?? '—'),
          ellipsis: true,
        },
        { title: t('movements.label'), dataIndex: 'labelCode', width: 120, render: (v) => v ?? '—' },
        { title: t('movements.user'), dataIndex: 'userFullName', width: 150, render: (v) => v ?? t('movements.system') },
      ]}
    />
  );
}
