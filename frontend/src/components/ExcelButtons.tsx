import { DownloadOutlined, FileExcelOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Modal, Space, Table, Typography, Upload } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ImportResult } from '../api/types';
import { useErrorToast } from '../utils/errors';
import { downloadImportTemplate, exportToExcel, readExcelRows, type ExcelColumn, type ImportField } from '../utils/excel';

/** "Excel" button: loads the rows (usually every page of the current filter) and downloads an .xlsx. */
export function ExportButton<T>({
  fileName,
  columns,
  load,
  size,
}: {
  fileName: string;
  columns: ExcelColumn<T>[];
  load: () => Promise<T[]>;
  size?: 'small' | 'middle';
}) {
  const { t } = useTranslation();
  const showError = useErrorToast();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await exportToExcel(fileName, columns, await load());
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button icon={<FileExcelOutlined />} loading={busy} onClick={run} size={size}>
      {t('excel.export')}
    </Button>
  );
}

/**
 * "Import" button: template download, file pick, upload. Rows with an existing code (or tax number)
 * update the record, others are created; failing rows are listed with their Excel row number.
 */
export function ImportButton({
  title,
  templateName,
  fields,
  onImport,
  onDone,
}: {
  title: string;
  templateName: string;
  fields: ImportField[];
  onImport: (rows: Record<string, unknown>[]) => Promise<ImportResult>;
  onDone?: () => void;
}) {
  const { t } = useTranslation();
  const showError = useErrorToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [empty, setEmpty] = useState(false);

  const handleFile = async (file: File) => {
    setBusy(true);
    setResult(null);
    setEmpty(false);
    try {
      const rows = await readExcelRows(file, fields);
      if (rows.length === 0) {
        setEmpty(true);
        return;
      }
      setResult(await onImport(rows));
      onDone?.();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button icon={<UploadOutlined />} onClick={() => setOpen(true)}>
        {t('excel.import')}
      </Button>
      <Modal
        open={open}
        title={title}
        onCancel={() => {
          setOpen(false);
          setResult(null);
          setEmpty(false);
        }}
        footer={null}
        width={640}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            {t('excel.importHelp')}
          </Typography.Paragraph>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('excel.columns')}: {fields.map((f) => f.header + (f.required ? ' *' : '')).join(', ')}
          </Typography.Text>
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={() => downloadImportTemplate(templateName, fields).catch(showError)}>
              {t('excel.downloadTemplate')}
            </Button>
            <Upload
              accept=".xlsx"
              showUploadList={false}
              beforeUpload={(file) => {
                handleFile(file);
                return false;
              }}
            >
              <Button type="primary" icon={<UploadOutlined />} loading={busy}>
                {t('excel.chooseFile')}
              </Button>
            </Upload>
          </Space>
          {empty && <Alert type="warning" showIcon message={t('excel.noRows')} />}
          {result && (
            <>
              <Alert
                type={result.errors.length ? 'warning' : 'success'}
                showIcon
                message={t('excel.result', { created: result.created, updated: result.updated, failed: result.errors.length })}
              />
              {result.errors.length > 0 && (
                <Table
                  size="small"
                  rowKey={(e) => `${e.row}-${e.code}`}
                  dataSource={result.errors}
                  pagination={false}
                  scroll={{ y: 240 }}
                  columns={[
                    { title: t('excel.row'), dataIndex: 'row', width: 70 },
                    { title: t('excel.error'), dataIndex: 'message' },
                  ]}
                />
              )}
            </>
          )}
        </Space>
      </Modal>
    </>
  );
}
