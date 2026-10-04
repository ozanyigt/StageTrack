import { Button, Empty, Flex, Modal, Typography } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import type { Label } from '../api/types';

interface Props {
  title: string;
  subtitle?: string;
  labels: Label[] | null;
  onClose: () => void;
}

/** Shows the label QR codes on screen so they can be scanned or printed during the demo. */
export function QrLabelModal({ title, subtitle, labels, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <Modal
      open={!!labels}
      title={title}
      onCancel={onClose}
      footer={[
        <Button key="print" icon={<PrinterOutlined />} onClick={() => window.print()}>
          {t('common.print')}
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          {t('common.close')}
        </Button>,
      ]}
    >
      {labels && labels.length === 0 && <Empty description={t('labels.none')} />}
      <Flex wrap gap={24} justify="center">
        {labels?.map((label) => (
          <Flex key={label.id} vertical align="center" gap={6} style={{ background: '#fff', padding: 12, borderRadius: 8 }}>
            <QRCodeSVG value={label.rawValue} size={160} marginSize={1} />
            <Typography.Text strong style={{ color: '#000' }}>{label.code}</Typography.Text>
            {subtitle && <Typography.Text style={{ color: '#555', fontSize: 12 }}>{subtitle}</Typography.Text>}
            <Typography.Text style={{ color: '#888', fontSize: 11 }}>{t(`enums.labelType.${label.type}`)}</Typography.Text>
          </Flex>
        ))}
      </Flex>
    </Modal>
  );
}
