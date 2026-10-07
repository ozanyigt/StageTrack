import { CameraOutlined, CheckCircleFilled, CloseCircleFilled, ExclamationCircleFilled, ScanOutlined } from '@ant-design/icons';
import { Button, Flex, Input, Modal, Space, Typography, type ButtonProps, type InputRef } from 'antd';
import { Scanner } from '@yudiel/react-qr-scanner';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface ScanInputHandle {
  focus: () => void;
}

/** What became of the last scanned code; shown inside the camera window. */
export interface ScanFeedback {
  kind: 'ok' | 'warn' | 'error';
  title: string;
  detail?: string;
}

/**
 * How many codes the caller wants:
 * - `single`: one code (linking a label, filling a field). The camera closes on the first read, so whatever the
 *   code filled in behind it is visible straight away.
 * - `continuous`: code after code (warehouse). The camera stays open and every result is shown inside the window,
 *   because the screen behind it is covered.
 */
export type ScanMode = 'single' | 'continuous';

const BORDER: Record<ScanFeedback['kind'], string> = { ok: '#52c41a', warn: '#faad14', error: '#ff4d4f' };

function kindIcon(kind: ScanFeedback['kind']): ReactNode {
  const style = { color: BORDER[kind], fontSize: 22 };
  if (kind === 'ok') return <CheckCircleFilled style={style} />;
  if (kind === 'warn') return <ExclamationCircleFilled style={style} />;
  return <CloseCircleFilled style={style} />;
}

/**
 * The camera window shared by every scanning place. A read is always answered on three channels that do not
 * depend on the system volume: a green flash over the picture, a short vibration, and a line naming the code
 * (replaced by the caller's result as soon as it is known).
 */
function useScanCamera({
  onScan,
  mode,
  feedback,
  disabled,
}: {
  onScan: (code: string) => void;
  mode: ScanMode;
  feedback?: ScanFeedback | null;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [read, setRead] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const last = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  // The caller's answer takes over from the bare code once it arrives.
  useEffect(() => {
    if (feedback) setRead(null);
  }, [feedback]);

  const show = () => {
    setRead(null);
    setFailed(false);
    last.current = { code: '', at: 0 };
    setOpen(true);
  };

  const onCamera = (code: string) => {
    // Nothing is reported while the previous code is still being handled, so the confirmation never lies.
    if (disabled) return;

    // The camera sees the same label many times per second; ignore repeats within 2.5 s.
    const now = Date.now();
    if (last.current.code === code && now - last.current.at < 2500) return;
    last.current = { code, at: now };

    try {
      navigator.vibrate?.(60);
    } catch {
      /* not supported */
    }

    setFlash((n) => n + 1);
    setRead(code);
    onScan(code);
    if (mode === 'single') {
      setOpen(false);
    }
  };

  const shown: ScanFeedback | null = read ? { kind: 'ok', title: t('scan.read', { code: read }) } : feedback ?? null;

  const dialog = (
    <Modal
      open={open}
      title={t('scan.cameraTitle')}
      footer={<Button onClick={() => setOpen(false)}>{t('common.close')}</Button>}
      onCancel={() => setOpen(false)}
      destroyOnHidden
      width={420}
    >
      {failed ? (
        <Typography.Text type="danger">{t('scan.cameraError')}</Typography.Text>
      ) : (
        <div style={{ position: 'relative' }}>
          <Scanner
            onScan={(codes) => codes[0] && onCamera(codes[0].rawValue)}
            onError={() => setFailed(true)}
            allowMultiple
            scanDelay={500}
            sound
            constraints={{ facingMode: 'environment' }}
            components={{ finder: true, torch: true }}
          />
          {flash > 0 && <span key={flash} className="scan-flash" />}
        </div>
      )}

      {shown && (
        <Flex
          gap={8}
          align="center"
          style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, border: `2px solid ${BORDER[shown.kind]}` }}
        >
          {kindIcon(shown.kind)}
          <div style={{ minWidth: 0 }}>
            <Typography.Text strong>{shown.title}</Typography.Text>
            {shown.detail && (
              <div>
                <Typography.Text type="secondary">{shown.detail}</Typography.Text>
              </div>
            )}
          </div>
        </Flex>
      )}

      <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
        {t(mode === 'single' ? 'scan.cameraHintSingle' : 'scan.cameraHint')}
      </Typography.Paragraph>
    </Modal>
  );

  return { show, dialog };
}

interface CameraButtonProps {
  onScan: (code: string) => void;
  mode?: ScanMode;
  feedback?: ScanFeedback | null;
  disabled?: boolean;
  size?: ButtonProps['size'];
  type?: ButtonProps['type'];
  /** Button text; leave empty for an icon-only button sitting on a field. */
  label?: string;
}

/**
 * Camera scanning for a field that already exists: the button sits on the field and the code lands in it,
 * so there is no second input to wonder about.
 */
export function ScanCameraButton({ onScan, mode = 'single', feedback, disabled, size, type, label }: CameraButtonProps) {
  const { t } = useTranslation();
  const camera = useScanCamera({ onScan, mode, feedback, disabled });

  return (
    <>
      <Button size={size} type={type} icon={<CameraOutlined />} disabled={disabled} onClick={camera.show} aria-label={t('scan.camera')}>
        {label}
      </Button>
      {camera.dialog}
    </>
  );
}

interface Props {
  onScan: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  size?: 'middle' | 'large';
  placeholder?: string;
  mode?: ScanMode;
  /** Result of the scanned code; shown in the camera window (continuous mode, where the page is covered). */
  feedback?: ScanFeedback | null;
}

/**
 * Accepts codes from three sources: handheld scanners (they type the code and press Enter),
 * the phone/laptop camera, and manual typing. The input keeps focus so a scanner works without clicking.
 */
export const ScanInput = forwardRef<ScanInputHandle, Props>(function ScanInput(
  { onScan, disabled, autoFocus, size = 'large', placeholder, mode = 'single', feedback },
  ref,
) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const inputRef = useRef<InputRef>(null);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

  const submit = (raw: string) => {
    const code = raw.trim();
    if (!code || disabled) return;
    onScan(code);
    setValue('');
    inputRef.current?.focus();
  };

  const camera = useScanCamera({ onScan: submit, mode, feedback, disabled });

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
        <Button size={size} icon={<CameraOutlined />} disabled={disabled} onClick={camera.show}>
          {t('scan.camera')}
        </Button>
      </Space.Compact>
      {camera.dialog}
    </>
  );
});
