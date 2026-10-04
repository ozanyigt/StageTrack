import { App } from 'antd';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ApiError } from '../api/http';

// Detail values that are enum names are translated before they are put into the message.
const ENUM_DETAIL_NAMESPACE: Record<string, string> = {
  Project: 'enums.projectStatus',
  Warehouse: 'enums.projectStatus',
  Quote: 'enums.quoteStatus',
};

export function translateError(t: TFunction, error: unknown): string {
  if (!(error instanceof ApiError)) {
    return t('errors.Common.Unexpected');
  }

  const prefix = error.code.split('.')[0];
  const details: Record<string, unknown> = { ...error.details };
  for (const key of ['status', 'from', 'to']) {
    const value = details[key];
    if (typeof value === 'string') {
      const ns = error.code === 'Warehouse.UnitNotAvailable' ? 'enums.unitStatus' : ENUM_DETAIL_NAMESPACE[prefix];
      if (ns) details[key] = t(`${ns}.${value}`, { defaultValue: value });
    }
  }
  if (typeof details.entity === 'string') {
    details.entity = t(`entities.${details.entity}`, { defaultValue: details.entity });
  }

  return t(`errors.${error.code}`, { ...details, defaultValue: t('errors.Common.Unexpected') });
}

/** Returns a function that shows any API error as a localized toast. */
export function useErrorToast() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  return useCallback((error: unknown) => message.error(translateError(t, error)), [message, t]);
}
