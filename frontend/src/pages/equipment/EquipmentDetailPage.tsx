import { ArrowLeftOutlined, EditOutlined, InboxOutlined, PlusOutlined, QrcodeOutlined, TagOutlined, UndoOutlined } from '@ant-design/icons';
import {
  App, Button, Card, Descriptions, Dropdown, Flex, Form, Input, Modal, Skeleton, Space, Table, Tag, Typography,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { equipmentApi, labelApi, unitApi, warehouseApi } from '../../api/endpoints';
import { UNIT_STATUSES, type EquipmentUnit, type Label, type UnitStatus } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { QrLabelModal } from '../../components/QrLabelModal';
import { ScanInput } from '../../components/ScanInput';
import { StockLocationSelect } from '../../components/Selects';
import { UnitStatusTag } from '../../components/StatusTags';
import { useErrorToast } from '../../utils/errors';
import { useFormat } from '../../utils/format';
import { EquipmentFormDrawer } from './EquipmentFormDrawer';

interface UnitForm {
  internalRef: string;
  serialNumber?: string;
  stockLocationId?: string;
  notes?: string;
  labelCode?: string;
}

export function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can, company } = useAuth();
  const { message, modal } = App.useApp();
  const f = useFormat();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const manage = can(Permissions.EquipmentManage);

  const [editOpen, setEditOpen] = useState(false);
  const [unitModal, setUnitModal] = useState(false);
  const [labelTarget, setLabelTarget] = useState<{ unit?: EquipmentUnit } | null>(null);
  const [qr, setQr] = useState<{ title: string; subtitle?: string; labels: Label[] } | null>(null);
  const [unitForm] = Form.useForm<UnitForm>();

  const equipment = useQuery({ queryKey: ['equipment', id], queryFn: () => equipmentApi.get(id!) });
  const units = useQuery({
    queryKey: ['units', id],
    queryFn: () => unitApi.list({ equipmentId: id, maxResultCount: 1000 }),
    enabled: !!equipment.data?.isSerialized,
  });
  const movements = useQuery({ queryKey: ['movements', 'equipment', id], queryFn: () => warehouseApi.movements({ equipmentId: id, maxResultCount: 20 }) });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['equipment'] });
    queryClient.invalidateQueries({ queryKey: ['units', id] });
    queryClient.invalidateQueries({ queryKey: ['movements'] });
  };

  const createUnit = useMutation({
    mutationFn: (v: UnitForm) => unitApi.create({ ...v, equipmentId: id! }),
    onSuccess: () => {
      message.success(t('common.saved'));
      setUnitModal(false);
      refresh();
    },
    onError: showError,
  });

  const changeStatus = useMutation({
    mutationFn: ({ unitId, status }: { unitId: string; status: UnitStatus }) => unitApi.changeStatus(unitId, status),
    onSuccess: refresh,
    onError: showError,
  });

  const archive = useMutation({
    mutationFn: () => (equipment.data!.isArchived ? equipmentApi.restore(id!) : equipmentApi.archive(id!)),
    onSuccess: refresh,
    onError: showError,
  });

  const addLabel = useMutation({
    mutationFn: (code: string) =>
      labelApi.assign({ code, type: 'RentmanQr', unitId: labelTarget?.unit?.id ?? null, equipmentId: labelTarget?.unit ? null : id }),
    onSuccess: (label) => {
      message.success(t('labels.assigned', { code: label.code }));
      setLabelTarget(null);
      refresh();
    },
    onError: showError,
  });

  const showUnitQr = async (unit: EquipmentUnit) => {
    try {
      const labels = await unitApi.labels(unit.id);
      setQr({ title: `${equipment.data?.name}`, subtitle: unit.internalRef, labels });
    } catch (e) {
      showError(e);
    }
  };

  if (equipment.isLoading || !equipment.data) return <Skeleton active />;
  const e = equipment.data;

  return (
    <>
      <div className="page-header">
        <Space align="center">
          <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/equipment')} aria-label={t('common.back')} />
          <Typography.Title level={3}>
            {e.code} · {e.name}
          </Typography.Title>
          {e.isArchived && <Tag>{t('equipment.archived')}</Tag>}
        </Space>
        {manage && (
          <Space wrap>
            <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>{t('common.edit')}</Button>
            <Button
              icon={e.isArchived ? <UndoOutlined /> : <InboxOutlined />}
              loading={archive.isPending}
              onClick={() =>
                e.isArchived
                  ? archive.mutate()
                  : modal.confirm({ title: t('equipment.archiveConfirm'), onOk: () => archive.mutateAsync() })
              }
            >
              {e.isArchived ? t('equipment.restore') : t('equipment.archive')}
            </Button>
          </Space>
        )}
      </div>

      <Card size="small">
        <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 4 }}>
          <Descriptions.Item label={t('equipment.brand')}>{e.brand ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('equipment.model')}>{e.model ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('equipment.type')}>{t(`enums.equipmentType.${e.type}`)}</Descriptions.Item>
          <Descriptions.Item label={t('equipment.tracking')}>{e.isSerialized ? t('equipment.serialized') : t('equipment.bulk')}</Descriptions.Item>
          <Descriptions.Item label={t('equipment.stock')}>{e.stock}</Descriptions.Item>
          <Descriptions.Item label={t('equipment.dailyPrice')}>{f.money(e.rentalPrice, company?.defaultCurrency ?? 'TRY')}</Descriptions.Item>
          <Descriptions.Item label={t('equipment.weightKg')}>{e.weightKg ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('common.notes')}>{e.notes ?? '—'}</Descriptions.Item>
        </Descriptions>
        {e.isSerialized && (
          <Flex gap={8} wrap>
            {UNIT_STATUSES.map((s) => (
              <Tag key={s}>{t(`enums.unitStatus.${s}`)}: {e.unitStatusCounts[s] ?? 0}</Tag>
            ))}
          </Flex>
        )}
      </Card>

      {e.isSerialized ? (
        <Card
          size="small"
          title={t('units.title')}
          style={{ marginTop: 12 }}
          extra={manage && (
            <Button size="small" type="primary" icon={<PlusOutlined />}
              onClick={() => { unitForm.resetFields(); setUnitModal(true); }}>
              {t('units.create')}
            </Button>
          )}
        >
          <Table
            size="small"
            rowKey="id"
            loading={units.isFetching}
            dataSource={units.data?.items}
            pagination={{ pageSize: 50, hideOnSinglePage: true }}
            scroll={{ x: 800 }}
            columns={[
              { title: t('units.internalRef'), dataIndex: 'internalRef', width: 150 },
              { title: t('units.serialNumber'), dataIndex: 'serialNumber', width: 150 },
              { title: t('units.location'), dataIndex: 'stockLocationName', width: 120 },
              { title: t('units.status'), dataIndex: 'status', width: 120, render: (s) => <UnitStatusTag status={s} /> },
              {
                title: t('units.currentProject'),
                render: (_, u) => (u.currentProjectId ? <Link to={`/projects/${u.currentProjectId}`}>{u.currentProjectNumber} · {u.currentProjectName}</Link> : '—'),
                ellipsis: true,
              },
              {
                title: t('units.labels'),
                dataIndex: 'labelCount',
                width: 90,
                render: (c: number) => (c ? <Tag color="green">{c}</Tag> : <Tag color="orange">{t('labels.noLabel')}</Tag>),
              },
              {
                title: '',
                width: 170,
                render: (_, u) => (
                  <Space size={4}>
                    <Button size="small" icon={<QrcodeOutlined />} onClick={() => showUnitQr(u)} aria-label={t('labels.showQr')} />
                    {can(Permissions.LabelsAssign) && (
                      <Button size="small" icon={<TagOutlined />} onClick={() => setLabelTarget({ unit: u })}>{t('labels.add')}</Button>
                    )}
                    {manage && u.status !== 'OnProject' && (
                      <Dropdown
                        menu={{
                          items: UNIT_STATUSES.filter((s) => s !== 'OnProject' && s !== u.status).map((s) => ({
                            key: s,
                            label: t(`enums.unitStatus.${s}`),
                            onClick: () => changeStatus.mutate({ unitId: u.id, status: s }),
                          })),
                        }}
                      >
                        <Button size="small">{t('units.changeStatus')}</Button>
                      </Dropdown>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      ) : (
        <Card
          size="small"
          title={t('labels.equipmentLabels')}
          style={{ marginTop: 12 }}
          extra={
            <Space>
              <Button size="small" icon={<QrcodeOutlined />} onClick={() => setQr({ title: e.name, subtitle: e.code, labels: e.labels })}>{t('labels.showQr')}</Button>
              {can(Permissions.LabelsAssign) && (
                <Button size="small" icon={<TagOutlined />} onClick={() => setLabelTarget({})}>{t('labels.add')}</Button>
              )}
            </Space>
          }
        >
          <Typography.Paragraph type="secondary">{t('labels.bulkHint')}</Typography.Paragraph>
          <Flex gap={8} wrap>
            {e.labels.map((l) => <Tag key={l.id}>{l.code} · {t(`enums.labelType.${l.type}`)}</Tag>)}
          </Flex>
        </Card>
      )}

      <Card size="small" title={t('movements.title')} style={{ marginTop: 12 }}>
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={movements.data?.items}
          scroll={{ x: 700 }}
          columns={[
            { title: t('movements.time'), dataIndex: 'creationTime', width: 140, render: (v) => f.utcDateTime(v) },
            { title: t('movements.action'), dataIndex: 'action', width: 140, render: (a) => t(`enums.movementAction.${a}`) },
            { title: t('movements.unit'), dataIndex: 'unitInternalRef', width: 140 },
            { title: t('movements.project'), render: (_, m) => (m.projectNumber ? `${m.projectNumber} · ${m.projectName}` : '—'), ellipsis: true },
            { title: t('movements.user'), dataIndex: 'userFullName', width: 150 },
          ]}
        />
      </Card>

      <EquipmentFormDrawer open={editOpen} equipment={e} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); refresh(); }} />

      <Modal
        open={unitModal}
        title={t('units.create')}
        onCancel={() => setUnitModal(false)}
        onOk={() => unitForm.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={createUnit.isPending}
        destroyOnHidden
      >
        <Form form={unitForm} layout="vertical" onFinish={(v) => createUnit.mutate(v)}>
          <Form.Item name="internalRef" label={t('units.internalRef')} rules={[{ required: true, message: t('validation.required') }]}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item name="serialNumber" label={t('units.serialNumber')}>
            <Input />
          </Form.Item>
          <Form.Item name="stockLocationId" label={t('units.location')}>
            <StockLocationSelect />
          </Form.Item>
          <Form.Item name="labelCode" label={t('units.labelCode')} extra={t('units.labelCodeHint')}>
            <Input />
          </Form.Item>
          <ScanInput size="middle" placeholder={t('units.scanToFill')} onScan={(code) => unitForm.setFieldValue('labelCode', code)} />
          <Form.Item name="notes" label={t('common.notes')} style={{ marginTop: 16 }}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!labelTarget}
        title={t('labels.addTitle', { target: labelTarget?.unit?.internalRef ?? e.name })}
        footer={null}
        onCancel={() => setLabelTarget(null)}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary">{t('labels.addHint')}</Typography.Paragraph>
        <ScanInput autoFocus disabled={addLabel.isPending} onScan={(code) => addLabel.mutate(code)} />
      </Modal>

      <QrLabelModal title={qr?.title ?? ''} subtitle={qr?.subtitle} labels={qr?.labels ?? null} onClose={() => setQr(null)} />
    </>
  );
}
