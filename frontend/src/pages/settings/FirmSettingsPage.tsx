import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { App, Button, Card, Descriptions, Space, Typography, Upload } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { firmApi } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { useFirmLogoUrl } from '../../components/FirmLogo';
import { useErrorToast } from '../../utils/errors';

/** Firm settings: the logo printed on quotes and packing slips. */
export function FirmSettingsPage() {
  const { t } = useTranslation();
  const { user, company, refresh } = useAuth();
  const { message } = App.useApp();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const logo = useFirmLogoUrl();

  const done = async () => {
    await refresh();
    await queryClient.invalidateQueries({ queryKey: ['firm-logo'] });
    message.success(t('common.saved'));
  };
  const upload = useMutation({ mutationFn: (file: File) => firmApi.setLogo(file), onSuccess: done, onError: showError });
  const remove = useMutation({ mutationFn: firmApi.removeLogo, onSuccess: done, onError: showError });

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('firmSettings.title')}</Typography.Title>
      </div>
      <Card size="small" style={{ maxWidth: 720 }}>
        <Descriptions size="small" column={1} style={{ marginBottom: 16 }}>
          <Descriptions.Item label={t('firmSettings.firm')}>{user?.tenantName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('firmSettings.location')}>{company?.name ?? '—'}</Descriptions.Item>
        </Descriptions>
        <Typography.Text strong>{t('firmSettings.logo')}</Typography.Text>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          {t('firmSettings.logoHint')}
        </Typography.Paragraph>
        <Space align="center" size="large" wrap>
          <div style={{ width: 200, height: 90, display: 'grid', placeItems: 'center', border: '1px dashed #8884', borderRadius: 8, background: '#fff' }}>
            {logo ? (
              <img src={logo} alt="" style={{ maxWidth: 180, maxHeight: 76, objectFit: 'contain' }} />
            ) : (
              <Typography.Text type="secondary">{t('firmSettings.noLogo')}</Typography.Text>
            )}
          </div>
          <Space direction="vertical">
            <Upload
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              showUploadList={false}
              beforeUpload={(file) => {
                upload.mutate(file);
                return false;
              }}
            >
              <Button icon={<UploadOutlined />} loading={upload.isPending}>
                {t('firmSettings.upload')}
              </Button>
            </Upload>
            {logo && (
              <Button danger icon={<DeleteOutlined />} loading={remove.isPending} onClick={() => remove.mutate()}>
                {t('firmSettings.remove')}
              </Button>
            )}
          </Space>
        </Space>
      </Card>
    </>
  );
}
