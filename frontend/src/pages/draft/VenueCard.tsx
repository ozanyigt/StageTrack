import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Empty, Flex, InputNumber, Popconfirm, Row, Space, Typography, Upload } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlanCalibrator } from './PlanCalibrator';
import { usePlanImage, useVenue } from './useVenue';

interface Props {
  projectId: string | null;
  /** How high the rig reaches, metres; compared against the clear height. */
  rigHeightM: number;
}

const DEFAULT_VENUE = { widthM: 30, depthM: 40, clearHeightM: 9, stageOffsetXM: 0, behindStageM: 2, rakeDeg: 0 };

/**
 * The room the job is built in. Three numbers anyone can read off a technical rider, plus the drawing the venue
 * itself sends - scaled by pointing at a distance that is known, which is how a rigger works and the only way
 * columns and doors ever reach a design without somebody modelling a building.
 */
export function VenueCard({ projectId, rigHeightM }: Props) {
  const { t } = useTranslation();
  const { venue, loading, setVenue, upload, remove } = useVenue(projectId);
  const planUrl = usePlanImage(venue?.planAttachmentId);
  const [calibrating, setCalibrating] = useState(false);

  if (!projectId) {
    return (
      <Card size="small" title={t('venue.title')}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('venue.pickJobFirst')} />
      </Card>
    );
  }

  const field = (key: keyof typeof DEFAULT_VENUE, label: string, hint?: string, min = 0, max = 1000) => (
    <Col xs={12} md={8} key={key}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{label}</Typography.Text>
      <InputNumber
        size="small"
        style={{ width: '100%' }}
        min={min}
        max={max}
        step={0.5}
        addonAfter={key === 'rakeDeg' ? '°' : 'm'}
        value={venue?.[key] ?? DEFAULT_VENUE[key]}
        onChange={(value) => {
          if (value == null) return;
          setVenue.mutate({ ...DEFAULT_VENUE, ...venue, [key]: value });
        }}
      />
      {hint && <Typography.Text type="secondary" style={{ fontSize: 11 }}>{hint}</Typography.Text>}
    </Col>
  );

  const tooLow = venue && venue.clearHeightM > 0 && rigHeightM > venue.clearHeightM;

  return (
    <Card
      size="small"
      title={t('venue.title')}
      loading={loading}
      extra={
        venue && (
          <Popconfirm title={t('venue.removeConfirm')} onConfirm={() => remove.mutate()} okText={t('common.delete')} cancelText={t('common.cancel')}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        )
      }
    >
      {!venue ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('venue.none')}>
          <Button type="primary" loading={setVenue.isPending} onClick={() => setVenue.mutate(DEFAULT_VENUE)}>
            {t('venue.add')}
          </Button>
        </Empty>
      ) : (
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          {tooLow && (
            <Alert
              type="error"
              showIcon
              message={t('venue.tooLow', { rig: rigHeightM.toFixed(1), clear: venue.clearHeightM.toFixed(1) })}
            />
          )}

          <Row gutter={[8, 8]}>
            {field('widthM', t('venue.width'), undefined, 1)}
            {field('depthM', t('venue.depth'), undefined, 1)}
            {field('clearHeightM', t('venue.clearHeight'), t('venue.clearHeightHint'), 0, 200)}
            {field('behindStageM', t('venue.behindStage'))}
            {field('stageOffsetXM', t('venue.stageOffset'), undefined, -500)}
            {field('rakeDeg', t('venue.rake'), undefined, 0, 45)}
          </Row>

          <Flex gap={8} align="center" wrap>
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={(file) => {
                upload.mutate(file);
                return false;
              }}
            >
              <Button size="small" icon={<UploadOutlined />} loading={upload.isPending}>
                {venue.planAttachmentId ? t('venue.replacePlan') : t('venue.uploadPlan')}
              </Button>
            </Upload>
            {venue.planAttachmentId && (
              <Button size="small" type={venue.planMetresPerPixel ? 'default' : 'primary'} onClick={() => setCalibrating(true)}>
                {venue.planMetresPerPixel ? t('venue.recalibrate') : t('venue.calibrate')}
              </Button>
            )}
            {venue.planAttachmentId && !venue.planMetresPerPixel && (
              <Typography.Text type="warning" style={{ fontSize: 12 }}>{t('venue.notScaled')}</Typography.Text>
            )}
          </Flex>

          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('venue.planHint')}</Typography.Text>

          {planUrl && venue.planMetresPerPixel && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('venue.scaleIs', { value: (1 / venue.planMetresPerPixel).toFixed(1) })}
            </Typography.Text>
          )}
        </Space>
      )}

      <PlanCalibrator
        open={calibrating}
        projectId={projectId}
        imageUrl={planUrl}
        onClose={() => setCalibrating(false)}
      />
    </Card>
  );
}
