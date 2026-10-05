// Excel export/import helpers (exceljs is loaded on demand so it does not weigh on the first page load).

export interface ExcelColumn<T> {
  /** Translated column header. */
  header: string;
  /** Cell value; dates should be passed as Date so Excel formats them. */
  value: (row: T) => string | number | boolean | Date | null | undefined;
  width?: number;
}

/** Writes rows to a single-sheet .xlsx file and starts the download. */
export async function exportToExcel<T>(fileName: string, columns: ExcelColumn<T>[], rows: T[], sheetName = 'Sheet1') {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c.header, width: c.width ?? Math.max(12, Math.min(48, c.header.length + 4)) }));
  rows.forEach((row) => sheet.addRow(columns.map((c) => c.value(row) ?? null)));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  sheet.eachRow((r, i) => {
    if (i > 1) r.eachCell((cell) => {
      if (cell.value instanceof Date) cell.numFmt = 'dd.mm.yyyy hh:mm';
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), ensureXlsx(fileName));
}

export interface ImportField {
  /** Property name sent to the API. */
  key: string;
  /** Translated header written into the template and matched when reading. */
  header: string;
  type?: 'string' | 'number' | 'boolean' | 'date';
  required?: boolean;
}

/** Downloads an empty template whose headers are the import fields. */
export async function downloadImportTemplate(fileName: string, fields: ImportField[]) {
  await exportToExcel(fileName, fields.map((f) => ({ header: f.header + (f.required ? ' *' : ''), value: () => null })), []);
}

/**
 * Reads the first sheet. Columns are matched by header text (translated header, with or without the
 * required marker) or by the API key, so templates downloaded in any UI language can be imported.
 * Each row gets its Excel row number in `row`.
 */
export async function readExcelRows(file: File, fields: ImportField[], allHeaders: string[][] = []): Promise<Record<string, unknown>[]> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const normalize = (v: unknown) => String(v ?? '').replace(/\*/g, '').trim().toLocaleLowerCase('tr');
  const columnOf = new Map<number, ImportField>();
  sheet.getRow(1).eachCell((cell, col) => {
    const text = normalize(cellText(cell.value));
    const field = fields.find(
      (f, i) => normalize(f.header) === text || f.key.toLowerCase() === text || (allHeaders[i] ?? []).some((h) => normalize(h) === text),
    );
    if (field) columnOf.set(col, field);
  });

  const rows: Record<string, unknown>[] = [];
  sheet.eachRow((r, rowNumber) => {
    if (rowNumber === 1) return;
    const item: Record<string, unknown> = { row: rowNumber };
    let hasValue = false;
    columnOf.forEach((field, col) => {
      const value = convert(r.getCell(col).value, field.type ?? 'string');
      if (value !== null) hasValue = true;
      item[field.key] = value;
    });
    if (hasValue) rows.push(item);
  });
  return rows;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const v = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return String(v.result);
  }
  return String(value);
}

function convert(value: unknown, type: NonNullable<ImportField['type']>): unknown {
  if (value === null || value === undefined || cellText(value).trim() === '') return null;
  switch (type) {
    case 'number': {
      const n = typeof value === 'number' ? value : Number(cellText(value).replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      const t = cellText(value).trim().toLocaleLowerCase('tr');
      return ['1', 'true', 'evet', 'yes', 'e', 'y', 'نعم'].includes(t);
    }
    case 'date': {
      if (value instanceof Date) return value.toISOString();
      const d = new Date(cellText(value));
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    default:
      return cellText(value).trim();
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ensureXlsx = (name: string) => (name.toLowerCase().endsWith('.xlsx') ? name : `${name}.xlsx`);

/** Loads every page of a paged endpoint (for "export all"). */
export async function fetchAllPages<T>(load: (skipCount: number, maxResultCount: number) => Promise<{ totalCount: number; items: T[] }>) {
  const pageSize = 500;
  const first = await load(0, pageSize);
  const items = [...first.items];
  while (items.length < first.totalCount) {
    const next = await load(items.length, pageSize);
    if (next.items.length === 0) break;
    items.push(...next.items);
  }
  return items;
}
