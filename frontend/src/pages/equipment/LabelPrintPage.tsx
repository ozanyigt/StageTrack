import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Flex, Select, Space, Spin, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { labelApi, labelTemplateApi } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { translateError } from '../../utils/errors';
import { LabelPreview } from './LabelPreview';

const ids = (value: string | null) => (value ? value.split(',').filter(Boolean) : []);

/**
 * Prints labels for the selected devices (and quantity-tracked equipment). Items without a label get a new
 * one in the Rentman QR format first, so old and new stickers are scanned the same way.
 * Each label is one printed page of the template's size, which suits any label printer.
 */
export function LabelPrintPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { company } = useAuth();
  const [params, setParams] = useSearchParams();
  const unitIds = ids(params.get('units'));
  const equipmentIds = ids(params.get('equipment'));

  // Creating labels is not idempotent for a moment (a new label per call for unlabeled items), so the
  // request runs once per selection and is never refetched.
  const items = useQuery({
    queryKey: ['label-print', unitIds.join(','), equipmentIds.join(',')],
    queryFn: () => labelApi.preparePrint({ unitIds, equipmentIds, createMissing: true }),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: unitIds.length + equipmentIds.length > 0,
  });
  const templates = useQuery({ queryKey: ['label-templates'], queryFn: labelTemplateApi.list });

  const list = templates.data ?? [];
  const template = list.find((x) => x.id === params.get('template')) ?? list.find((x) => x.isDefault) ?? list[0];
  const newCount = (items.data ?? []).filter((i) => i.isNew).length;

  return (
    <div style={{ minHeight: '100vh', background: '#f0f0f0' }}>
      {template && (
        <style>{`
          @page { size: ${template.widthMm}mm ${template.heightMm}mm; margin: 0; }
          @media print {
            html, body { background: #fff !important; }
            .label-list { padding: 0 !important; gap: 0 !important; display: block !important; }
            .label-list .label-sheet-wrap { box-shadow: none !important; page-break-after: always; break-after: page; }
            .label-list .label-sheet-wrap:last-child { page-break-after: auto; break-after: auto; }
          }
        `}</style>
      )}
      <Flex className="no-print" gap={12} wrap align="center" style={{ padding: 12, background: '#fff', borderBottom: '1px solid #e5e5e5' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          {t('common.back')}
        </Button>
        <Typography.Text strong>{t('labelPrint.title')}</Typography.Text>
        <Select
          style={{ width: 240 }}
          loading={templates.isLoading}
          value={template?.id}
          onChange={(id) => {
            const next = new URLSearchParams(params);
            next.set('template', id);
            setParams(next, { replace: true });
          }}
          options={list.map((x) => ({ value: x.id, label: `${x.name} (${x.widthMm}×${x.heightMm} mm)` }))}
          aria-label={t('labelPrint.template')}
        />
        <Button type="primary" icon={<PrinterOutlined />} disabled={!items.data?.length || !template} onClick={() => window.print()}>
          {t('common.print')}
        </Button>
        <Space style={{ marginInlineStart: 'auto' }}>
          {items.data && <Typography.Text type="secondary">{t('labelPrint.count', { count: items.data.length })}</Typography.Text>}
        </Space>
      </Flex>

      <div className="no-print" style={{ padding: '12px 12px 0' }}>
        {newCount > 0 && <Alert type="success" showIcon message={t('labelPrint.newCreated', { count: newCount })} style={{ marginBottom: 8 }} />}
        {items.isError && <Alert type="error" showIcon message={translateError(t, items.error)} />}
        {!templates.isLoading && list.length === 0 && <Alert type="warning" showIcon message={t('labelPrint.noTemplate')} />}
        <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
          {t('labelPrint.printerHint')}
        </Typography.Paragraph>
      </div>

      {items.isLoading || templates.isLoading ? (
        <Spin style={{ display: 'block', margin: 48 }} />
      ) : !items.data?.length ? (
        <Empty style={{ marginTop: 48 }} description={t('labelPrint.nothing')} />
      ) : (
        template && (
          <div className="label-list" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 12 }}>
            {items.data.map((item) => (
              <div key={`${item.unitId ?? item.equipmentId}-${item.code}`} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} className="label-sheet-wrap">
                <LabelPreview template={template} item={item} companyName={company?.name} />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
