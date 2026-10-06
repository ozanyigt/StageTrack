import { PrinterOutlined } from '@ant-design/icons';
import { Button, ConfigProvider, Result, Skeleton, theme } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { quoteApi } from '../../api/endpoints';
import type { QuoteLine } from '../../api/types';
import { translateError } from '../../utils/errors';
import { useFormat } from '../../utils/format';
import { DocHeader, PRINT_CSS, usePrintBackground } from '../projects/PackingSlipPrintPage';

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

/** A4 priced offer in the layout of the Rentman quote (rm4) plus price columns and VAT totals. */
export function QuotePrintPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const f = useFormat();
  usePrintBackground();
  const { data: q, isLoading, error } = useQuery({ queryKey: ['quote', id], queryFn: () => quoteApi.get(id!) });

  if (error) return <Result status="warning" title={translateError(t, error)} />;
  if (isLoading || !q) return <Skeleton active style={{ padding: 24 }} />;
  const money = (v: number) => f.money(v, q.currency);
  const groups = groupBySection(q.lines);

  const info: [string, React.ReactNode][] = [
    [t('quotes.customer'), <strong key="c">{q.customer?.name ?? '—'}</strong>],
    [t('quotes.number'), `${q.number} / R${q.revision}`],
    [t('quotes.project'), q.projectName],
    [t('projectExtra.projectNumber'), q.projectNumber],
    [t('quotes.issueDate'), f.date(q.issueDate)],
    [t('quotes.validUntil'), q.validUntil ? f.date(q.validUntil) : '—'],
    [t('projects.venue'), q.venue ?? '—'],
    [t('projectExtra.paymentTerms'), q.paymentTerms ?? '—'],
    [t('quotePrint.contactPerson'), q.customer?.contactPerson ?? '—'],
    [t('quotePrint.preparedBy'), q.preparedByName ?? '—'],
  ];

  return (
    <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
      <style>{PRINT_CSS}</style>
      <div className="no-print" style={{ textAlign: 'center', padding: 12 }}>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>{t('quotes.printOrPdf')}</Button>
      </div>
      <div className="doc-sheet">
        <div className="head">
          <DocHeader company={q.company.name} subtitle={t('print.companyLine')} />
          <div style={{ textAlign: 'end' }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>{t('print.quote')}</div>
            <div>{q.number} / R{q.revision}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{t('packingSlip.timetable')}</div>
            <table>
              <thead>
                <tr><th /><th>{t('projects.planStart')}</th><th>{t('projects.planEnd')}</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t('quotePrint.workDays')}</td>
                  <td>{q.useStart ? f.dateTime(q.useStart) : '—'}</td>
                  <td>{q.useEnd ? f.dateTime(q.useEnd) : '—'}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ marginTop: 6, color: '#555' }}>{t('print.rentalPeriod', { days: q.rentalDays, factor: f.number(q.factor, 4) })}</div>
            {q.customer && (q.customer.address || q.customer.taxNumber) && (
              <div style={{ marginTop: 8, color: '#555' }}>
                {q.customer.address && <div>{q.customer.address}{q.customer.city ? `, ${q.customer.city}` : ''}</div>}
                {q.customer.taxNumber && <div>{t('print.taxInfo', { office: q.customer.taxOffice ?? '', number: q.customer.taxNumber })}</div>}
              </div>
            )}
          </div>
          <div style={{ flex: '1 1 260px' }}>
            <table className="kv">
              <tbody>
                {info.map(([label, value]) => (
                  <tr key={label}><td className="label" style={{ whiteSpace: 'nowrap' }}>{label}:</td><td>{value}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{t('quotePrint.equipment')}</div>
        <table>
          <thead>
            <tr>
              <th>{t('equipment.code')}</th>
              <th className="num">{t('quotes.quantity')}</th>
              <th>{t('equipment.name')}</th>
              <th className="num">{t('quotes.unitPrice')}</th>
              <th className="num">{t('quotes.factor')}</th>
              <th className="num">{t('quotes.discount')}</th>
              <th className="num">{t('quotes.total')}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.name ?? '__none__'}>
                {g.name && (
                  <tr className="section-row">
                    <td colSpan={6}>{g.name}</td>
                    <td className="num">{money(g.lines.reduce((s, l) => s + l.total, 0))}</td>
                  </tr>
                )}
                {g.lines.map((l) =>
                  l.isContent ? (
                    // Case content: listed under the case, priced in the case.
                    <tr key={l.id} className="content-row">
                      <td style={{ whiteSpace: 'nowrap', paddingInlineStart: 16 }}>↳ {l.equipmentCode}</td>
                      <td className="num">{f.number(l.quantity)}</td>
                      <td style={{ paddingInlineStart: 16 }}>{l.description}</td>
                      <td colSpan={4} />
                    </tr>
                  ) : (
                    <tr key={l.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{l.equipmentCode ?? t(`enums.quoteLineType.${l.type}`)}</td>
                      <td className="num">{f.number(l.quantity)}</td>
                      <td>
                        {l.description}
                        {l.notes && <div style={{ color: '#666', fontSize: 10, whiteSpace: 'pre-wrap' }}>{l.notes}</div>}
                      </td>
                      <td className="num">{money(l.unitPrice)}</td>
                      <td className="num">{l.applyFactor ? `×${f.number(q.factor)}` : '—'}</td>
                      <td className="num">{l.discountPercent ? `%${f.number(l.discountPercent)}` : '—'}</td>
                      <td className="num">{money(l.total)}</td>
                    </tr>
                  ),
                )}
              </Fragment>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <table style={{ width: 300 }}>
            <tbody>
              <tr><td>{t('quotes.subtotal')}</td><td className="num">{money(q.subtotal)}</td></tr>
              {q.discountAmount > 0 && (
                <tr><td>{t('quotes.discountAmount', { percent: f.number(q.discountPercent) })}</td><td className="num">− {money(q.discountAmount)}</td></tr>
              )}
              <tr><td>{t('quotes.netTotal')}</td><td className="num">{money(q.netTotal)}</td></tr>
              <tr><td>{t('quotes.vatAmount', { rate: f.number(q.vatRate) })}</td><td className="num">{money(q.vatAmount)}</td></tr>
              <tr style={{ fontSize: 14, fontWeight: 700 }}>
                <td style={{ borderTop: '2px solid #312e81' }}>{t('quotes.grandTotal')}</td>
                <td className="num" style={{ borderTop: '2px solid #312e81' }}>{money(q.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {q.notes && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700 }}>{t('common.notes')}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{q.notes}</div>
          </div>
        )}

        <div style={{ marginTop: 16, color: '#666', fontSize: 10 }}>{t('print.terms')}</div>

        <div className="signatures">
          <div>{t('packingSlip.companySignature')}</div>
          <div>{t('packingSlip.customerSignature')}</div>
        </div>
      </div>
    </ConfigProvider>
  );
}
