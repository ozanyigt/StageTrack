import {
  ArrowLeftOutlined, CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined, PrinterOutlined, ToolOutlined,
  UndoOutlined, EnterOutlined,
} from '@ant-design/icons';
import {
  Alert, App, Button, Card, Checkbox, Col, DatePicker, Descriptions, Divider, Flex, Form, Input, InputNumber, Modal, Row, Select, Skeleton,
  Space, Table, Tag, Typography, AutoComplete, type TableColumnsType,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { quoteApi, rentalFactorApi } from '../../api/endpoints';
import { QUOTE_LINE_TYPES, type Quote, type QuoteLine, type QuoteLineInput } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { EquipmentSelect } from '../../components/Selects';
import { QuoteStatusTag } from '../../components/StatusTags';
import { useLabelGenerator } from '../../components/LabelGenerator';
import { useUnsavedChanges } from '../../components/UnsavedChanges';
import { QuoteStatusControl } from './QuoteStatusControl';
import { useErrorToast } from '../../utils/errors';
import { toApiDate, useFormat } from '../../utils/format';

interface HeaderForm {
  issueDate: Dayjs;
  validUntil?: Dayjs | null;
  rentalDays: number;
  rentalFactorProfileId?: string | null;
  manualFactor?: number | null;
  discountPercent: number;
  vatRate: number;
  notes?: string | null;
}

/** Lines grouped under their section, in the order sections first appear; lines without a section come first. */
function groupBySection(lines: QuoteLine[]) {
  const sorted = [...lines].sort((a, b) => a.sortOrder - b.sortOrder);
  const groups: { name: string | null; lines: QuoteLine[] }[] = [];
  const none = sorted.filter((l) => !l.section);
  if (none.length) groups.push({ name: null, lines: none });
  sorted.filter((l) => l.section).forEach((l) => {
    const g = groups.find((x) => x.name === l.section);
    if (g) g.lines.push(l);
    else groups.push({ name: l.section!, lines: [l] });
  });
  return groups;
}

export function QuoteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { modal, message } = App.useApp();
  const f = useFormat();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const [headerForm] = Form.useForm<HeaderForm>();
  const [lineForm] = Form.useForm<QuoteLineInput>();
  const [lineModal, setLineModal] = useState<{ line?: QuoteLine; equipment?: boolean } | null>(null);
  const { openPage } = useLabelGenerator();
  const [headerDirty, setHeaderDirty] = useState(false);
  const [lineDirty, setLineDirty] = useState(false);

  const quote = useQuery({ queryKey: ['quote', id], queryFn: () => quoteApi.get(id!) });
  const profiles = useQuery({ queryKey: ['rental-factors'], queryFn: rentalFactorApi.list });
  const q = quote.data;
  const editable = !!q?.isEditable && can(Permissions.QuotesManage);

  useEffect(() => {
    if (!q) return;
    headerForm.setFieldsValue({
      issueDate: dayjs(q.issueDate),
      validUntil: q.validUntil ? dayjs(q.validUntil) : null,
      rentalDays: q.rentalDays,
      rentalFactorProfileId: q.rentalFactorProfileId ?? null,
      manualFactor: null,
      discountPercent: q.discountPercent,
      vatRate: q.vatRate,
      notes: q.notes,
    });
    setHeaderDirty(false);
  }, [q, headerForm]);

  const apply = (updated: Quote) => {
    queryClient.setQueryData(['quote', id], updated);
    queryClient.invalidateQueries({ queryKey: ['quotes'] });
    queryClient.invalidateQueries({ queryKey: ['quote-jobs'] });
    queryClient.invalidateQueries({ queryKey: ['project', updated.projectId] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  const saveHeader = useMutation({
    mutationFn: (v: HeaderForm) =>
      quoteApi.updateHeader(id!, {
        issueDate: toApiDate(v.issueDate)!,
        validUntil: toApiDate(v.validUntil),
        rentalDays: v.rentalDays,
        rentalFactorProfileId: v.rentalFactorProfileId ?? null,
        manualFactor: v.manualFactor || null,
        discountPercent: v.discountPercent ?? 0,
        vatRate: v.vatRate ?? 0,
        notes: v.notes ?? null,
      }),
    onSuccess: (u) => { apply(u); setHeaderDirty(false); message.success(t('quotes.recalculated')); },
    onError: showError,
  });

  const saveLine = useMutation({
    mutationFn: (v: QuoteLineInput) =>
      lineModal?.line ? quoteApi.updateLine(id!, lineModal.line.id, v) : quoteApi.addLine(id!, v),
    onSuccess: (u) => { apply(u); setLineDirty(false); setLineModal(null); },
    onError: showError,
  });

  const removeLine = useMutation({ mutationFn: (lineId: string) => quoteApi.removeLine(id!, lineId), onSuccess: apply, onError: showError });
  const reopen = useMutation({
    mutationFn: () => quoteApi.reopen(id!),
    onSuccess: (r) => { apply(r); message.success(t('salesJobs.reopened')); navigate(`/quotes/${r.id}`); },
    onError: showError,
  });
  const revise = useMutation({
    mutationFn: () => quoteApi.revise(id!),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['quotes'] }); navigate(`/quotes/${r.id}`); },
    onError: showError,
  });
  const remove = useMutation({
    mutationFn: () => quoteApi.remove(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote-jobs'] });
      navigate('/quotes');
    },
    onError: showError,
  });

  const openLine = (line?: QuoteLine, equipment = false) => {
    lineForm.resetFields();
    lineForm.setFieldsValue(
      line
        ? { ...line }
        : equipment
          ? { type: 'Equipment', quantity: 1, applyFactor: true, discountPercent: 0 }
          : { type: 'Crew', quantity: 1, unitPrice: 0, applyFactor: true, discountPercent: 0 },
    );
    setLineDirty(false);
    setLineModal({ line, equipment });
  };

  const { confirmLeave: confirmHeaderLeave } = useUnsavedChanges(headerDirty, () => headerForm.validateFields().then((v) => saveHeader.mutateAsync(v)));
  const { confirmLeave: confirmLineLeave } = useUnsavedChanges(!!lineModal && lineDirty, () => lineForm.validateFields().then((v) => saveLine.mutateAsync(v)));
  void confirmHeaderLeave;
  const closeLineModal = async () => {
    if (await confirmLineLeave()) {
      setLineDirty(false);
      setLineModal(null);
    }
  };

  if (quote.isLoading || !q) return <Skeleton active />;
  const money = (v: number) => f.money(v, q.currency);
  const groups = groupBySection(q.lines);
  const lineColumns: TableColumnsType<QuoteLine> = [
                { title: t('quotes.lineType'), dataIndex: 'type', width: 110, render: (v) => <Tag>{t(`enums.quoteLineType.${v}`)}</Tag> },
                {
                  title: t('quotes.description'),
                  render: (_, l) => (
                    <div style={l.isContent ? { paddingInlineStart: 20, color: 'var(--ant-color-text-secondary, #888)' } : undefined}>
                      {l.isContent && <EnterOutlined style={{ transform: 'scaleX(-1)', marginInlineEnd: 6, fontSize: 11 }} />}
                      {l.equipmentCode ? `${l.equipmentCode} · ${l.description}` : l.description}
                      {l.isContent && <Tag bordered={false} style={{ marginInlineStart: 6, fontSize: 11 }}>{t('quoteContent.inCase')}</Tag>}
                      {l.notes && <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, whiteSpace: 'pre-wrap' }}>{l.notes}</Typography.Text>}
                    </div>
                  ),
                },
                { title: t('quotes.quantity'), dataIndex: 'quantity', width: 70, align: 'end', render: (v) => f.number(v) },
                { title: t('quotes.unitPrice'), dataIndex: 'unitPrice', width: 120, align: 'end', render: (v, l) => (l.isContent ? '' : money(v)) },
                {
                  title: t('quotes.factor'), dataIndex: 'applyFactor', width: 80, align: 'center',
                  render: (v: boolean, l) => (l.isContent ? '' : v ? <Tag color="orange">×{f.number(q.factor)}</Tag> : '—'),
                },
                { title: t('quotes.discount'), dataIndex: 'discountPercent', width: 80, align: 'end', render: (v, l) => (l.isContent ? '' : v ? `%${f.number(v)}` : '—') },
                { title: t('quotes.total'), dataIndex: 'total', width: 130, align: 'end', render: (v, l) => (l.isContent ? '' : money(v)) },
                {
                  title: '', width: 80,
                  render: (_, l) => editable && !l.isContent && (
                    <Space size={2}>
                      <Button size="small" type="text" icon={<EditOutlined />} aria-label={t('common.edit')} onClick={() => openLine(l)} />
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} onClick={() => removeLine.mutate(l.id)} />
                    </Space>
                  ),
                },
              ];

  return (
    <>
      <div className="page-header">
        <Space align="center" wrap>
          <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate(`/quotes/jobs/${q.projectId}`)} aria-label={t('common.back')} />
          <Typography.Title level={3}>{q.number} / R{q.revision}</Typography.Title>
          {can(Permissions.QuotesManage) ? (
            <QuoteStatusControl quoteId={q.id} status={q.status} allowedStatuses={q.allowedStatuses} onChanged={apply} />
          ) : (
            <QuoteStatusTag status={q.status} />
          )}
        </Space>
        <Space wrap>
          {can(Permissions.QuotesManage) && q.status === 'Sent' && (
            <Button icon={<CopyOutlined />} loading={revise.isPending} onClick={() => revise.mutate()}>{t('quotes.revise')}</Button>
          )}
          {can(Permissions.QuotesManage) && q.status === 'Rejected' && q.isLatestRevision && (
            <Button icon={<UndoOutlined />} loading={reopen.isPending} onClick={() => reopen.mutate()}>{t('salesJobs.reopen')}</Button>
          )}
          <Button icon={<PrinterOutlined />} onClick={() => openPage(`${q.number} / R${q.revision}`, `/quotes/${q.id}/print`)}>{t('quotes.print')}</Button>
          {editable && (
            <Button danger icon={<DeleteOutlined />} aria-label={t('common.delete')}
              onClick={() => modal.confirm({ title: t('quotes.deleteConfirm'), onOk: () => remove.mutateAsync() })} />
          )}
        </Space>
      </div>

      {q.status === 'Rejected' && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message={t('salesJobs.rejectedBanner')}
          description={q.rejectionReason ? t('salesJobs.reasonLabel', { reason: q.rejectionReason }) : undefined}
        />
      )}
      {q.status === 'Accepted' && (
        <Alert type="success" showIcon style={{ marginBottom: 12 }} message={t('salesJobs.acceptedBanner')}
          action={<Button size="small" onClick={() => navigate(`/projects/${q.projectId}`)}>{t('salesJobs.openProject')}</Button>} />
      )}
      <Row gutter={[12, 12]}>
        <Col xs={24} xl={16}>
          <Card size="small">
            <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label={t('quotes.project')}><Link to={`/projects/${q.projectId}`}>{q.projectNumber} · {q.projectName}</Link></Descriptions.Item>
              <Descriptions.Item label={t('quotes.customer')}>{q.customer?.name ?? '—'}</Descriptions.Item>
              <Descriptions.Item label={t('projects.venue')}>{q.venue ?? '—'}</Descriptions.Item>
              <Descriptions.Item label={t('projects.usePeriod')}>{f.period(q.useStart, q.useEnd)}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            size="small"
            style={{ marginTop: 12 }}
            title={t('quotes.lines')}
            extra={editable && (
              <Space>
                <Button size="small" icon={<ToolOutlined />} onClick={() => openLine(undefined, true)}>{t('quotes.addEquipment')}</Button>
                <Button size="small" icon={<PlusOutlined />} onClick={() => openLine()}>{t('quotes.addService')}</Button>
              </Space>
            )}
          >
            {groups.length === 0 ? (
              <Table size="small" rowKey="id" pagination={false} dataSource={[]} columns={lineColumns} />
            ) : (
              groups.map((g) => (
                <div key={g.name ?? '__none__'} style={{ marginBottom: 8 }}>
                  {(g.name || groups.length > 1) && (
                    <Typography.Text strong style={{ display: 'block', padding: '6px 8px', background: 'rgba(99,102,241,0.08)', borderRadius: 4 }}>
                      {g.name ?? t('sections.none')}
                    </Typography.Text>
                  )}
                  <Table size="small" rowKey="id" pagination={false} dataSource={g.lines} scroll={{ x: 820 }} columns={lineColumns} />
                </div>
              ))
            )}
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card size="small" title={t('quotes.pricing')}>
            <Form form={headerForm} layout="vertical" disabled={!editable} onFinish={(v) => saveHeader.mutate(v)} onValuesChange={() => setHeaderDirty(true)}>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item name="issueDate" label={t('quotes.issueDate')} rules={[{ required: true, message: t('validation.required') }]}>
                    <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="validUntil" label={t('quotes.validUntil')}>
                    <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="rentalDays" label={t('quotes.rentalDays')} rules={[{ required: true, message: t('validation.required') }]}>
                    <InputNumber min={1} max={365} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="rentalFactorProfileId" label={t('quotes.profile')}>
                    <Select allowClear placeholder={t('quotes.defaultProfile')}
                      options={(profiles.data ?? []).map((p) => ({ value: p.id, label: p.name }))} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="manualFactor" label={t('quotes.manualFactor')} tooltip={t('quotes.manualFactorHint')}>
                    <InputNumber min={0.01} step={0.25} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={t('quotes.currentFactor')}>
                    <Tag color="orange" style={{ fontSize: 14, padding: '4px 10px' }}>
                      {t('quotes.factorSummary', { days: q.rentalDays, factor: f.number(q.factor, 4) })}
                    </Tag>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="discountPercent" label={t('quotes.discountPercent')}>
                    <InputNumber min={0} max={100} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="vatRate" label={t('quotes.vatRate')}>
                    <InputNumber min={0} max={100} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="notes" label={t('common.notes')}>
                <Input.TextArea rows={3} />
              </Form.Item>
              {editable && (
                <Button type="primary" block htmlType="submit" loading={saveHeader.isPending}>{t('quotes.saveAndRecalculate')}</Button>
              )}
            </Form>
            <Divider />
            <Flex vertical gap={6}>
              <Flex justify="space-between"><span>{t('quotes.subtotal')}</span><span>{money(q.subtotal)}</span></Flex>
              <Flex justify="space-between"><span>{t('quotes.discountAmount', { percent: f.number(q.discountPercent) })}</span><span>− {money(q.discountAmount)}</span></Flex>
              <Flex justify="space-between"><span>{t('quotes.netTotal')}</span><span>{money(q.netTotal)}</span></Flex>
              <Flex justify="space-between"><span>{t('quotes.vatAmount', { rate: f.number(q.vatRate) })}</span><span>{money(q.vatAmount)}</span></Flex>
              <Flex justify="space-between" style={{ fontSize: 18, fontWeight: 600 }}><span>{t('quotes.grandTotal')}</span><span>{money(q.grandTotal)}</span></Flex>
            </Flex>
          </Card>
        </Col>
      </Row>

      <Modal
        open={!!lineModal}
        title={lineModal?.line ? t('quotes.editLine') : lineModal?.equipment ? t('quotes.addEquipment') : t('quotes.addService')}
        onCancel={closeLineModal}
        onOk={() => lineForm.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saveLine.isPending}
        destroyOnHidden
      >
        <Form form={lineForm} layout="vertical" onFinish={(v) => saveLine.mutate(v)} onValuesChange={() => setLineDirty(true)}>
          {lineModal?.equipment && !lineModal.line ? (
            <Form.Item name="equipmentId" label={t('quotes.equipment')} rules={[{ required: true, message: t('validation.required') }]} extra={t('quotes.equipmentPriceHint')}>
              <EquipmentSelect forQuote />
            </Form.Item>
          ) : (
            <>
              <Form.Item name="type" label={t('quotes.lineType')}>
                <Select disabled={lineModal?.line?.type === 'Equipment'}
                  options={QUOTE_LINE_TYPES.filter((v) => v !== 'Equipment' || lineModal?.line?.type === 'Equipment').map((v) => ({ value: v, label: t(`enums.quoteLineType.${v}`) }))} />
              </Form.Item>
              <Form.Item name="description" label={t('quotes.description')} rules={[{ required: true, message: t('validation.required') }]}>
                <Input />
              </Form.Item>
            </>
          )}
          <Row gutter={8}>
            <Col span={8}>
              <Form.Item name="quantity" label={t('quotes.quantity')} rules={[{ required: true, message: t('validation.required') }]}>
                <InputNumber min={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="unitPrice" label={t('quotes.unitPrice')} tooltip={lineModal?.equipment ? t('quotes.unitPriceOptional') : undefined}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="discountPercent" label={t('quotes.discount')}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="section" label={t('sections.section')} extra={t('quoteSections.sectionHint')}>
            <AutoComplete
              allowClear
              options={(q.sectionNames ?? []).map((s) => ({ value: s }))}
              filterOption={(input, option) => (option?.value ?? '').toLocaleLowerCase().includes(input.toLocaleLowerCase())}
            />
          </Form.Item>
          <Form.Item name="notes" label={t('quoteSections.lineNotes')}>
            <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} maxLength={1000} />
          </Form.Item>
          <Form.Item name="applyFactor" valuePropName="checked">
            <Checkbox>{t('quotes.applyFactor')}</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
