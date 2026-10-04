import { CameraOutlined, ScanOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Space, Typography, type InputRef } from 'antd';
import { Scanner } from '@yudiel/react-qr-scanner';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ScanInputHandle {
  focus: () => void;
}

interface Props {
  onScan: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  size?: 'middle' | 'large';
  placeholder?: string;
}

/**
 * Accepts codes from three sources: handheld scanners (they type the code and press Enter),
 * the phone/laptop camera, and manual typing. The input keeps focus so a scanner works without clicking.
 */
export const ScanInput = forwardRef<ScanInputHandle, Props>(function ScanInput(
  { onScan, disabled, autoFocus, size = 'large', placeholder },
  ref,
) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const inputRef = useRef<InputRef>(null);
  const lastCamera = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

  const submit = (raw: string) => {
    const code = raw.trim();
    if (!code || disabled) return;
    onScan(code);
    setValue('');
    inputRef.current?.focus();
  };

  const onCamera = (code: string) => {
    // The camera sees the same label many times per second; ignore repeats within 2.5 s.
    const now = Date.now();
    if (lastCamera.current.code === code && now - lastCamera.current.at < 2500) return;
    lastCamera.current = { code, at: now };
    submit(code);
  };

  return (
    <>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          ref={inputRef}
          size={size}
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          prefix={<ScanOutlined />}
          placeholder={placeholder ?? t('scan.inputPlaceholder')}
          onChange={(e) => setValue(e.target.value)}
          onPressEnter={() => submit(value)}
          autoComplete="off"
        />
        <Button size={size} icon={<CameraOutlined />} disabled={disabled} onClick={() => setCameraOpen(true)}>
          {t('scan.camera')}
        </Button>
      </Space.Compact>

      <Modal
        open={cameraOpen}
        title={t('scan.cameraTitle')}
        footer={<Button onClick={() => setCameraOpen(false)}>{t('common.close')}</Button>}
        onCancel={() => setCameraOpen(false)}
        destroyOnHidden
        width={420}
      >
        {cameraError ? (
          <Typography.Text type="danger">{t('scan.cameraError')}</Typography.Text>
        ) : (
          <Scanner
            onScan={(codes) => codes[0] && onCamera(codes[0].rawValue)}
            onError={() => setCameraError('error')}
            allowMultiple
            scanDelay={500}
            sound
            constraints={{ facingMode: 'environment' }}
            components={{ finder: true, torch: true }}
          />
        )}
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          {t('scan.cameraHint')}
        </Typography.Paragraph>
      </Modal>
    </>
  );
});
