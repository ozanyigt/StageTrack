import { AimOutlined, LoginOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Flex, Slider, Space, Typography } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { sitePlanApi } from '../../api/endpoints';
import type { SitePlan } from '../../api/siteTypes';
import { useErrorToast } from '../../utils/errors';

interface Props {
  plan: SitePlan;
  placing: boolean;
  onPlacing: (placing: boolean) => void;
  onSaved: (plan: SitePlan) => void;
  onEnter: () => void;
}

/**
 * Where the building stands on the ground. Until this is set the map and the venue plan are two unrelated
 * drawings; once it is, the site plan shows the hall with the generators, the trucks and the cable routes
 * around it, and stepping inside is a click rather than a different product.
 */
export function VenueOnMapCard({ plan, placing, onPlacing, onSaved, onEnter }: Props) {
  const { t } = useTranslation();
  const showError = useErrorToast();

  const setRotation = useMutation({
    mutationFn: (mapRotationDeg: number) =>
      sitePlanApi.setVenueOnMap(plan.id, {
        originLat: plan.venue?.originLat ?? null,
        originLng: plan.venue?.originLng ?? null,
        mapRotationDeg,
      }),
    onSuccess: onSaved,
    onError: showError,
  });

  if (!plan.venue) {
    return (
      <Card size="small" title={t('venue.onMap')}>
        <Alert type="info" showIcon message={t('venue.noRoomYet')} description={t('venue.noRoomYetHint')} />
      </Card>
    );
  }

  const placed = plan.venue.originLat != null && plan.venue.originLng != null;

  return (
    <Card size="small" title={t('venue.onMap')}>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('venue.roomSize', { w: plan.venue.widthM, d: plan.venue.depthM })}
        </Typography.Text>

        <Flex gap={8} wrap>
          <Button
            type={placing ? 'primary' : 'default'}
            icon={<AimOutlined />}
            onClick={() => onPlacing(!placing)}
          >
            {placed ? t('venue.moveOnMap') : t('venue.placeOnMap')}
          </Button>
          {placed && (
            <Button icon={<LoginOutlined />} onClick={onEnter}>
              {t('venue.enter')}
            </Button>
          )}
        </Flex>

        {placing && <Typography.Text type="secondary">{t('venue.clickGround')}</Typography.Text>}

        {placed && (
          <>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('venue.facing', { deg: Math.round(plan.venue.mapRotationDeg) })}
            </Typography.Text>
            <Slider
              min={0}
              max={359}
              value={Math.round(plan.venue.mapRotationDeg)}
              tooltip={{ formatter: (v) => `${v}°` }}
              onChangeComplete={(value) => setRotation.mutate(value)}
            />
          </>
        )}
      </Space>
    </Card>
  );
}
