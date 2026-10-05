import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

const intlLocale = (lang: string) => (lang === 'ar' ? 'ar-AE' : lang === 'en' ? 'en-GB' : 'tr-TR');

/** Locale-aware formatters; Arabic uses Latin digits so codes and prices stay readable in the warehouse. */
export function useFormat() {
  const { i18n } = useTranslation();
  const locale = intlLocale(i18n.language);

  return {
    money: (value: number, currency: string) =>
      new Intl.NumberFormat(locale, { style: 'currency', currency, numberingSystem: 'latn' }).format(value ?? 0),
    number: (value: number, digits = 2) =>
      new Intl.NumberFormat(locale, { maximumFractionDigits: digits, numberingSystem: 'latn' }).format(value ?? 0),
    date: (value?: string | null) => (value ? dayjs(value).format('DD.MM.YYYY') : '—'),
    dateTime: (value?: string | null) => (value ? dayjs(value).format('DD.MM.YYYY HH:mm') : '—'),
    utcDateTime: (value?: string | null) => (value ? dayjs(value.endsWith('Z') ? value : value + 'Z').format('DD.MM.YYYY HH:mm') : '—'),
    period: (start?: string | null, end?: string | null) =>
      start ? `${dayjs(start).format('DD.MM.YYYY')} – ${end ? dayjs(end).format('DD.MM.YYYY') : '…'}` : '—',
  };
}

/** Sends local date-times to the API without a timezone shift (event times are wall-clock times). */
export const toApiDateTime = (value: dayjs.Dayjs | null | undefined) => (value ? value.format('YYYY-MM-DDTHH:mm:ss') : null);
export const toApiDate = (value: dayjs.Dayjs | null | undefined) => (value ? value.format('YYYY-MM-DD') : null);

export const formatDate = (value?: string | null) => (value ? dayjs(value).format('DD.MM.YYYY') : '—');
/** Server audit times are UTC; shown in the browser's local time. */
export const formatDateTime = (value?: string | null) =>
  value ? dayjs(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z').format('DD.MM.YYYY HH:mm') : '—';
