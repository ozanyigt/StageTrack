import { AutoComplete, ColorPicker, DatePicker, Form, Input, Modal, Select } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { crewApi, projectApi, quoteApi } from '../../api/endpoints';
import type { Project, ProjectInput, Quote } from '../../api/types';
import { CustomerSelect, StockLocationSelect } from '../../components/Selects';
import { useErrorToast } from '../../utils/errors';
import { toApiDateTime } from '../../utils/format';
import { useUnsavedChanges } from '../../components/UnsavedChanges';

/** Ready-made payment terms; the first one is the default for new jobs. */
export const PAYMENT_TERM_KEYS = ['afterJob', 'cash', 'halfAdvance', 'net30'] as const;

interface FormValues {
  name: string;
  customerId?: string;
  venue?: string;
  plan: [Dayjs, Dayjs];
  use?: [Dayjs, Dayjs] | null;
  color: string | { toHexString: () => string };
  projectType?: string;
  stockLocationId?: string;
  notes?: string;
  accountManagerId?: string | null;
  paymentTerms?: string;
}

interface Props {
  open: boolean;
  project?: Project | null;
  onClose: () => void;
  onSaved?: (project: Project) => void;
  /** Sales list: create a new job (pending project + first draft quote) instead of a plain project. */
  onJobCreated?: (quote: Quote) => void;
}

export function ProjectFormModal({ open, project, onClose, onSaved, onJobCreated }: Props) {
  const jobMode = !project && !!onJobCreated;
  const { t } = useTranslation();
  const [form] = Form.useForm<FormValues>();
  const showError = useErrorToast();
  const directory = useQuery({ queryKey: ['crew-directory'], queryFn: crewApi.directory, enabled: open });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (project) {
      form.setFieldsValue({
        name: project.name,
        customerId: project.customerId ?? undefined,
        venue: project.venue ?? undefined,
        plan: [dayjs(project.planStart), dayjs(project.planEnd)],
        use: project.useStart && project.useEnd ? [dayjs(project.useStart), dayjs(project.useEnd)] : undefined,
        color: project.color,
        projectType: project.projectType ?? undefined,
        stockLocationId: project.stockLocationId ?? undefined,
        notes: project.notes ?? undefined,
        accountManagerId: project.accountManagerId ?? null,
        paymentTerms: project.paymentTerms ?? undefined,
      });
    } else {
      const start = dayjs().add(1, 'day').hour(8).minute(0);
      form.setFieldsValue({
        plan: [start, start.add(2, 'day').hour(23)],
        color: '#22c55e',
        projectType: 'PRODÜKSİYON',
        paymentTerms: t(`paymentTerms.${PAYMENT_TERM_KEYS[0]}`),
      });
    }
    setDirty(false);
  }, [open, project, form, t]);

  const save = useMutation({
    mutationFn: (v: FormValues): Promise<Project | Quote> => {
      const input: ProjectInput = {
        name: v.name,
        customerId: v.customerId ?? null,
        venue: v.venue ?? null,
        planStart: toApiDateTime(v.plan[0])!,
        planEnd: toApiDateTime(v.plan[1])!,
        useStart: toApiDateTime(v.use?.[0]),
        useEnd: toApiDateTime(v.use?.[1]),
        color: typeof v.color === 'string' ? v.color : v.color.toHexString(),
        projectType: v.projectType ?? null,
        stockLocationId: v.stockLocationId ?? null,
        notes: v.notes ?? null,
        accountManagerId: v.accountManagerId ?? null,
        paymentTerms: v.paymentTerms?.trim() || null,
      };
      if (jobMode) return quoteApi.createJob(input);
      return project ? projectApi.update(project.id, input) : projectApi.create(input);
    },
    onSuccess: (result) => {
      setDirty(false);
      if (jobMode) onJobCreated?.(result as Quote);
      else onSaved?.(result as Project);
    },
    onError: showError,
  });

  const { confirmLeave } = useUnsavedChanges(open && dirty, () => form.validateFields().then((v) => save.mutateAsync(v)));
  const close = async () => {
    if (await confirmLeave()) {
      setDirty(false);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      title={project ? t('projects.editTitle') : jobMode ? t('salesJobs.createTitle') : t('projects.createTitle')}
      onCancel={close}
      onOk={() => form.submit()}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={save.isPending}
      width={640}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} onValuesChange={() => setDirty(true)}>
        <Form.Item name="name" label={t('projects.name')} rules={[{ required: true, message: t('validation.required') }]}>
          <Input autoFocus />
        </Form.Item>
        <Form.Item name="customerId" label={t('projects.customer')}>
          <CustomerSelect />
        </Form.Item>
        <Form.Item name="venue" label={t('projects.venue')}>
          <Input />
        </Form.Item>
        <Form.Item name="plan" label={t('projects.planPeriod')} extra={t('projects.planPeriodHint')} rules={[{ required: true, message: t('validation.required') }]}>
          <DatePicker.RangePicker showTime={{ format: 'HH:mm' }} format="DD.MM.YYYY HH:mm" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="use" label={t('projects.usePeriod')} extra={t('projects.usePeriodHint')}>
          <DatePicker.RangePicker showTime={{ format: 'HH:mm' }} format="DD.MM.YYYY HH:mm" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="stockLocationId" label={t('projects.warehouse')}>
          <StockLocationSelect />
        </Form.Item>
        <Form.Item name="projectType" label={t('projects.type')}>
          <Input />
        </Form.Item>
        <Form.Item name="color" label={t('projects.color')}>
          <ColorPicker presets={[{ label: '', colors: ['#22c55e', '#f97316', '#7c3aed', '#1677ff', '#ef4444', '#eab308'] }]} />
        </Form.Item>
        <Form.Item name="accountManagerId" label={t('projectExtra.accountManager')}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            options={(directory.data ?? []).map((u) => ({ value: u.userId, label: u.jobTitle ? `${u.fullName} · ${u.jobTitle}` : u.fullName }))}
          />
        </Form.Item>
        <Form.Item name="paymentTerms" label={t('projectExtra.paymentTerms')}>
          <AutoComplete
            maxLength={256}
            placeholder={t('projectExtra.paymentTermsPlaceholder')}
            options={PAYMENT_TERM_KEYS.map((k) => ({ value: t(`paymentTerms.${k}`) }))}
            filterOption={false}
          />
        </Form.Item>
        <Form.Item name="notes" label={t('common.notes')}>
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
