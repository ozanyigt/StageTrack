import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Empty, Flex, Segmented, Space, Tag, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ledApi } from '../../api/endpoints';
import type { LedRole } from '../../api/ledTypes';
import type { EquipmentDetail } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { LedItemDrawer } from '../led/LedItemDrawer';

const ROLES: LedRole[] = ['Panel', 'Processor', 'Extender'];

/**
 * The LED side of this product, on the product's own card. A panel is an ordinary equipment record with a pitch
 * and a pixel count; keeping those on a separate inventory screen meant two places to look for one thing, so the
 * technical data now lives where the rest of the product does.
 */
export function EquipmentLedTab({ equipment }: { equipment: EquipmentDetail }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<LedRole | null>(null);
  const [adding, setAdding] = useState<LedRole>('Panel');
  const manage = can(Permissions.LedManage);

  /** One equipment is at most one of the three, so the first list it turns up in is its role. */
  const spec = useQuery({
    queryKey: ['led-spec', equipment.id],
    queryFn: async () => {
      const [panels, processors, extenders] = await Promise.all([
        ledApi.panels({ includeArchived: true }),
        ledApi.processors({ includeArchived: true }),
        ledApi.extenders({ includeArchived: true }),
      ]);
      const panel = panels.find((p) => p.equipmentId === equipment.id);
      if (panel) return { role: 'Panel' as LedRole, panel };
      const processor = processors.find((p) => p.equipmentId === equipment.id);
      if (processor) return { role: 'Processor' as LedRole, processor };
      const extender = extenders.find((e) => e.equipmentId === equipment.id);
      if (extender) return { role: 'Extender' as LedRole, extender };
      return null;
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['led-spec', equipment.id] });
    void queryClient.invalidateQueries({ queryKey: ['led-inventory'] });
  };

  if (spec.isLoading) return <Card loading />;

  if (!spec.data) {
    return (
      <>
        <Card>
          <Empty description={t('ledTab.notInLed')}>
            {manage && (
              <Space direction="vertical">
                <Segmented
                  value={adding}
                  onChange={(value) => setAdding(value as LedRole)}
                  options={ROLES.map((role) => ({ value: role, label: t(`enums.ledRole.${role}`) }))}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(adding)}>
                  {t('ledTab.addToLed')}
                </Button>
              </Space>
            )}
          </Empty>
        </Card>
        <LedItemDrawer
          open={editing !== null}
          role={editing ?? adding}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      </>
    );
  }

  const { role, panel, processor, extender } = spec.data as {
    role: LedRole;
    panel?: Awaited<ReturnType<typeof ledApi.panels>>[number];
    processor?: Awaited<ReturnType<typeof ledApi.processors>>[number];
    extender?: Awaited<ReturnType<typeof ledApi.extenders>>[number];
  };

  return (
    <>
      <Card
        size="small"
        title={
          <Space>
            <Tag color="purple">{t(`enums.ledRole.${role}`)}</Tag>
            <Typography.Text type="secondary">{t('ledTab.hint')}</Typography.Text>
          </Space>
        }
        extra={manage && <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(role)}>{t('common.edit')}</Button>}
      >
        <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }} bordered>
          {panel && (
            <>
              <Descriptions.Item label={t('led.pitch')}>{panel.pitchMm} mm</Descriptions.Item>
              <Descriptions.Item label={t('led.panelSize')}>{panel.widthMm} × {panel.heightMm} mm</Descriptions.Item>
              <Descriptions.Item label={t('led.pixels')}>{panel.pixelWidth} × {panel.pixelHeight} px</Descriptions.Item>
              <Descriptions.Item label={t('ledTab.panelType')}>
                {t(`enums.ledPanelType.${panel.panelType}`)} · {t(`enums.ledPanelGroup.${panel.group}`)}
              </Descriptions.Item>
              <Descriptions.Item label={t('ledTab.transport')}>{t(`enums.ledTransportKind.${panel.transportKind}`)}</Descriptions.Item>
              <Descriptions.Item label={t('ledTab.compatibleProcessors')}>{panel.compatibleProcessorIds?.length ?? 0}</Descriptions.Item>
            </>
          )}
          {processor && (
            <>
              <Descriptions.Item label={t('led.totalPixels')}>{processor.totalPixels.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label={t('led.ethernetPorts')}>{processor.ethernetPorts}</Descriptions.Item>
              <Descriptions.Item label={t('led.optPorts')}>{processor.optPorts}</Descriptions.Item>
              {processor.pixelsPerPort != null && (
                <Descriptions.Item label={t('led.pixelsPerPort')}>{processor.pixelsPerPort.toLocaleString()}</Descriptions.Item>
              )}
            </>
          )}
          {extender && (
            <>
              <Descriptions.Item label={t('led.maxPixels')}>{extender.maxPixels.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label={t('led.ethernetPorts')}>{extender.ethernetPorts}</Descriptions.Item>
              <Descriptions.Item label={t('led.fiberPorts')}>{extender.fiberPorts}</Descriptions.Item>
            </>
          )}
        </Descriptions>

        <Flex justify="end" style={{ marginTop: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('ledTab.stockHint')}</Typography.Text>
        </Flex>
      </Card>

      <LedItemDrawer
        open={editing !== null}
        role={editing ?? role}
        equipmentId={equipment.id}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
    </>
  );
}
