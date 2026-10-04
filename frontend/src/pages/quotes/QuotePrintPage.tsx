import { PrinterOutlined } from '@ant-design/icons';
import { Button, ConfigProvider, Skeleton, theme } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { quoteApi } from '../../api/endpoints';
import { useFormat } from '../../utils/format';

const cell: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #e5e5e5', textAlign: 'start' };
const num: React.CSSProperties = { ...cell, textAlign: 'end', whiteSpace: 'nowrap' };

/** A4 offer document in the current UI language; printed or saved as PDF from the browser. */
export function QuotePrintPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const f = useFormat();
  const { data: q, isLoading } = useQuery({ queryKey: ['quote', id], queryFn: () => quoteApi.get(id!) });

  useEffect(() => {
    const previous = document.body.style.background;
    document.body.style.background = '#e9e9e9';
    return () => { document.body.style.background = previous; };
  }, []);

  if (isLoading || !q) return <Skeleton active style={{ padding: 24 }} />;
  const money = (v: number) => f.money(v, q.currency);

  return (
    <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
      <div className="no-print" style={{ textAlign: 'center', padding: 12 }}>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>{t('quotes.printOrPdf')}</Button>
      </div>
      <div style={{ background: '#fff', color: '#111', width: '210mm', minHeight: '297mm', margin: '0 auto 24px', padding: '16mm', boxSizing: 'border-box', fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #f97316', paddingBottom: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{q.company.name}</div>
            <div style={{ color: '#666' }}>{t('print.companyLine')}</div>
          </div>
          <div style={{ textAlign: 'end' }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>{t('print.quote')}</div>
            <div>{q.number} / R{q.revision}</div>
            <div>{t('quotes.issueDate')}: {f.date(q.issueDate)}</div>
            {q.validUntil && <div>{t('quotes.validUntil')}: {f.date(q.validUntil)}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#f97316', marginBottom: 4 }}>{t('print.customer')}</div>
            <div style={{ fontWeight: 600 }}>{q.customer?.name ?? '—'}</div>
            {q.customer?.contactPerson && <div>{q.customer.contactPerson}</div>}
            {q.customer?.address && <div>{q.customer.address}</div>}
            {q.customer?.city && <div>{q.customer.city}{q.customer.country ? `, ${q.customer.country}` : ''}</div>}
            {q.customer?.taxNumber && <div>{t('print.taxInfo', { office: q.customer.taxOffice ?? '', number: q.customer.taxNumber })}</div>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#f97316', marginBottom: 4 }}>{t('print.event')}</div>
            <div style={{ fontWeight: 600 }}>{q.projectNumber} · {q.projectName}</div>
            {q.venue && <div>{q.venue}</div>}
            <div>{f.period(q.useStart, q.useEnd)}</div>
            <div>{t('print.rentalPeriod', { days: q.rentalDays, factor: f.number(q.factor, 4) })}</div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20 }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ ...cell, width: 28 }}>#</th>
              <th style={cell}>{t('quotes.description')}</th>
              <th style={num}>{t('quotes.quantity')}</th>
              <th style={num}>{t('quotes.unitPrice')}</th>
              <th style={num}>{t('quotes.factor')}</th>
              <th style={num}>{t('quotes.discount')}</th>
              <th style={num}>{t('quotes.total')}</th>
            </tr>
          </thead>
          <tbody>
            {q.lines.map((l, i) => (
              <tr key={l.id}>
                <td style={cell}>{i + 1}</td>
                <td style={cell}>
                  {l.description}
                  <div style={{ color: '#888', fontSize: 10 }}>{t(`enums.quoteLineType.${l.type}`)}{l.equipmentCode ? ` · ${l.equipmentCode}` : ''}</div>
                </td>
                <td style={num}>{f.number(l.quantity)}</td>
                <td style={num}>{money(l.unitPrice)}</td>
                <td style={num}>{l.applyFactor ? `×${f.number(q.factor)}` : '—'}</td>
                <td style={num}>{l.discountPercent ? `%${f.number(l.discountPercent)}` : '—'}</td>
                <td style={num}>{money(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <table style={{ minWidth: 280, borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={cell}>{t('quotes.subtotal')}</td><td style={num}>{money(q.subtotal)}</td></tr>
              {q.discountAmount > 0 && (
                <tr><td style={cell}>{t('quotes.discountAmount', { percent: f.number(q.discountPercent) })}</td><td style={num}>− {money(q.discountAmount)}</td></tr>
              )}
              <tr><td style={cell}>{t('quotes.netTotal')}</td><td style={num}>{money(q.netTotal)}</td></tr>
              <tr><td style={cell}>{t('quotes.vatAmount', { rate: f.number(q.vatRate) })}</td><td style={num}>{money(q.vatAmount)}</td></tr>
              <tr style={{ fontSize: 15, fontWeight: 700 }}><td style={cell}>{t('quotes.grandTotal')}</td><td style={num}>{money(q.grandTotal)}</td></tr>
            </tbody>
          </table>
        </div>

        {q.notes && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 600 }}>{t('common.notes')}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{q.notes}</div>
          </div>
        )}

        <div style={{ marginTop: 24, color: '#666', fontSize: 11 }}>{t('print.terms')}</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48 }}>
          <div style={{ borderTop: '1px solid #999', width: 200, paddingTop: 4, textAlign: 'center' }}>{q.company.name}</div>
          <div style={{ borderTop: '1px solid #999', width: 200, paddingTop: 4, textAlign: 'center' }}>{t('print.customerApproval')}</div>
        </div>
      </div>
    </ConfigProvider>
  );
}
