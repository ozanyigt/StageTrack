import type { TFunction } from 'i18next';
import type { EquipmentUnit } from '../../api/types';
import type { ExcelColumn, ImportField } from '../../utils/excel';

const date = (v?: string | null) => (v ? new Date(v) : null);

/** Device columns for the Excel export of the serial-number grid and the device list. */
export const unitExportColumns = (t: TFunction): ExcelColumn<EquipmentUnit>[] => [
  { header: t('equipment.code'), value: (u) => u.equipmentCode, width: 14 },
  { header: t('equipment.name'), value: (u) => u.equipmentName, width: 36 },
  { header: t('units.internalRef'), value: (u) => u.internalRef, width: 18 },
  { header: t('units.serialNumber'), value: (u) => u.serialNumber, width: 20 },
  { header: t('units.location'), value: (u) => u.stockLocationName, width: 16 },
  { header: t('units.status'), value: (u) => t(`enums.unitStatus.${u.status}`), width: 12 },
  { header: t('units.currentProject'), value: (u) => (u.currentProjectId ? `${u.currentProjectNumber} · ${u.currentProjectName}` : null), width: 30 },
  { header: t('unitDetail.purchaseDate'), value: (u) => date(u.purchaseDate), width: 14 },
  { header: t('unitDetail.warrantyDate'), value: (u) => date(u.warrantyDate), width: 14 },
  { header: t('unitDetail.supplier'), value: (u) => u.supplierName, width: 22 },
  { header: t('unitDetail.nextInspection'), value: (u) => date(u.nextInspectionDate), width: 14 },
  { header: t('units.labels'), value: (u) => u.labelCount, width: 8 },
  { header: t('unitGrid.archived'), value: (u) => (u.isArchived ? t('common.yes') : t('common.no')), width: 8 },
];

/** Columns of the device import template (upsert by internal reference). */
export const unitImportFields = (t: TFunction): ImportField[] => [
  { key: 'equipmentCode', header: t('equipment.code'), required: true },
  { key: 'internalRef', header: t('units.internalRef'), required: true },
  { key: 'serialNumber', header: t('units.serialNumber') },
  { key: 'stockLocation', header: t('units.location') },
  { key: 'purchaseDate', header: t('unitDetail.purchaseDate'), type: 'date' },
  { key: 'labelCode', header: t('unitGrid.labelCodeColumn') },
];
