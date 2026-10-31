import { DeleteOutlined, EditOutlined, PlusOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Input, Popconfirm, Segmented, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ledApi } from '../../api/endpoints';
import type { LedExtender, LedPanel, LedProcessor, LedRole } from '../../api/ledTypes';

/** The three roles share the equipment fields and differ after that; the table takes the union. */
type LedRow = LedPanel | LedProcessor | LedExtender;
import { Permissions, useAuth } from '../../auth/AuthContext';
import { useErrorToast } from '../../utils/errors';
import { LedItemDrawer } from './LedItemDrawer';

/**
 * Which equipment items take part in the LED module, and their technical data. There is no "new LED panel" here on
 * purpose: a panel is an ordinary equipment record created on the equipment screens — this is where its pitch,
 * pixels, ports and case are filled in, so one item never exists twice.
 */
export function LedInventoryPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const manage = can(Permissions.LedManage);

  const [role, setRole] = useState<LedRole>('Panel');
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<{ role: LedRole; equipmentId?: string } | null>(null);

  const filter = useMemo(() => ({ text: text.trim() || undefined }), [text]);
  const { data, isFetching } = useQuery<LedRow[]>({
    queryKey: ['led-inventory', role, filter.text],
    queryFn: () =>
      role === 'Panel' ? ledApi.panels(filter) : role === 'Processor' ? ledApi.processors(filter) : ledApi.extenders(filter),
    placeholderData: keepPreviousData,
  });
  const rows = data ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['led-inventory'] });

  const favorite = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => ledApi.setFavorite(id, value),
    onSuccess: refresh,
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => ledApi.removeFromLed(id),
    onSuccess: refresh,
    onError: showError,
  });

  const common = [
    { title: t('equipment.code'), dataIndex: 'code', width: 130 },
    {
      title: t('equipment.name'),
      dataIndex: 'name',
      render: (_: unknown, r: LedRow) => (
        <span>
          {r.name}
          {r.brand && <Typography.Text type="secondary"> · {r.brand}</Typography.Text>}
          {r.isArchived && <Tag style={{ marginInlineStart: 6 }}>{t('equipment.archived')}</Tag>}
        </span>
      ),
    },
    { title: t('equipment.stock'), dataIndex: 'stock', width: 90, align: 'end' as const },
  ];

  const panelColumns = [
    ...(manage
      ? [
          {
            title: '',
            width: 44,
            render: (_: unknown, r: LedPanel) => (
              <Button
                type="text"
                size="small"
                icon={r.isFavorite ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                onClick={() => favorite.mutate({ id: r.equipmentId, value: !r.isFavorite })}
                aria-label={t('led.favorite')}
              />
            ),
          },
        ]
      : []),
    ...common,
    { title: t('led.pitch'), dataIndex: 'pitchMm', width: 90, render: (v: number) => `${v} mm` },
    {
      title: t('led.panelSize'),
      width: 140,
      render: (_: unknown, r: LedPanel) => `${r.widthMm} × ${r.heightMm} mm`,
    },
    {
      title: t('led.pixels'),
      width: 130,
      render: (_: unknown, r: LedPanel) => `${r.pixelWidth} × ${r.pixelHeight}`,
    },
    {
      title: t('led.watt'),
      width: 130,
      render: (_: unknown, r: LedPanel) =>
        r.wattMax == null && r.wattAvg == null ? (
          <Typography.Text type="warning">{t('led.wattMissing')}</Typography.Text>
        ) : (
          `${r.wattMax ?? '—'} / ${r.wattAvg ?? '—'} W`
        ),
    },
    { title: t('led.panelType'), dataIndex: 'panelType', width: 120, render: (v: string) => t(`enums.ledPanelType.${v}`) },
    {
      title: t('led.case'),
      width: 150,
      render: (_: unknown, r: LedPanel) =>
        r.caseDimensionsCm && r.casePanelCount ? (
          `${r.casePanelCount} × ${r.caseDimensionsCm} cm`
        ) : (
          <Typography.Text type="warning">{t('led.caseMissing')}</Typography.Text>
        ),
    },
  ];

  const processorColumns = [
    ...common,
    { title: t('led.totalPixels'), dataIndex: 'totalPixels', width: 140, align: 'end' as const, render: (v: number) => v.toLocaleString() },
    { title: t('led.ethernetPorts'), dataIndex: 'ethernetPorts', width: 110, align: 'end' as const },
    { title: t('led.pixelsPerPort'), dataIndex: 'pixelsPerPort', width: 140, align: 'end' as const, render: (v?: number | null) => (v == null ? '—' : v.toLocaleString()) },
    { title: t('led.optPorts'), dataIndex: 'optPorts', width: 110, align: 'end' as const },
  ];

  const extenderColumns = [
    ...common,
    { title: t('led.ethernetPorts'), dataIndex: 'ethernetPorts', width: 110, align: 'end' as const },
    { title: t('led.fiberPorts'), dataIndex: 'fiberPorts', width: 110, align: 'end' as const },
    { title: t('led.maxPixels'), dataIndex: 'maxPixels', width: 140, align: 'end' as const, render: (v: number) => v.toLocaleString() },
  ];

  const actions = manage
    ? [
        {
          title: '',
          width: 90,
          render: (_: unknown, r: LedRow) => (
            <Space size={0}>
              <Tooltip title={t('common.edit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => setEditing({ role, equipmentId: r.equipmentId })}
                />
              </Tooltip>
              <Popconfirm title={t('led.removeConfirm')} description={t('led.removeHint')} onConfirm={() => remove.mutate(r.equipmentId)}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} />
              </Popconfirm>
            </Space>
          ),
        },
      ]
    : [];

  const columns = (role === 'Panel' ? [...panelColumns, ...actions] : role === 'Processor' ? [...processorColumns, ...actions] : [...extenderColumns, ...actions]) as ColumnsType<LedRow>;

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('led.inventoryTitle')}</Typography.Title>
        {manage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({ role })}>
            {t('led.addEquipment')}
          </Button>
        )}
      </div>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Flex gap={12} wrap align="center">
          <Segmented
            value={role}
            onChange={(v) => setRole(v as LedRole)}
            options={[
              { value: 'Panel', label: t('led.panels') },
              { value: 'Processor', label: t('led.processors') },
              { value: 'Extender', label: t('led.extenders') },
            ]}
          />
          <Input.Search
            allowClear
            style={{ maxWidth: 320 }}
            placeholder={t('equipment.searchPlaceholder')}
            onSearch={setText}
            onChange={(e) => !e.target.value && setText('')}
          />
        </Flex>
      </Card>

      <Table
        size="small"
        rowKey="equipmentId"
        loading={isFetching}
        dataSource={rows}
        columns={columns}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: t('led.inventoryEmpty') }}
      />

      <LedItemDrawer
        open={!!editing}
        role={editing?.role ?? role}
        equipmentId={editing?.equipmentId}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
    </>
  );
}
