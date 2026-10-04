import {
  ArrowLeftOutlined, CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined, PrinterOutlined, ToolOutlined,
} from '@ant-design/icons';
import {
  App, Button, Card, Checkbox, Col, DatePicker, Descriptions, Divider, Flex, Form, Input, InputNumber, Modal, Row, Select, Skeleton,
  Space, Table, Tag, Typography,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { quoteApi, rentalFactorApi } from '../../api/endpoints';
import { QUOTE_LINE_TYPES, type Quote, type QuoteLine, type QuoteLineInput, type QuoteStatus } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { EquipmentSelect } from '../../components/Selects';
import { QuoteStatusTag } from '../../components/StatusTags';
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

const statusAction: Partial<Record<QuoteStatus, string>> = {
  Sent: 'quotes.markSent',
  Accepted: 'quotes.markAccepted',
  Rejected: 'quotes.markRejected',
  Draft: 'quotes.backToDraft',
};

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
  }, [q, headerForm]);

  const apply = (updated: Quote) => {
    queryClient.setQueryData(['quote', id], updated);
    queryClient.invalidateQueries({ queryKey: ['quotes'] });
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
    onSuccess: (u) => { apply(u); message.success(t('quotes.recalculated')); },
    onError: showError,
  });

  const saveLine = useMutation({
    mutationFn: (v: QuoteLineInput) =>
      lineModal?.line ? quoteApi.updateLine(id!, lineModal.line.id, v) : quoteApi.addLine(id!, v),
    onSuccess: (u) => { apply(u); setLineModal(null); },
    onError: showError,
  });

  const removeLine = useMutation({ mutationFn: (lineId: string) => quoteApi.removeLine(id!, lineId), onSuccess: apply, onError: showError });
  const changeStatus = useMutation({ mutationFn: (s: QuoteStatus) => quoteApi.changeStatus(id!, s), onSuccess: apply, onError: showError });
  const revise = useMutation({
    mutationFn: () => quoteApi.revise(id!),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['quotes'] }); navigate(`/quotes/${r.id}`); },
    onError: showError,
  });
  const remove = useMutation({
    mutationFn: () => quoteApi.remove(id!),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['quotes'] }); navigate('/quotes'); },
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
    setLineModal({ line, equipment });
  };

  if (quote.isLoading || !q) return <Skeleton active />;
  const money = (v: number) => f.money(v, q.currency);

  return (
    <>
      <div className="page-header">
        <Space align="center" wrap>
          <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate(-1)} aria-label={t('common.back')} />
          <Typography.Title level={3}>{q.number} / R{q.revision}</Typography.Title>
          <QuoteStatusTag status={q.status} />
        </Space>
        <Space wrap>
          {can(Permissions.QuotesManage) && q.allowedStatuses.map((s) => (
            <Button key={s} type={s === 'Accepted' ? 'primary' : 'default'} danger={s === 'Rejected'} loading={changeStatus.isPending}
              onClick={() => changeStatus.mutate(s)}>
              {t(statusAction[s] ?? `enums.quoteStatus.${s}`)}
            </Button>
          ))}
          {can(Permissions.QuotesManage) && (q.status === 'Sent' || q.status === 'Rejected') && (
            <Button icon={<CopyOutlined />} loading={revise.isPending} onClick={() => revise.mutate()}>{t('quotes.revise')}</Button>
          )}
          <Button icon={<PrinterOutlined />} onClick={() => window.open(`/quotes/${q.id}/print`, '_blank')}>{t('quotes.print')}</Button>
          {editable && (
            <Button danger icon={<DeleteOutlined />} aria-label={t('common.delete')}
              onClick={() => modal.confirm({ title: t('quotes.deleteConfirm'), onOk: () => remove.mutateAsync() })} />
          )}
        </Space>
      </div>

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
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={q.lines}
              scroll={{ x: 820 }}
              columns={[
                { title: t('quotes.lineType'), dataIndex: 'type', width: 110, render: (v) => <Tag>{t(`enums.quoteLineType.${v}`)}</Tag> },
                { title: t('quotes.description'), render: (_, l) => (l.equipmentCode ? `${l.equipmentCode} · ${l.description}` : l.description), ellipsis: true },
                { title: t('quotes.quantity'), dataIndex: 'quantity', width: 70, align: 'end', render: (v) => f.number(v) },
                { title: t('quotes.unitPrice'), dataIndex: 'unitPrice', width: 120, align: 'end', render: money },
                {
                  title: t('quotes.factor'), dataIndex: 'applyFactor', width: 80, align: 'center',
                  render: (v: boolean) => (v ? <Tag color="orange">×{f.number(q.factor)}</Tag> : '—'),
                },
                { title: t('quotes.discount'), dataIndex: 'discountPercent', width: 80, align: 'end', render: (v) => (v ? `%${f.number(v)}` : '—') },
                { title: t('quotes.total'), dataIndex: 'total', width: 130, align: 'end', render: money },
                {
                  title: '', width: 80,
                  render: (_, l) => editable && (
                    <Space size={2}>
                      <Button size="small" type="text" icon={<EditOutlined />} aria-label={t('common.edit')} onClick={() => openLine(l)} />
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} onClick={() => removeLine.mutate(l.id)} />
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card size="small" title={t('quotes.pricing')}>
            <Form form={headerForm} layout="vertical" disabled={!editable} onFinish={(v) => saveHeader.mutate(v)}>
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
        onCancel={() => setLineModal(null)}
        onOk={() => lineForm.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saveLine.isPending}
        destroyOnHidden
      >
        <Form form={lineForm} layout="vertical" onFinish={(v) => saveLine.mutate(v)}>
          {lineModal?.equipment && !lineModal.line ? (
            <Form.Item name="equipmentId" label={t('quotes.equipment')} rules={[{ required: true, message: t('validation.required') }]} extra={t('quotes.equipmentPriceHint')}>
              <EquipmentSelect />
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
          <Form.Item name="applyFactor" valuePropName="checked">
            <Checkbox>{t('quotes.applyFactor')}</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
