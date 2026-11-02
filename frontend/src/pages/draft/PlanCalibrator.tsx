import { Alert, Button, Flex, InputNumber, Modal, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVenue } from './useVenue';

interface Props {
  open: boolean;
  projectId: string;
  imageUrl: string | null;
  onClose: () => void;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Scaling the venue's drawing the way a rigger does it: point at two ends of something whose length is known -
 * the stage opening, a bay, a dimension already printed on the sheet - and say what it is. Everything else on
 * the drawing follows from that one measurement, and nobody has to find out what scale the PDF was exported at.
 */
export function PlanCalibrator({ open, projectId, imageUrl, onClose }: Props) {
  const { t } = useTranslation();
  const { venue, setPlanImage } = useVenue(projectId);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [metres, setMetres] = useState<number>(20);
  /** Shown at its own pixel size: a dimension tick is three pixels wide once a big sheet is squeezed into a modal. */
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (open) setPoints([]);
  }, [open]);

  /** Clicks are taken in the image's own pixels, so the answer does not depend on how big it is shown. */
  const onClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const image = imageRef.current;
    if (!image) return;
    const rect = image.getBoundingClientRect();
    const point = {
      x: ((e.clientX - rect.left) / rect.width) * image.naturalWidth,
      y: ((e.clientY - rect.top) / rect.height) * image.naturalHeight,
    };
    setPoints((current) => (current.length >= 2 ? [point] : [...current, point]));
  };

  const pixels = points.length === 2 ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) : 0;
  const metresPerPixel = pixels > 0 && metres > 0 ? metres / pixels : null;

  const toPercent = (point: Point) => {
    const image = imageRef.current;
    if (!image) return { left: '0%', top: '0%' };
    return { left: `${(point.x / image.naturalWidth) * 100}%`, top: `${(point.y / image.naturalHeight) * 100}%` };
  };

  return (
    <Modal
      open={open}
      title={t('venue.calibrateTitle')}
      width={900}
      onCancel={onClose}
      okText={t('venue.applyScale')}
      cancelText={t('common.cancel')}
      okButtonProps={{ disabled: !metresPerPixel, loading: setPlanImage.isPending }}
      onOk={() => {
        if (!metresPerPixel) return;
        setPlanImage.mutate(
          {
            planAttachmentId: venue?.planAttachmentId ?? null,
            planMetresPerPixel: metresPerPixel,
            planOriginXM: venue?.planOriginXM ?? 0,
            planOriginZM: venue?.planOriginZM ?? 0,
            planRotationDeg: venue?.planRotationDeg ?? 0,
          },
          { onSuccess: onClose },
        );
      }}
      destroyOnHidden
    >
      <Alert type="info" showIcon style={{ marginBottom: 8 }} message={t('venue.calibrateHint')} />

      <Flex gap={12} align="center" wrap style={{ marginBottom: 8 }}>
        <Typography.Text type="secondary">{t('venue.knownLength')}</Typography.Text>
        <InputNumber min={0.1} max={1000} step={0.5} value={metres} addonAfter="m" onChange={(v) => setMetres(v ?? 1)} />
        <Button size="small" onClick={() => setPoints([])} disabled={points.length === 0}>
          {t('venue.clearPoints')}
        </Button>
        <Button size="small" type={full ? 'primary' : 'default'} onClick={() => setFull(!full)}>
          {full ? t('venue.fitImage') : t('venue.fullSize')}
        </Button>
        <Typography.Text type="secondary">
          {points.length < 2
            ? t('venue.pointsLeft', { count: 2 - points.length })
            : t('venue.measured', { pixels: Math.round(pixels), scale: metresPerPixel ? (1 / metresPerPixel).toFixed(1) : '—' })}
        </Typography.Text>
      </Flex>

      <div style={{ maxHeight: 520, overflow: 'auto', background: '#111' }}>
        {imageUrl ? (
          <div style={{ position: 'relative', width: full ? 'max-content' : '100%' }}>
            <img
              ref={imageRef}
              src={imageUrl}
              alt={t('venue.planImage')}
              onClick={onClick}
              style={{ width: full ? 'auto' : '100%', maxWidth: full ? 'none' : '100%', display: 'block', cursor: 'crosshair' }}
            />
            {points.map((point, index) => (
              <span
                key={index}
                style={{
                  position: 'absolute',
                  ...toPercent(point),
                  width: 12,
                  height: 12,
                  marginLeft: -6,
                  marginTop: -6,
                  borderRadius: '50%',
                  background: '#1677ff',
                  boxShadow: '0 0 0 2px #fff',
                  pointerEvents: 'none',
                }}
              />
            ))}
            {points.length === 2 && (
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                <line
                  x1={toPercent(points[0]).left}
                  y1={toPercent(points[0]).top}
                  x2={toPercent(points[1]).left}
                  y2={toPercent(points[1]).top}
                  stroke="#1677ff"
                  strokeWidth="2"
                />
              </svg>
            )}
          </div>
        ) : (
          <Typography.Text type="secondary" style={{ display: 'block', padding: 24 }}>{t('venue.noPlanImage')}</Typography.Text>
        )}
      </div>
    </Modal>
  );
}
