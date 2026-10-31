import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { Button, Card, ColorPicker, Empty, Flex, Input, List, Segmented, Space, Typography } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sitePlanApi } from '../../api/endpoints';
import type { SitePlan, SiteZoneKind } from '../../api/siteTypes';
import { useErrorToast } from '../../utils/errors';

interface Props {
  plan: SitePlan;
  /** The shape being drawn, click by click. */
  draft: [number, number][];
  drawing: boolean;
  onDrawingChange: (on: boolean) => void;
  onDraftChange: (points: [number, number][]) => void;
  onSaved: (plan: SitePlan) => void;
}

/**
 * Areas, routes and barriers. The size is not typed in: an area reports the ground it actually covers and a route
 * its real length, worked out on the server from the corners — so what the plan claims and what the ground is
 * cannot drift apart.
 */
export function SiteZoneTools({ plan, draft, drawing, onDrawingChange, onDraftChange, onSaved }: Props) {
  const { t } = useTranslation();
  const showError = useErrorToast();
  const [kind, setKind] = useState<SiteZoneKind>('Area');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#1677ff');

  const save = useMutation({
    mutationFn: () =>
      sitePlanApi.addZone(plan.id, {
        name: name.trim() || t(`enums.siteZoneKind.${kind}`),
        kind,
        points: draft,
        color,
        layer: 'Public',
      }),
    onSuccess: (next) => {
      onSaved(next);
      onDrawingChange(false);
      setName('');
    },
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: (zoneId: string) => sitePlanApi.removeZone(plan.id, zoneId),
    onSuccess: onSaved,
    onError: showError,
  });

  const needed = kind === 'Area' ? 3 : 2;

  return (
    <Card size="small" title={t('site.zones')} style={{ marginTop: 12 }}>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {drawing ? (
          <>
            <Segmented
              block
              value={kind}
              onChange={(v) => setKind(v as SiteZoneKind)}
              options={(['Area', 'Route', 'Barrier'] as const).map((k) => ({ value: k, label: t(`enums.siteZoneKind.${k}`) }))}
            />
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('site.zoneName')} maxLength={128} />
            <Flex gap={8} align="center">
              <ColorPicker value={color} onChangeComplete={(c) => setColor(c.toHexString())} />
              <Typography.Text type="secondary">{t('site.zonePoints', { count: draft.length, needed })}</Typography.Text>
            </Flex>
            <Flex gap={8}>
              <Button type="primary" disabled={draft.length < needed} loading={save.isPending} onClick={() => save.mutate()}>
                {t('common.save')}
              </Button>
              <Button disabled={draft.length === 0} onClick={() => onDraftChange(draft.slice(0, -1))}>
                {t('site.undoPoint')}
              </Button>
              <Button onClick={() => onDrawingChange(false)}>{t('common.cancel')}</Button>
            </Flex>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('site.drawHint')}</Typography.Text>
          </>
        ) : (
          <Button block icon={<EditOutlined />} onClick={() => onDrawingChange(true)}>
            {t('site.drawZone')}
          </Button>
        )}

        {plan.zones.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('site.noZones')} />
        ) : (
          <List
            size="small"
            dataSource={plan.zones}
            renderItem={(zone) => (
              <List.Item
                actions={[
                  <Button
                    key="x"
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => remove.mutate(zone.id)}
                    aria-label={t('common.delete')}
                  />,
                ]}
              >
                <Space size={6}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: zone.color }} />
                  <Typography.Text>{zone.name}</Typography.Text>
                  <Typography.Text type="secondary">
                    {zone.areaM2 != null
                      ? `${Math.round(zone.areaM2).toLocaleString()} m²`
                      : zone.lengthM != null
                        ? `${Math.round(zone.lengthM)} m`
                        : ''}
                  </Typography.Text>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Space>
    </Card>
  );
}
