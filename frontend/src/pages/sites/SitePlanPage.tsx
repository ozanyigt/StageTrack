import { AimOutlined, BulbOutlined, DeleteOutlined, EnvironmentOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Checkbox, Col, Empty, Flex, Input, InputNumber, Row, Segmented, Select, Slider, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { equipmentApi, projectApi, sitePlanApi } from '../../api/endpoints';
import type { SiteBaseLayer, SitePlan } from '../../api/siteTypes';
import type { EquipmentLookup } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { useErrorToast } from '../../utils/errors';
import { SiteMap, type SiteMapHandle } from './SiteMap';
import { SitePowerCard } from './SitePowerCard';
import { SiteZoneTools } from './SiteZoneTools';

/**
 * A job's site plan. What makes it worth having over a drawing tool: everything placed here is a real equipment
 * record, so the plan is also a reservation — the same inventory the warehouse scans out and the quote prices.
 */
export function SitePlanPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { modal } = App.useApp();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const manage = can(Permissions.ProjectsManage);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [arming, setArming] = useState<{ equipment?: EquipmentLookup; label?: string } | null>(null);
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  const [layerForNew, setLayerForNew] = useState<string>('Structures');
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [drawing, setDrawing] = useState(false);
  const mapHandle = useRef<SiteMapHandle | null>(null);

  const jobs = useQuery({
    queryKey: ['projects', 'site-plan-picker'],
    queryFn: () => projectApi.list({ statuses: ['Draft', 'Pending', 'Confirmed', 'Prepped', 'OnLocation'], maxResultCount: 300, sorting: 'planStart' }),
  });

  const planKey = ['site-plan', projectId];
  const plan = useQuery({
    queryKey: planKey,
    queryFn: () => sitePlanApi.byProject(projectId!),
    enabled: !!projectId,
  });

  const data = plan.data ?? null;
  const put = (next: SitePlan) => queryClient.setQueryData(planKey, next);

  const create = useMutation({
    mutationFn: () => {
      const job = jobs.data?.items.find((j) => j.id === projectId);
      // A new plan opens on the firm's own country rather than the middle of the ocean; the user then searches.
      return sitePlanApi.create({ projectId: projectId!, name: job?.venue ?? job?.name, centreLat: 39.9334, centreLng: 32.8597 });
    },
    onSuccess: put,
    onError: showError,
  });

  const addItem = useMutation({
    mutationFn: (at: { lat: number; lng: number }) =>
      sitePlanApi.addItem(data!.id, {
        equipmentId: arming?.equipment?.id ?? null,
        label: arming?.equipment ? null : arming?.label ?? t('site.marker'),
        quantity: 1,
        lat: at.lat,
        lng: at.lng,
        layer: layerForNew,
      }),
    onSuccess: (next) => {
      put(next);
      setSelectedId(next.items[next.items.length - 1]?.id ?? null);
    },
    onError: showError,
  });

  const moveItem = useMutation({
    mutationFn: ({ id, lat, lng, rotationDeg }: { id: string; lat: number; lng: number; rotationDeg: number }) =>
      sitePlanApi.moveItem(data!.id, id, { lat, lng, rotationDeg }),
    onSuccess: put,
    onError: showError,
  });

  const updateItem = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof sitePlanApi.updateItem>[2] }) =>
      sitePlanApi.updateItem(data!.id, id, input),
    onSuccess: put,
    onError: showError,
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => sitePlanApi.removeItem(data!.id, id),
    onSuccess: (next) => {
      put(next);
      setSelectedId(null);
    },
    onError: showError,
  });

  const saveView = useMutation({
    mutationFn: (patch: Partial<{ baseLayer: SiteBaseLayer; nightMode: boolean }>) => {
      const view = mapHandle.current?.view();
      return sitePlanApi.updateView(data!.id, {
        centreLat: view?.lat ?? data!.centreLat,
        centreLng: view?.lng ?? data!.centreLng,
        zoom: view?.zoom ?? data!.zoom,
        baseLayer: patch.baseLayer ?? data!.baseLayer,
        nightMode: patch.nightMode ?? data!.nightMode,
      });
    },
    onSuccess: put,
    onError: showError,
  });

  const equipment = useQuery({
    queryKey: ['equipment-lookup', 'site-plan'],
    queryFn: () => equipmentApi.lookup(undefined, false),
  });

  const selected = data?.items.find((i) => i.id === selectedId) ?? null;

  /** What the plan puts on the ground against what the firm owns — the shortage worth seeing before the job. */
  const shortages = useMemo(() => {
    const need = new Map<string, { code: string; need: number; stock: number }>();
    for (const item of data?.items ?? []) {
      if (!item.equipmentId) continue;
      const row = need.get(item.equipmentId) ?? { code: item.equipmentCode ?? '?', need: 0, stock: item.equipmentStock };
      row.need += item.quantity;
      need.set(item.equipmentId, row);
    }

    return [...need.values()].filter((r) => r.need > r.stock);
  }, [data]);

  const onDropAt = useCallback(
    (lat: number, lng: number) => {
      if (!arming || !data) return;
      addItem.mutate({ lat, lng });
      setArming(null);
    },
    [arming, data, addItem],
  );

  if (!projectId) {
    return (
      <>
        <Typography.Title level={3} style={{ marginTop: 0 }}>{t('site.title')}</Typography.Title>
        <Card>
          <Select
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 320, maxWidth: 480 }}
            placeholder={t('site.pickJob')}
            loading={jobs.isLoading}
            onChange={(id) => navigate(`/site-plan/${id}`)}
            options={(jobs.data?.items ?? []).map((j) => ({ value: j.id, label: `${j.number} · ${j.name}` }))}
          />
          <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
            {t('site.pickJobHint')}
          </Typography.Paragraph>
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <Space wrap>
          <Typography.Title level={3} style={{ margin: 0 }}>{t('site.title')}</Typography.Title>
          <Select
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 260 }}
            value={projectId}
            loading={jobs.isLoading}
            onChange={(id) => {
              setSelectedId(null);
              navigate(`/site-plan/${id}`);
            }}
            options={(jobs.data?.items ?? []).map((j) => ({ value: j.id, label: `${j.number} · ${j.name}` }))}
          />
          {data?.venue && <Tag icon={<EnvironmentOutlined />}>{data.venue}</Tag>}
        </Space>

        {data && (
          <Space wrap>
            <Segmented
              value={data.baseLayer}
              onChange={(v) => saveView.mutate({ baseLayer: v as SiteBaseLayer })}
              options={[
                { value: 'Satellite', label: t('site.satellite') },
                { value: 'Street', label: t('site.street') },
              ]}
            />
            <Tooltip title={t('site.nightHint')}>
              <Button
                icon={<BulbOutlined />}
                type={data.nightMode ? 'primary' : 'default'}
                onClick={() => saveView.mutate({ nightMode: !data.nightMode })}
              >
                {t('site.night')}
              </Button>
            </Tooltip>
            <Tooltip title={t('site.saveViewHint')}>
              <Button icon={<SaveOutlined />} loading={saveView.isPending} onClick={() => saveView.mutate({})} />
            </Tooltip>
          </Space>
        )}
      </div>

      {!data ? (
        <Card>
          <Empty description={t('site.noPlanYet')}>
            {manage && (
              <Button type="primary" icon={<PlusOutlined />} loading={create.isPending} onClick={() => create.mutate()}>
                {t('site.createPlan')}
              </Button>
            )}
          </Empty>
        </Card>
      ) : (
        <Row gutter={[12, 12]}>
          <Col xs={24} xl={6}>
            <Card size="small" title={t('site.place')}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Select
                  showSearch
                  allowClear
                  style={{ width: '100%' }}
                  placeholder={t('site.pickEquipment')}
                  optionFilterProp="label"
                  loading={equipment.isFetching}
                  value={arming?.equipment?.id}
                  onChange={(id) => setArming(id ? { equipment: (equipment.data ?? []).find((e) => e.id === id) } : null)}
                  options={(equipment.data ?? []).map((e) => ({ value: e.id, label: `${e.code} · ${e.name}` }))}
                />
                <Button block icon={<AimOutlined />} onClick={() => setArming({ label: t('site.marker') })}>
                  {t('site.addMarker')}
                </Button>
                <Select
                  style={{ width: '100%' }}
                  value={layerForNew}
                  onChange={setLayerForNew}
                  options={data.layers.map((l) => ({ value: l, label: t(`site.layer.${l}`, { defaultValue: l }) }))}
                />
                {arming && (
                  <Alert
                    type="info"
                    showIcon
                    message={t('site.clickToPlace')}
                    action={<a onClick={() => setArming(null)}>{t('common.cancel')}</a>}
                  />
                )}
              </Space>
            </Card>

            <Card size="small" title={t('site.layers')} style={{ marginTop: 12 }}>
              <Space direction="vertical">
                {data.layers.map((layer) => (
                  <Checkbox
                    key={layer}
                    checked={!hiddenLayers.has(layer)}
                    onChange={(e) =>
                      setHiddenLayers((current) => {
                        const next = new Set(current);
                        if (e.target.checked) next.delete(layer);
                        else next.add(layer);
                        return next;
                      })
                    }
                  >
                    {t(`site.layer.${layer}`, { defaultValue: layer })}
                  </Checkbox>
                ))}
              </Space>
            </Card>

            <SitePowerCard plan={data} />

            {shortages.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 12 }}
                message={t('site.shortage')}
                description={shortages.map((s) => `${s.code}: ${s.need} / ${s.stock}`).join(' · ')}
              />
            )}
          </Col>

          <Col xs={24} xl={12}>
            <Card size="small" styles={{ body: { padding: 0, height: 620 } }}>
              <SiteMap
                centre={{ lat: data.centreLat, lng: data.centreLng, zoom: data.zoom }}
                baseLayer={data.baseLayer}
                nightMode={data.nightMode}
                items={data.items}
                zones={data.zones}
                hiddenLayers={hiddenLayers}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMove={(id, lat, lng) => {
                  const item = data.items.find((i) => i.id === id);
                  moveItem.mutate({ id, lat, lng, rotationDeg: item?.rotationDeg ?? 0 });
                }}
                onDropAt={arming ? onDropAt : null}
                onDrawPoint={drawing ? (lat, lng) => setDraft((d) => [...d, [lat, lng]]) : null}
                draft={draft}
                handleRef={(h) => (mapHandle.current = h)}
              />
            </Card>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 6 }}>
              {t('site.mapHint')}
            </Typography.Paragraph>
          </Col>

          <Col xs={24} xl={6}>
            <Card size="small" title={t('site.selected')}>
              {!selected ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('site.pickOnMap')} />
              ) : (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <div>
                    <Typography.Text strong>{selected.equipmentCode ?? selected.label}</Typography.Text>
                    {selected.equipmentName && (
                      <div><Typography.Text type="secondary">{selected.equipmentName}</Typography.Text></div>
                    )}
                    {selected.equipmentId && (
                      <Tag color={selected.quantity > selected.equipmentStock ? 'red' : 'blue'} style={{ marginTop: 4 }}>
                        {t('site.stockOf', { need: selected.quantity, stock: selected.equipmentStock })}
                      </Tag>
                    )}
                  </div>

                  <Input
                    addonBefore={t('site.label')}
                    value={selected.label ?? ''}
                    placeholder={selected.equipmentName ?? ''}
                    onChange={(e) => updateItem.mutate({ id: selected.id, input: { ...toInput(selected), label: e.target.value || null } })}
                  />
                  <InputNumber
                    addonBefore={t('site.quantity')}
                    min={1}
                    max={100000}
                    style={{ width: '100%' }}
                    value={selected.quantity}
                    onChange={(v) => v != null && updateItem.mutate({ id: selected.id, input: { ...toInput(selected), quantity: v } })}
                  />
                  <Select
                    style={{ width: '100%' }}
                    value={selected.layer ?? undefined}
                    placeholder={t('site.layers')}
                    onChange={(layer) => updateItem.mutate({ id: selected.id, input: { ...toInput(selected), layer } })}
                    options={data.layers.map((l) => ({ value: l, label: t(`site.layer.${l}`, { defaultValue: l }) }))}
                  />
                  <div>
                    <Typography.Text type="secondary">{t('site.rotation')}</Typography.Text>
                    <Slider
                      min={0}
                      max={359}
                      value={selected.rotationDeg}
                      onChangeComplete={(v) => moveItem.mutate({ id: selected.id, lat: selected.lat, lng: selected.lng, rotationDeg: v })}
                    />
                  </div>

                  <Flex gap={8} align="center">
                    <Typography.Text type="secondary">{t('site.isLight')}</Typography.Text>
                    <Switch
                      size="small"
                      checked={selected.isLight}
                      onChange={(on) =>
                        updateItem.mutate({
                          id: selected.id,
                          input: { ...toInput(selected), lightHeightM: on ? 8 : null, lightIntensity: on ? 70 : null, lightRadiusM: null },
                        })
                      }
                    />
                  </Flex>
                  {selected.isLight && (
                    <>
                      <InputNumber
                        addonBefore={t('site.lightHeight')}
                        addonAfter="m"
                        min={0.1}
                        max={200}
                        step={0.5}
                        style={{ width: '100%' }}
                        value={selected.lightHeightM ?? undefined}
                        onChange={(v) => v != null && updateItem.mutate({ id: selected.id, input: { ...toInput(selected), lightHeightM: v } })}
                      />
                      <div>
                        <Typography.Text type="secondary">{t('site.lightIntensity')}</Typography.Text>
                        <Slider
                          min={0}
                          max={100}
                          value={selected.lightIntensity ?? 70}
                          onChangeComplete={(v) => updateItem.mutate({ id: selected.id, input: { ...toInput(selected), lightIntensity: v } })}
                        />
                      </div>
                      <InputNumber
                        addonBefore={t('site.lightRadius')}
                        addonAfter="m"
                        min={0.1}
                        max={1000}
                        style={{ width: '100%' }}
                        value={selected.lightRadiusM ?? undefined}
                        onChange={(v) => updateItem.mutate({ id: selected.id, input: { ...toInput(selected), lightRadiusM: v } })}
                      />
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('site.lightHint')}</Typography.Text>
                    </>
                  )}

                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() =>
                      modal.confirm({
                        title: t('site.removeItem'),
                        onOk: () => removeItem.mutateAsync(selected.id),
                      })
                    }
                  >
                    {t('common.delete')}
                  </Button>
                </Space>
              )}
            </Card>

            <SiteZoneTools
              plan={data}
              draft={draft}
              drawing={drawing}
              onDrawingChange={(on) => {
                setDrawing(on);
                setDraft([]);
                if (on) setArming(null);
              }}
              onDraftChange={setDraft}
              onSaved={put}
            />
          </Col>
        </Row>
      )}
    </>
  );
}

/** The update endpoint takes the whole item; this keeps the fields that are not being changed. */
const toInput = (item: SitePlan['items'][number]) => ({
  label: item.label,
  quantity: item.quantity,
  layer: item.layer,
  notes: item.notes,
  lightHeightM: item.lightHeightM,
  lightIntensity: item.lightIntensity,
  lightRadiusM: item.lightRadiusM,
});
