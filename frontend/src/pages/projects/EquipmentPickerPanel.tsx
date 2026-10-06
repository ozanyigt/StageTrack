import { HolderOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, Empty, Flex, Input, List, Tag, Tree, Typography, theme } from 'antd';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { equipmentApi, folderApi } from '../../api/endpoints';
import type { Equipment } from '../../api/types';
import { useDebounced } from '../../utils/useDebounced';
import { buildFolderTree } from '../equipment/folderTree';

/** Drag-and-drop payload type for equipment dragged from the picker onto a project section. */
export const EQUIPMENT_DRAG_TYPE = 'application/x-stagetrack-equipment';

/**
 * Left side of the project's equipment tab: the equipment folders (as in the equipment module), a search box and
 * the items of the selected folder. Items are dragged onto a section on the right, or added with "+".
 */
export function EquipmentPickerPanel({
  targetLabel,
  includeAccessories,
  onIncludeAccessoriesChange,
  onAdd,
}: {
  /** Name of the section "+" adds to. */
  targetLabel: string;
  includeAccessories: boolean;
  onIncludeAccessoriesChange: (value: boolean) => void;
  onAdd: (equipment: Equipment) => void;
}) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [folderId, setFolderId] = useState<string>();
  const [text, setText] = useState('');
  const search = useDebounced(text, 250);
  const { data: folders = [] } = useQuery({ queryKey: ['folders'], queryFn: folderApi.list });
  const list = useQuery({
    queryKey: ['equipment-picker', folderId, search],
    queryFn: () => equipmentApi.list({ folderId, includeSubfolders: true, text: search, maxResultCount: 200 }),
    placeholderData: keepPreviousData,
  });
  // Office/internal equipment is never planned on jobs.
  const items = (list.data?.items ?? []).filter((e) => e.showInQuotes);

  return (
    <Card
      size="small"
      title={t('picker.title')}
      style={{ position: 'sticky', top: 72 }}
      styles={{ body: { padding: 8, maxHeight: 'calc(100vh - 160px)', overflow: 'auto' } }}
    >
      <Input.Search allowClear placeholder={t('equipment.searchPlaceholder')} value={text} onChange={(e) => setText(e.target.value)} />
      <div style={{ margin: '8px 0', paddingBottom: 8, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <Typography.Link onClick={() => setFolderId(undefined)} strong={!folderId} style={{ display: 'block', marginBottom: 4 }}>
          {t('picker.allEquipment')}
        </Typography.Link>
        <Tree
          blockNode
          defaultExpandAll
          treeData={buildFolderTree(folders)}
          selectedKeys={folderId ? [folderId] : []}
          onSelect={(keys) => setFolderId((keys[0] as string) ?? undefined)}
        />
      </div>
      <Flex vertical gap={2} style={{ marginBottom: 6 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('picker.hint', { section: targetLabel })}
        </Typography.Text>
        <Checkbox checked={includeAccessories} onChange={(e) => onIncludeAccessoriesChange(e.target.checked)}>
          {t('sections.includeAccessories')}
        </Checkbox>
      </Flex>
      <List
        size="small"
        loading={list.isFetching}
        dataSource={items}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        renderItem={(e) => (
          <List.Item
            draggable
            onDragStart={(ev) => {
              ev.dataTransfer.setData(EQUIPMENT_DRAG_TYPE, e.id);
              ev.dataTransfer.effectAllowed = 'copy';
            }}
            style={{ cursor: 'grab', paddingInline: 4 }}
            actions={[
              <Button key="add" size="small" type="text" icon={<PlusOutlined />} aria-label={t('common.add')} onClick={() => onAdd(e)} />,
            ]}
          >
            <Flex gap={6} align="start" style={{ minWidth: 0 }}>
              <HolderOutlined style={{ color: token.colorTextQuaternary, marginTop: 4 }} />
              <div style={{ minWidth: 0 }}>
                <Typography.Text strong style={{ fontSize: 12 }}>{e.code}</Typography.Text>{' '}
                <Typography.Text style={{ fontSize: 12 }}>{e.name}</Typography.Text>
                <div>
                  <Tag bordered={false} style={{ fontSize: 11 }}>{t('picker.stock', { count: e.stock })}</Tag>
                </div>
              </div>
            </Flex>
          </List.Item>
        )}
      />
    </Card>
  );
}
