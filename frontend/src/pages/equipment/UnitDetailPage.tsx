import {
  ArrowLeftOutlined,
  DeleteOutlined,
  InboxOutlined,
  PlusOutlined,
  PrinterOutlined,
  RollbackOutlined,
  ScanOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Dropdown,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { inspectionApi, labelApi, repairApi, unitApi, warehouseApi } from '../../api/endpoints';
import { LABEL_TYPES, type EquipmentUnitDetail, type LabelType, type Repair, type RepairStatus } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { AuthImage } from '../../components/AuthImage';
import { CollaborationPanel } from '../../components/CollaborationPanel';
import { RichTextEditor, RichTextView } from '../../components/RichTextEditor';
import { ScanInput } from '../../components/ScanInput';
import { StockLocationSelect } from '../../components/Selects';
import { UnitStatusTag } from '../../components/StatusTags';
import { useErrorToast } from '../../utils/errors';
import { formatDate, formatDateTime, toApiDate, useFormat } from '../../utils/format';
import { SupplierSelect } from './SupplierSelect';
import { isInspectionOverdue } from './UnitGrid';

const repairStatusColor: Record<RepairStatus, string> = { Open: 'orange', InProgress: 'blue', Completed: 'green', Cancelled: 'default' };

export function RepairStatusTag({ status }: { status: RepairStatus }) {
  const { t } = useTranslation();
  return <Tag color={repairStatusColor[status]}>{t(`enums.repairStatus.${status}`)}</Tag>;
}

/** Rentman-like serial number page: details, labels, repairs/inspections and history of one device. */
export function UnitDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const showError = useErrorToast();
  const canManage = can(Permissions.EquipmentManage);
  const { data: unit, isLoading, isError } = useQuery({ queryKey: ['unit', id], queryFn: () => unitApi.get(id) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['unit', id] });
    qc.invalidateQueries({ queryKey: ['units'] });
  };

  if (isLoading) return <Spin style={{ display: 'block', margin: 48 }} />;
  if (isError || !unit) return <Alert type="error" showIcon message={t('errors.Common.Unexpected')} />;

  const setImage = (file: File) =>
    unitApi
      .setImage(id, file)
      .then(refresh)
      .catch(showError);

  return (
    <>
      <div className="page-header">
        <Space align="center" wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} aria-label={t('common.back')} />
          <Typography.Title level={3}>
            {unit.internalRef}
          </Typography.Title>
          <UnitStatusTag status={unit.status} />
          {unit.isArchived && <Tag>{t('unitGrid.archived')}</Tag>}
        </Space>
        <Space wrap>
          <Button icon={<PrinterOutlined />} onClick={() => navigate(`/labels/print?units=${id}`)}>
            {t('unitDetail.createLabel')}
          </Button>
          {canManage &&
            (unit.isArchived ? (
              <Button icon={<RollbackOutlined />} onClick={() => unitApi.restore(id).then(refresh).catch(showError)}>
                {t('unitDetail.restore')}
              </Button>
            ) : (
              <Popconfirm title={t('unitDetail.archiveConfirm')} onConfirm={() => unitApi.archive(id).then(refresh).catch(showError)}>
                <Button icon={<InboxOutlined />}>{t('unitGrid.archive')}</Button>
              </Popconfirm>
            ))}
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Flex gap={16} wrap align="start">
          <Space direction="vertical" align="center">
            <AuthImage attachmentId={unit.imageAttachmentId} size={140} />
            {canManage && (
              <Space size={4}>
                <Upload accept="image/*" showUploadList={false} beforeUpload={(f) => (setImage(f), false)}>
                  <Button size="small" icon={<UploadOutlined />}>
                    {t('unitDetail.uploadImage')}
                  </Button>
                </Upload>
                {unit.imageAttachmentId && (
                  <Button size="small" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} onClick={() => unitApi.removeImage(id).then(refresh).catch(showError)} />
                )}
              </Space>
            )}
          </Space>
          <Descriptions size="small" column={{ xs: 1, md: 2 }} style={{ flex: 1, minWidth: 260 }}>
            <Descriptions.Item label={t('labels.equipment')}>
              <Link to={`/equipment/${unit.equipmentId}`}>
                {unit.equipmentCode} · {unit.equipmentName}
              </Link>
            </Descriptions.Item>
            <Descriptions.Item label={`${t('equipment.brand')} / ${t('equipment.model')}`}>
              {[unit.equipmentBrand, unit.equipmentModel].filter(Boolean).join(' / ') || '—'}
            </Descriptions.Item>
            <Descriptions.Item label={t('units.serialNumber')}>{unit.serialNumber ?? '—'}</Descriptions.Item>
            <Descriptions.Item label={t('units.location')}>{unit.stockLocationName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label={t('units.currentProject')}>
              {unit.currentProjectId ? (
                <Link to={`/projects/${unit.currentProjectId}`}>
                  {unit.currentProjectNumber} · {unit.currentProjectName}
                </Link>
              ) : (
                '—'
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('unitDetail.nextInspection')}>
              {unit.nextInspectionDate ? (
                <Typography.Text type={isInspectionOverdue(unit) ? 'danger' : undefined}>{formatDate(unit.nextInspectionDate)}</Typography.Text>
              ) : (
                '—'
              )}
            </Descriptions.Item>
          </Descriptions>
        </Flex>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card size="small">
            <Tabs
              items={[
                { key: 'details', label: t('unitDetail.tabDetails'), children: <DetailsTab unit={unit} canManage={canManage && !unit.isArchived} onSaved={refresh} /> },
                { key: 'repairs', label: t('unitDetail.tabRepairs'), children: <RepairsTab unit={unit} onChanged={refresh} /> },
                { key: 'history', label: t('unitDetail.tabHistory'), children: <HistoryTab unitId={id} /> },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card size="small">
            <CollaborationPanel ownerType="Unit" ownerId={id} />
          </Card>
        </Col>
      </Row>
    </>
  );
}

function DetailsTab({ unit, canManage, onSaved }: { unit: EquipmentUnitDetail; canManage: boolean; onSaved: () => void }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const showError = useErrorToast();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      internalRef: unit.internalRef,
      serialNumber: unit.serialNumber,
      stockLocationId: unit.stockLocationId,
      purchaseDate: unit.purchaseDate ? dayjs(unit.purchaseDate) : null,
      warrantyDate: unit.warrantyDate ? dayjs(unit.warrantyDate) : null,
      replacementDate: unit.replacementDate ? dayjs(unit.replacementDate) : null,
      supplierId: unit.supplierId,
      notes: unit.notes ?? '',
    });
  }, [unit, form]);

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await unitApi.update(unit.id, {
        internalRef: v.internalRef.trim(),
        serialNumber: v.serialNumber?.trim() || null,
        stockLocationId: v.stockLocationId ?? null,
        purchaseDate: toApiDate(v.purchaseDate),
        warrantyDate: toApiDate(v.warrantyDate),
        replacementDate: toApiDate(v.replacementDate),
        supplierId: v.supplierId ?? null,
        notes: v.notes || null,
      });
      message.success(t('common.saved'));
      onSaved();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Row gutter={[24, 16]}>
      <Col xs={24} lg={14}>
        <Form form={form} layout="vertical" disabled={!canManage}>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="internalRef" label={t('units.internalRef')} rules={[{ required: true, whitespace: true, message: t('validation.required') }]}>
                <Input maxLength={64} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="serialNumber" label={t('units.serialNumber')}>
                <Input maxLength={128} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="stockLocationId" label={t('units.location')}>
                <StockLocationSelect />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="supplierId" label={t('unitDetail.supplier')}>
                <SupplierSelect currentName={unit.supplierName} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="purchaseDate" label={t('unitDetail.purchaseDate')}>
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="warrantyDate" label={t('unitDetail.warrantyDate')}>
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="replacementDate" label={t('unitDetail.replacementDate')}>
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label={t('unitDetail.inspection')}>
            <Typography.Text type="secondary">
              {unit.inspectionIntervalMonths
                ? t('unitDetail.inspectionInfo', {
                    months: unit.inspectionIntervalMonths,
                    last: formatDate(unit.lastInspectionDate),
                    next: formatDate(unit.nextInspectionDate),
                  })
                : t('unitDetail.noInspection')}
            </Typography.Text>
          </Form.Item>
          <Form.Item name="notes" label={t('unitDetail.remark')}>
            {canManage ? <RichTextEditor /> : <RichTextView html={unit.notes} />}
          </Form.Item>
          {canManage && (
            <Button type="primary" loading={saving} onClick={save}>
              {t('common.save')}
            </Button>
          )}
        </Form>
      </Col>
      <Col xs={24} lg={10}>
        <LabelsBox unit={unit} onChanged={onSaved} />
      </Col>
    </Row>
  );
}

/** Labels of the device: create/print a new one, or scan an existing (e.g. Rentman) label to link it. */
function LabelsBox({ unit, onChanged }: { unit: EquipmentUnitDetail; onChanged: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { can } = useAuth();
  const showError = useErrorToast();
  const canAssign = can(Permissions.LabelsAssign) && !unit.isArchived;
  const [scanOpen, setScanOpen] = useState(false);
  const [type, setType] = useState<LabelType>('RentmanQr');
  const [problem, setProblem] = useState<string | null>(null);

  const link = async (raw: string) => {
    setProblem(null);
    try {
      const resolved = await labelApi.resolve(raw);
      if (resolved.found) {
        if (resolved.label?.unitId === unit.id) setProblem(t('unitDetail.labelAlreadyHere', { code: resolved.code }));
        else
          setProblem(
            t('unitDetail.labelInUse', {
              code: resolved.code,
              target: resolved.unit ? `${resolved.unit.equipmentName} · ${resolved.unit.internalRef}` : resolved.equipment?.name ?? '',
            }),
          );
        return;
      }
      const label = await labelApi.assign({ code: raw, type, unitId: unit.id });
      message.success(t('labels.assigned', { code: label.code }));
      setScanOpen(false);
      onChanged();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <Card
      size="small"
      type="inner"
      title={t('units.labels')}
      extra={
        <Space size={4}>
          <Button size="small" icon={<PrinterOutlined />} onClick={() => navigate(`/labels/print?units=${unit.id}`)}>
            {t('unitDetail.createLabel')}
          </Button>
          {canAssign && (
            <Button size="small" icon={<ScanOutlined />} onClick={() => setScanOpen(true)}>
              {t('unitDetail.scanLabel')}
            </Button>
          )}
        </Space>
      }
    >
      {unit.labels.length === 0 ? (
        <Typography.Text type="secondary">{t('labels.none')}</Typography.Text>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          {unit.labels.map((l) => (
            <Flex key={l.id} gap={8} align="start" justify="space-between">
              <div style={{ minWidth: 0 }}>
                <Space size={4}>
                  <Tag>{t(`enums.labelType.${l.type}`)}</Tag>
                  <Typography.Text strong copyable>
                    {l.code}
                  </Typography.Text>
                </Space>
                <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }} ellipsis={{ tooltip: l.rawValue }}>
                  {l.rawValue}
                </Typography.Text>
              </div>
              {canAssign && (
                <Popconfirm title={t('unitDetail.removeLabelConfirm')} onConfirm={() => labelApi.remove(l.id).then(onChanged).catch(showError)}>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} />
                </Popconfirm>
              )}
            </Flex>
          ))}
        </Space>
      )}
      <Modal open={scanOpen} title={t('unitDetail.scanTitle', { ref: unit.internalRef })} footer={null} onCancel={() => setScanOpen(false)} destroyOnHidden>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            {t('labels.addHint')}
          </Typography.Paragraph>
          <Select value={type} onChange={setType} style={{ width: 200 }} options={LABEL_TYPES.map((v) => ({ value: v, label: t(`enums.labelType.${v}`) }))} />
          <ScanInput autoFocus onScan={link} />
          {problem && <Alert type="warning" showIcon message={problem} />}
        </Space>
      </Modal>
    </Card>
  );
}

function RepairsTab({ unit, onChanged }: { unit: EquipmentUnitDetail; onChanged: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { can, company } = useAuth();
  const showError = useErrorToast();
  const f = useFormat();
  const canManage = can(Permissions.MaintenanceManage);
  const canView = can(Permissions.Maintenance);
  const [repairOpen, setRepairOpen] = useState(false);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [repairForm] = Form.useForm();
  const [inspectionForm] = Form.useForm();

  const repairs = useQuery({ queryKey: ['repairs', 'unit', unit.id], queryFn: () => repairApi.list({ unitId: unit.id, maxResultCount: 200 }), enabled: canView });
  const inspections = useQuery({ queryKey: ['inspections', 'unit', unit.id], queryFn: () => inspectionApi.list({ unitId: unit.id }), enabled: canView });

  if (!canView) return <Alert type="info" showIcon message={t('errors.Common.Forbidden')} />;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['repairs'] });
    qc.invalidateQueries({ queryKey: ['inspections', 'unit', unit.id] });
    onChanged();
  };

  const changeStatus = (r: Repair, status: RepairStatus) => repairApi.changeStatus(r.id, status).then(refresh).catch(showError);

  const createRepair = async () => {
    const v = await repairForm.validateFields();
    try {
      await repairApi.create({
        equipmentId: unit.equipmentId,
        unitId: unit.id,
        quantity: 1,
        title: v.title.trim(),
        description: v.description || null,
        supplierId: v.supplierId ?? null,
        cost: v.cost ?? null,
      });
      setRepairOpen(false);
      repairForm.resetFields();
      refresh();
    } catch (e) {
      showError(e);
    }
  };

  const recordInspection = async () => {
    const v = await inspectionForm.validateFields();
    try {
      await inspectionApi.record({ unitId: unit.id, date: toApiDate(v.date)!, passed: v.passed, notes: v.notes || null });
      setInspectionOpen(false);
      inspectionForm.resetFields();
      refresh();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {t('unitDetail.repairs')}
          </Typography.Title>
          {canManage && !unit.isArchived && (
            <Button size="small" icon={<PlusOutlined />} onClick={() => setRepairOpen(true)}>
              {t('unitDetail.newRepair')}
            </Button>
          )}
        </Flex>
        <Table
          size="small"
          rowKey="id"
          loading={repairs.isFetching}
          dataSource={repairs.data?.items}
          pagination={false}
          scroll={{ x: 700 }}
          columns={[
            { title: '#', dataIndex: 'number', width: 60 },
            {
              title: t('unitDetail.repairTitle'),
              dataIndex: 'title',
              render: (v, r) => (
                <>
                  {v}
                  {r.description && (
                    <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      {r.description}
                    </Typography.Text>
                  )}
                </>
              ),
            },
            { title: t('unitDetail.reportedAt'), dataIndex: 'reportedAt', width: 110, render: (v) => formatDate(v) },
            { title: t('unitDetail.completedAt'), dataIndex: 'completedAt', width: 110, render: (v) => formatDate(v) },
            { title: t('unitDetail.supplier'), dataIndex: 'supplierName', width: 140, render: (v) => v ?? '—' },
            {
              title: t('unitDetail.cost'),
              dataIndex: 'cost',
              width: 110,
              align: 'end' as const,
              render: (v) => (v == null ? '—' : f.money(v, company?.defaultCurrency ?? 'TRY')),
            },
            {
              title: t('units.status'),
              dataIndex: 'status',
              width: 140,
              render: (s: RepairStatus, r) =>
                canManage && r.allowedStatuses.length > 0 ? (
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: r.allowedStatuses.map((x) => ({ key: x, label: t(`enums.repairStatus.${x}`) })),
                      onClick: (e) => changeStatus(r, e.key as RepairStatus),
                    }}
                  >
                    <a onClick={(e) => e.preventDefault()}>
                      <RepairStatusTag status={s} />
                    </a>
                  </Dropdown>
                ) : (
                  <RepairStatusTag status={s} />
                ),
            },
          ]}
        />
      </div>

      <div>
        <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {t('unitDetail.inspections')}
          </Typography.Title>
          {canManage && unit.inspectionIntervalMonths && !unit.isArchived && (
            <Button size="small" icon={<PlusOutlined />} onClick={() => setInspectionOpen(true)}>
              {t('unitDetail.recordInspection')}
            </Button>
          )}
        </Flex>
        {!unit.inspectionIntervalMonths && <Typography.Text type="secondary">{t('unitDetail.noInspection')}</Typography.Text>}
        <Table
          size="small"
          rowKey="id"
          loading={inspections.isFetching}
          dataSource={inspections.data}
          pagination={false}
          columns={[
            { title: t('unitDetail.inspectionDate'), dataIndex: 'date', width: 120, render: (v) => formatDate(v) },
            {
              title: t('unitDetail.result'),
              dataIndex: 'passed',
              width: 110,
              render: (v) => (v ? <Tag color="green">{t('unitDetail.passed')}</Tag> : <Tag color="red">{t('unitDetail.failed')}</Tag>),
            },
            { title: t('unitDetail.inspector'), dataIndex: 'inspectorName', width: 160, render: (v) => v ?? '—' },
            { title: t('common.notes'), dataIndex: 'notes', render: (v) => v ?? '' },
          ]}
        />
      </div>

      <Modal open={repairOpen} title={t('unitDetail.newRepair')} onCancel={() => setRepairOpen(false)} onOk={createRepair} okText={t('common.save')} cancelText={t('common.cancel')} destroyOnHidden>
        <Form form={repairForm} layout="vertical" preserve={false}>
          <Form.Item name="title" label={t('unitDetail.repairTitle')} rules={[{ required: true, whitespace: true, message: t('validation.required') }]}>
            <Input maxLength={256} />
          </Form.Item>
          <Form.Item name="description" label={t('unitDetail.repairDescription')}>
            <Input.TextArea autoSize={{ minRows: 2 }} maxLength={4000} />
          </Form.Item>
          <Flex gap={12}>
            <Form.Item name="supplierId" label={t('unitDetail.supplier')} style={{ flex: 1 }}>
              <SupplierSelect />
            </Form.Item>
            <Form.Item name="cost" label={t('unitDetail.cost')} style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Flex>
          <Typography.Text type="secondary">{t('unitDetail.repairHint')}</Typography.Text>
        </Form>
      </Modal>

      <Modal
        open={inspectionOpen}
        title={t('unitDetail.recordInspection')}
        onCancel={() => setInspectionOpen(false)}
        onOk={recordInspection}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        destroyOnHidden
      >
        <Form form={inspectionForm} layout="vertical" preserve={false} initialValues={{ date: dayjs(), passed: true }}>
          <Form.Item name="date" label={t('unitDetail.inspectionDate')} rules={[{ required: true, message: t('validation.required') }]}>
            <DatePicker format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item name="passed" label={t('unitDetail.result')}>
            <Radio.Group>
              <Radio value={true}>{t('unitDetail.passed')}</Radio>
              <Radio value={false}>{t('unitDetail.failed')}</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="notes" label={t('common.notes')}>
            <Input.TextArea autoSize={{ minRows: 2 }} maxLength={2000} />
          </Form.Item>
          <Typography.Text type="secondary">{t('unitDetail.failedHint')}</Typography.Text>
        </Form>
      </Modal>
    </Space>
  );
}

const HISTORY_PAGE = 25;

function HistoryTab({ unitId }: { unitId: string }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isFetching } = useQuery({
    queryKey: ['movements', 'unit', unitId, page],
    queryFn: () => warehouseApi.movements({ unitId, skipCount: (page - 1) * HISTORY_PAGE, maxResultCount: HISTORY_PAGE }),
    placeholderData: keepPreviousData,
  });

  return (
    <Table
      size="small"
      rowKey="id"
      loading={isFetching}
      dataSource={data?.items}
      scroll={{ x: 700 }}
      pagination={{ current: page, pageSize: HISTORY_PAGE, total: data?.totalCount, onChange: setPage, showSizeChanger: false }}
      columns={[
        { title: t('movements.time'), dataIndex: 'creationTime', width: 140, render: (v) => formatDateTime(v) },
        { title: t('movements.action'), dataIndex: 'action', width: 140, render: (a) => <Tag>{t(`enums.movementAction.${a}`)}</Tag> },
        {
          title: t('movements.project'),
          width: 200,
          ellipsis: true,
          render: (_, m) => (m.projectId ? <Link to={`/projects/${m.projectId}`}>{m.projectNumber} · {m.projectName}</Link> : '—'),
        },
        { title: t('movements.user'), dataIndex: 'userFullName', width: 140, render: (v) => v ?? t('movements.system') },
        { title: t('movements.label'), dataIndex: 'labelCode', width: 130, render: (v) => v ?? '' },
        { title: t('unitDetail.note'), dataIndex: 'note', render: (v) => v ?? '' },
      ]}
    />
  );
}
