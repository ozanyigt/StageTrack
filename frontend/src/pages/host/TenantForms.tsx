import { AutoComplete, Col, DatePicker, Divider, Form, Input, InputNumber, Row, Select, Tag, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import type { Tenant, TenantInput, TenantLocationInput, TenantStatus } from '../../api/types';
import { LANGUAGES } from '../../i18n';

export interface TenantFormValues {
  name: string;
  code: string;
  contactName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  planName: string;
  period: [Dayjs, Dayjs | null];
  maxUsers?: number | null;
  maxLocations?: number | null;
}

const statusColor: Record<TenantStatus, string> = { Active: 'green', Suspended: 'red', Expired: 'volcano', NotStarted: 'blue' };

export function TenantStatusTag({ status }: { status: TenantStatus }) {
  const { t } = useTranslation();
  return <Tag color={statusColor[status]}>{t(`host.status.${status}`)}</Tag>;
}

export const tenantToForm = (x: Tenant): TenantFormValues => ({
  name: x.name,
  code: x.code,
  contactName: x.contactName ?? undefined,
  email: x.email ?? undefined,
  phone: x.phone ?? undefined,
  notes: x.notes ?? undefined,
  planName: x.planName,
  period: [dayjs(x.startDate), x.endDate ? dayjs(x.endDate) : null],
  maxUsers: x.maxUsers ?? null,
  maxLocations: x.maxLocations ?? null,
});

export const formToTenant = (v: TenantFormValues): TenantInput => ({
  name: v.name.trim(),
  code: v.code.trim().toUpperCase(),
  contactName: v.contactName?.trim() || null,
  email: v.email?.trim() || null,
  phone: v.phone?.trim() || null,
  notes: v.notes?.trim() || null,
  planName: v.planName.trim(),
  startDate: v.period[0].format('YYYY-MM-DD'),
  endDate: v.period[1] ? v.period[1].format('YYYY-MM-DD') : null,
  maxUsers: v.maxUsers || null,
  maxLocations: v.maxLocations || null,
});

/** Firm information and subscription (used by "new firm" and "edit firm"). */
export function TenantFields() {
  const { t } = useTranslation();
  const required = [{ required: true, whitespace: true, message: t('validation.required') }];
  return (
    <>
      <Row gutter={12}>
        <Col xs={24} md={16}>
          <Form.Item name="name" label={t('host.name')} rules={required}>
            <Input maxLength={128} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="code" label={t('host.code')} extra={t('host.codeHint')}
            rules={[...required, { pattern: /^[A-Za-z0-9_-]+$/, message: t('validation.invalid', { field: t('host.code') }) }]}>
            <Input maxLength={32} style={{ textTransform: 'uppercase' }} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="contactName" label={t('host.contactName')}>
            <Input maxLength={128} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="email" label={t('host.email')} rules={[{ type: 'email', message: t('validation.invalid', { field: t('host.email') }) }]}>
            <Input maxLength={256} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="phone" label={t('host.phone')}>
            <Input maxLength={32} />
          </Form.Item>
        </Col>
      </Row>
      <Divider orientation="left" plain style={{ marginTop: 0 }}>
        {t('host.subscription')}
      </Divider>
      <Row gutter={12}>
        <Col xs={24} md={8}>
          <Form.Item name="planName" label={t('host.plan')} rules={required}>
            <AutoComplete
              maxLength={64}
              options={(['starter', 'pro', 'enterprise'] as const).map((k) => ({ value: t(`host.plans.${k}`) }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={16}>
          <Form.Item name="period" label={t('host.period')} extra={t('host.endDateHint')} rules={[{ required: true, message: t('validation.required') }]}>
            <DatePicker.RangePicker format="DD.MM.YYYY" allowEmpty={[false, true]} style={{ width: '100%' }}
              placeholder={[t('host.startDate'), t('host.openEnded')]} />
          </Form.Item>
        </Col>
        <Col xs={12} md={8}>
          <Form.Item name="maxUsers" label={t('host.maxUsers')}>
            <InputNumber min={1} max={100000} style={{ width: '100%' }} placeholder={t('host.unlimited')} />
          </Form.Item>
        </Col>
        <Col xs={12} md={8}>
          <Form.Item name="maxLocations" label={t('host.maxLocations')}>
            <InputNumber min={1} max={1000} style={{ width: '100%' }} placeholder={t('host.unlimited')} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="notes" label={t('host.notes')}>
        <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} maxLength={2000} />
      </Form.Item>
    </>
  );
}

const COUNTRY_DEFAULTS: Record<string, { currency: string; vatRate: number }> = {
  TR: { currency: 'TRY', vatRate: 20 },
  AE: { currency: 'AED', vatRate: 5 },
  SA: { currency: 'SAR', vatRate: 15 },
  DE: { currency: 'EUR', vatRate: 19 },
  GB: { currency: 'GBP', vatRate: 20 },
  US: { currency: 'USD', vatRate: 0 },
};

/** Location fields; field names are prefixed (e.g. ['location', 'name']) when nested in the "new firm" form. */
export function LocationFields({ prefix = [], isNew = true }: { prefix?: string[]; isNew?: boolean }) {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const n = (name: string) => [...prefix, name];
  const required = [{ required: true, whitespace: true, message: t('validation.required') }];
  return (
    <Row gutter={12}>
      <Col xs={24} md={16}>
        <Form.Item name={n('name')} label={t('host.locationName')} rules={required}>
          <Input maxLength={256} />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item name={n('code')} label={t('host.locationCode')}
          rules={[...required, { pattern: /^[A-Za-z0-9_-]+$/, message: t('validation.invalid', { field: t('host.locationCode') }) }]}>
          <Input maxLength={16} disabled={!isNew} style={{ textTransform: 'uppercase' }} placeholder="TR" />
        </Form.Item>
      </Col>
      <Col xs={8}>
        <Form.Item name={n('countryCode')} label={t('host.country')} rules={required}>
          <Select
            showSearch
            options={Object.keys(COUNTRY_DEFAULTS).map((c) => ({ value: c, label: t(`login.country.${c}`, { defaultValue: c }) }))}
            onChange={(c: string) => {
              const d = COUNTRY_DEFAULTS[c];
              if (d) form.setFieldValue(n('currency'), d.currency);
              if (d) form.setFieldValue(n('vatRate'), d.vatRate);
            }}
          />
        </Form.Item>
      </Col>
      <Col xs={8}>
        <Form.Item name={n('currency')} label={t('host.currency')} rules={[...required, { len: 3, message: t('validation.invalid', { field: t('host.currency') }) }]}>
          <Input maxLength={3} style={{ textTransform: 'uppercase' }} />
        </Form.Item>
      </Col>
      <Col xs={8}>
        <Form.Item name={n('vatRate')} label={t('host.vatRate')} rules={[{ required: true, message: t('validation.required') }]}>
          <InputNumber min={0} max={100} style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col xs={24} md={isNew ? 12 : 24}>
        <Form.Item name={n('rentmanWorkspaceId')} label={t('host.rentmanWorkspace')} extra={t('host.rentmanWorkspaceHint')}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      {isNew && (
        <Col xs={24} md={12}>
          <Form.Item name={n('warehouseName')} label={t('host.warehouseName')}>
            <Input maxLength={128} placeholder="ANA DEPO" />
          </Form.Item>
        </Col>
      )}
    </Row>
  );
}

export const normalizeLocation = (v: TenantLocationInput): TenantLocationInput => ({
  ...v,
  name: v.name.trim(),
  code: v.code.trim().toUpperCase(),
  currency: v.currency.trim().toUpperCase(),
  countryCode: v.countryCode.toUpperCase(),
  rentmanWorkspaceId: v.rentmanWorkspaceId || null,
  warehouseName: v.warehouseName?.trim() || null,
});

/** First administrator of a new firm. */
export function AdminFields() {
  const { t } = useTranslation();
  const required = [{ required: true, whitespace: true, message: t('validation.required') }];
  return (
    <>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        {t('host.adminUserHint')}
      </Typography.Paragraph>
      <Row gutter={12}>
        <Col xs={24} md={12}>
          <Form.Item name={['admin', 'userName']} label={t('host.userName')} rules={[...required, { min: 3, message: t('validation.invalid', { field: t('host.userName') }) }]}>
            <Input maxLength={64} autoComplete="off" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name={['admin', 'fullName']} label={t('host.fullName')} rules={required}>
            <Input maxLength={128} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name={['admin', 'email']} label={t('host.email')} rules={[{ type: 'email', message: t('validation.invalid', { field: t('host.email') }) }]}>
            <Input maxLength={256} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name={['admin', 'password']} label={t('host.password')}
            rules={[{ required: true, message: t('validation.required') }, { pattern: /^(?=.*[A-Za-zÇĞİÖŞÜçğıöşü])(?=.*\d).{8,}$/, message: t('users.passwordRule') }]}>
            <Input.Password maxLength={128} autoComplete="new-password" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name={['admin', 'language']} label={t('host.language')}>
            <Select options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} />
          </Form.Item>
        </Col>
      </Row>
    </>
  );
}
