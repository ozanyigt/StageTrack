import { AimOutlined, ColumnWidthOutlined, DeleteOutlined, SwapOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, Empty, Flex, InputNumber, Space, Tag, Tooltip, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { EquipmentDiscipline } from '../../api/types';
import { TRADE_COLOR, type PropPlacements, type StageProp } from './stageProps';

interface Props {
  props: StageProp[];
  placements: PropPlacements;
  selectedId: string | null;
  /** The group the user picked up; the next click on the floor puts it down. */
  armedId: string | null;
  onArm: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  onFlown: (id: string, flown: boolean) => void;
  onRotate: (id: string, degrees: number) => void;
  onReset: (id: string) => void;
  /** Exactly where it goes, typed rather than dragged. */
  onPlaceAt: (id: string, at: { x?: number; z?: number; rotationDeg?: number }) => void;
  /** The same distance the other way across the centre line. */
  onMirror: (id: string) => void;
  /** This trade's placed groups, spaced evenly across the stage. */
  onSpread: (trade: EquipmentDiscipline) => void;
}

/**
 * The groups beside the scene. Two ways to put one down, because both are natural and neither is always
 * possible: drag it onto the stage, or pick it up here and click where it goes - the second is what works on a
 * touch screen and with a trackpad on a laptop in a truck.
 */
export function StagePropsPanel({ props, placements, selectedId, armedId, onArm, onSelect, onFlown, onRotate, onReset, onPlaceAt, onMirror, onSpread }: Props) {
  const { t } = useTranslation();

  if (props.length === 0) {
    return (
      <Card size="small" title={t('draft.sceneGroups')}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('draft.noSceneGroups')} />
      </Card>
    );
  }

  return (
    <Card
      size="small"
      title={t('draft.sceneGroups')}
      extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('draft.dragHint')}</Typography.Text>}
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>{t('draft.nudgeHint')}</Typography.Paragraph>
      <Flex vertical gap={6}>
        {props.map((prop) => {
          const placed = !!placements[prop.id];
          const armed = armedId === prop.id;
          return (
            <div
              key={prop.id}
              draggable
              onDragStart={() => onArm(prop.id)}
              onClick={() => onSelect(prop.id)}
              style={{
                border: `1px solid ${armed || selectedId === prop.id ? TRADE_COLOR[prop.trade] : 'transparent'}`,
                borderRadius: 6,
                padding: '6px 8px',
                cursor: 'grab',
                background: 'rgba(127,127,127,0.06)',
              }}
            >
              <Flex align="center" gap={8} justify="space-between">
                <Flex align="center" gap={8} style={{ minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: TRADE_COLOR[prop.trade], flex: 'none' }} />
                  <Typography.Text ellipsis style={{ maxWidth: 150 }}>{prop.label}</Typography.Text>
                  <Tag>{prop.count}</Tag>
                </Flex>
                <Flex gap={2} onClick={(e) => e.stopPropagation()}>
                  <Tooltip title={t('draft.pickUp')}>
                    <Button size="small" type={armed ? 'primary' : 'text'} icon={<AimOutlined />} onClick={() => onArm(armed ? null : prop.id)} />
                  </Tooltip>
                  <Tooltip title={t('draft.rotate')}>
                    <Button size="small" type="text" onClick={() => onRotate(prop.id, 45)}>45°</Button>
                  </Tooltip>
                  <Tooltip title={t('draft.mirror')}>
                    <Button size="small" type="text" icon={<SwapOutlined />} onClick={() => onMirror(prop.id)} />
                  </Tooltip>
                  <Tooltip title={t('draft.spread')}>
                    <Button size="small" type="text" icon={<ColumnWidthOutlined />} onClick={() => onSpread(prop.trade)} />
                  </Tooltip>
                  {placed && (
                    <Tooltip title={t('draft.unplace')}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onReset(prop.id)} />
                    </Tooltip>
                  )}
                </Flex>
              </Flex>

              {selectedId === prop.id && (
                // Typed to the centimetre: a dragged speaker is never quite where the drawing says it is.
                <Space size={4} style={{ marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
                  <InputNumber
                    size="small"
                    style={{ width: 86 }}
                    step={0.1}
                    addonBefore="x"
                    value={Number(prop.x.toFixed(2))}
                    onChange={(value) => value != null && onPlaceAt(prop.id, { x: value })}
                  />
                  <InputNumber
                    size="small"
                    style={{ width: 86 }}
                    step={0.1}
                    addonBefore="z"
                    value={Number(prop.z.toFixed(2))}
                    onChange={(value) => value != null && onPlaceAt(prop.id, { z: value })}
                  />
                  <InputNumber
                    size="small"
                    style={{ width: 76 }}
                    step={5}
                    min={0}
                    max={360}
                    addonAfter="°"
                    value={Math.round(prop.rotationDeg)}
                    onChange={(value) => value != null && onPlaceAt(prop.id, { rotationDeg: value })}
                  />
                </Space>
              )}

              <Flex gap={12} align="center" style={{ marginTop: 4 }}>
                <Checkbox
                  checked={placements[prop.id]?.flown ?? false}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onFlown(prop.id, e.target.checked)}
                >
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('draft.flown')}</Typography.Text>
                </Checkbox>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {placed ? t('draft.placedAt', { x: prop.x.toFixed(1), z: prop.z.toFixed(1) }) : t('draft.notPlaced')}
                </Typography.Text>
              </Flex>
            </div>
          );
        })}
      </Flex>
    </Card>
  );
}

export const tradeOf = (prop: StageProp): EquipmentDiscipline => prop.trade;
