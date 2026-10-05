import { PrinterOutlined } from '@ant-design/icons';
import { Button, ConfigProvider, Result, Skeleton, theme } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Fragment, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { projectApi } from '../../api/endpoints';
import type { PackingSlipLine } from '../../api/types';
import { translateError } from '../../utils/errors';
import { useFormat } from '../../utils/format';

export const PRINT_CSS = `
@page { size: A4; margin: 12mm; }
.doc-sheet { background:#fff; color:#111; width:210mm; min-height:297mm; margin:0 auto 24px; padding:12mm; box-sizing:border-box; font-size:11px; font-family: Arial, 'Segoe UI', Tahoma, sans-serif; }
.doc-sheet table { width:100%; border-collapse:collapse; }
.doc-sheet th { text-align:start; font-size:10px; text-transform:uppercase; letter-spacing:.3px; color:#555; border-bottom:1.5px solid #312e81; padding:5px 6px; }
.doc-sheet td { padding:4px 6px; border-bottom:1px solid #e6e6e6; vertical-align:top; }
.doc-sheet .num { text-align:end; white-space:nowrap; }
.doc-sheet .section-row td { background:#eef0ff; font-weight:700; border-bottom:1px solid #c7cbf5; padding-top:7px; }
.doc-sheet .section-row.sub td { background:#f6f7ff; font-weight:600; }
.doc-sheet .content-row td { color:#555; font-size:10px; }
.doc-sheet .check { display:inline-block; width:11px; height:11px; border:1px solid #444; border-radius:2px; }
.doc-sheet .label { color:#666; }
.doc-sheet .kv td { border:none; padding:2px 6px 2px 0; }
.doc-sheet .head { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #312e81; padding-bottom:8px; margin-bottom:12px; gap:16px; }
.doc-sheet .signatures { display:flex; justify-content:space-between; margin-top:56px; break-inside:avoid; }
.doc-sheet .signatures div { border-top:1px solid #999; width:200px; padding-top:4px; text-align:center; }
.doc-sheet tr { break-inside:avoid; }
@media print {
  body { background:#fff !important; }
  .doc-sheet { width:auto; min-height:0; margin:0; padding:0; }
}
`;

/** Page background grey on screen, so the A4 sheet stands out. */
export function usePrintBackground() {
  useEffect(() => {
    const previous = document.body.style.background;
    document.body.style.background = '#e9e9e9';
    return () => {
      document.body.style.background = previous;
    };
  }, []);
}

export function DocHeader({ company, subtitle }: { company: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <img src="/favicon.svg" width={40} height={40} alt="" />
      <div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{company}</div>
        {subtitle && <div style={{ color: '#666' }}>{subtitle}</div>}
      </div>
    </div>
  );
}

/** Price-free packing slip / material list (Rentman "Depo fişi" with sections). Crew members can print it too. */
export function PackingSlipPrintPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const f = useFormat();
  usePrintBackground();
  const { data: s, isLoading, error } = useQuery({ queryKey: ['packing-slip', id], queryFn: () => projectApi.packingSlip(id!) });

  if (error) return <Result status="warning" title={translateError(t, error)} />;
  if (isLoading || !s) return <Skeleton active style={{ padding: 24 }} />;

  const total = (lines: PackingSlipLine[]) => lines.reduce((sum, l) => sum + l.quantity, 0);
  const renderLine = (line: PackingSlipLine, depth: number, key: string): React.ReactNode => (
    <Fragment key={key}>
      <tr className={depth > 0 ? 'content-row' : undefined}>
        <td className="num" style={{ width: 44, fontWeight: depth > 0 ? 400 : 600 }}>{line.quantity}</td>
        <td style={{ width: 26, textAlign: 'center' }}><span className="check" /></td>
        <td style={{ width: 26, textAlign: 'center' }}><span className="check" /></td>
        <td style={{ paddingInlineStart: 6 + depth * 16 }}>
          {depth > 0 && '· '}
          {line.name}
          {line.notes && <div style={{ color: '#666', fontSize: 10, whiteSpace: 'pre-wrap' }}>{line.notes}</div>}
        </td>
        <td style={{ width: 90, whiteSpace: 'nowrap' }}>{line.code}</td>
      </tr>
      {line.content.map((c, i) => renderLine(c, depth + 1, `${key}-${i}`))}
    </Fragment>
  );

  return (
    <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
      <style>{PRINT_CSS}</style>
      <div className="no-print" style={{ textAlign: 'center', padding: 12 }}>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>{t('quotes.printOrPdf')}</Button>
      </div>
      <div className="doc-sheet">
        <div className="head">
          <DocHeader company={s.companyName} subtitle={t('print.companyLine')} />
          <div style={{ textAlign: 'end' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{t('packingSlip.title')}</div>
            <div style={{ fontSize: 13 }}>{s.projectName}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}>
            <table className="kv">
              <tbody>
                <tr><td className="label">{t('projectExtra.paymentTerms')}:</td><td>{s.paymentTerms ?? '—'}</td></tr>
                <tr><td className="label">{t('projectExtra.accountManager')}:</td><td>{s.accountManagerName ?? '—'}</td></tr>
                <tr><td className="label">{t('packingSlip.createdAt')}:</td><td>{f.dateTime(s.createdAt)}</td></tr>
              </tbody>
            </table>
            <div style={{ fontWeight: 700, marginTop: 10, marginBottom: 2 }}>{t('packingSlip.timetable')}</div>
            <table>
              <thead>
                <tr><th /><th>{t('projects.planStart')}</th><th>{t('projects.planEnd')}</th></tr>
              </thead>
              <tbody>
                <tr><td>{t('projects.planPeriod')}</td><td>{f.dateTime(s.planStart)}</td><td>{f.dateTime(s.planEnd)}</td></tr>
                {s.useStart && <tr><td>{t('projects.usePeriod')}</td><td>{f.dateTime(s.useStart)}</td><td>{f.dateTime(s.useEnd)}</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <table className="kv">
              <tbody>
                <tr><td className="label">{t('projects.customer')}:</td><td style={{ fontWeight: 600 }}>{s.customerName ?? '—'}</td></tr>
                <tr><td className="label">{t('projectExtra.projectNumber')}:</td><td>{s.projectNumber}</td></tr>
                <tr><td className="label">{t('projects.venue')}:</td><td>{s.venue ?? '—'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {s.crew.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{t('crewTab.title')}</div>
            <table>
              <tbody>
                {s.crew.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.fullName}</td>
                    <td>{c.function ?? c.jobTitle ?? ''}</td>
                    <td dir="ltr" style={{ textAlign: 'end' }}>{c.phone ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th className="num">{t('projects.quantity')}</th>
              <th style={{ textAlign: 'center' }}>{t('packingSlip.out')}</th>
              <th style={{ textAlign: 'center' }}>{t('packingSlip.in')}</th>
              <th>{t('equipment.name')}</th>
              <th>{t('equipment.code')}</th>
            </tr>
          </thead>
          <tbody>
            {s.sections.map((section, si) => (
              <Fragment key={si}>
                {section.name && (
                  <tr className={`section-row${section.depth > 1 ? ' sub' : ''}`}>
                    <td colSpan={5} style={{ paddingInlineStart: 6 + (section.depth - 1) * 16 }}>
                      {section.name}
                      {section.lines.length > 0 && <span style={{ fontWeight: 400, color: '#555' }}> · {total(section.lines)}</span>}
                    </td>
                  </tr>
                )}
                {section.lines.map((line, li) => renderLine(line, 0, `${si}-${li}`))}
              </Fragment>
            ))}
          </tbody>
        </table>

        <div className="signatures">
          <div>{t('packingSlip.companySignature')}</div>
          <div>{t('packingSlip.customerSignature')}</div>
        </div>
      </div>
    </ConfigProvider>
  );
}
