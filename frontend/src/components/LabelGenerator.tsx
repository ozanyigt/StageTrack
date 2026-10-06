import { CloseOutlined, FilePdfOutlined } from '@ant-design/icons';
import {
  Alert, App, Button, Checkbox, ConfigProvider, Drawer, Empty, Flex, Form, Input, InputNumber, Select, Skeleton, Space, Tabs,
  Typography, theme,
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { equipmentApi, labelApi, labelTemplateApi, unitApi } from '../api/endpoints';
import type { EquipmentUnit, LabelTemplate, PrintLabelItem } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { LabelPreview } from '../pages/equipment/LabelPreview';
import { useErrorToast } from '../utils/errors';

export interface LabelRequest {
  /** Equipment whose labels are generated: serialized ones list all their devices, quantity-tracked ones one label. */
  equipmentIds?: string[];
  /** Devices to pre-select (their equipment's other devices are listed unchecked). */
  unitIds?: string[];
}

interface LabelGeneratorApi {
  open: (request: LabelRequest) => void;
  /** Shows a generated document (PDF) in an in-app tab. */
  openDocument: (title: string, blob: Blob) => void;
  /** Shows a page of the app (e.g. the quote or packing slip print view) in an in-app tab. */
  openPage: (title: string, url: string) => void;
}

const LabelGeneratorContext = createContext<LabelGeneratorApi>({ open: () => undefined, openDocument: () => undefined, openPage: () => undefined });

interface DocumentTab {
  key: string;
  title: string;
  url: string;
  /** Blob URLs are released when the tab closes; app pages are not. */
  isBlob: boolean;
}

export function LabelGeneratorProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<LabelRequest | null>(null);
  const [documents, setDocuments] = useState<DocumentTab[]>([]);
  const [active, setActive] = useState<string>();

  const openDocument = useCallback((title: string, blob: Blob) => {
    const doc = { key: `${Date.now()}-${Math.random()}`, title, url: URL.createObjectURL(blob), isBlob: true };
    setDocuments((list) => [...list, doc]);
    setActive(doc.key);
  }, []);

  const openPage = useCallback((title: string, url: string) => {
    const doc = { key: `${Date.now()}-${Math.random()}`, title, url, isBlob: false };
    setDocuments((list) => [...list, doc]);
    setActive(doc.key);
  }, []);

  const closeDocument = (key: string) =>
    setDocuments((list) => {
      const doc = list.find((d) => d.key === key);
      if (doc?.isBlob) URL.revokeObjectURL(doc.url);
      const rest = list.filter((d) => d.key !== key);
      if (active === key) setActive(rest[rest.length - 1]?.key);
      return rest;
    });

  const closeAll = () =>
    setDocuments((list) => {
      list.forEach((d) => d.isBlob && URL.revokeObjectURL(d.url));
      return [];
    });

  const api = useMemo<LabelGeneratorApi>(() => ({ open: setRequest, openDocument, openPage }), [openDocument, openPage]);

  return (
    <LabelGeneratorContext.Provider value={api}>
      {children}
      {request && <LabelDrawer request={request} onClose={() => setRequest(null)} onGenerated={openDocument} />}
      {documents.length > 0 && <DocumentTabs documents={documents} active={active} onActivate={setActive} onClose={closeDocument} onCloseAll={closeAll} />}
    </LabelGeneratorContext.Provider>
  );
}

export const useLabelGenerator = () => useContext(LabelGeneratorContext);

/** Generated documents in tabs over the app; the browser's PDF viewer gives zoom, rotate, draw, download and print. */
function DocumentTabs({ documents, active, onActivate, onClose, onCloseAll }: {
  documents: DocumentTab[];
  active?: string;
  onActivate: (key: string) => void;
  onClose: (key: string) => void;
  onCloseAll: () => void;
}) {
  const { t } = useTranslation();
  const current = documents.find((d) => d.key === active) ?? documents[documents.length - 1];
  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <div className="no-print" style={{ position: 'fixed', inset: 0, zIndex: 1100, background: '#1b1b1f', display: 'flex', flexDirection: 'column' }}>
        <Flex align="center" style={{ paddingInline: 8, borderBottom: '1px solid #333', minHeight: 44 }}>
          <Tabs
            type="editable-card"
            hideAdd
            size="small"
            activeKey={current?.key}
            onChange={onActivate}
            onEdit={(key, action) => action === 'remove' && onClose(String(key))}
            items={documents.map((d) => ({ key: d.key, label: <span><FilePdfOutlined /> {d.title}</span>, closable: true }))}
            style={{ flex: 1, marginBottom: -1 }}
            tabBarStyle={{ margin: 0, borderBottom: 'none' }}
          />
          <Button type="text" icon={<CloseOutlined />} onClick={onCloseAll} aria-label={t('labelGen.closeAll')} title={t('labelGen.closeAll')} />
        </Flex>
        {current && <iframe key={current.key} src={current.url} title={current.title} style={{ flex: 1, border: 'none', width: '100%', background: '#525659' }} />}
      </div>
    </ConfigProvider>
  );
}

interface Group {
  equipmentId: string;
  code: string;
  name: string;
  isSerialized: boolean;
  units: EquipmentUnit[];
  preChecked: string[];
}

/** Loads every equipment involved in the request with its active devices. */
async function loadGroups(request: LabelRequest): Promise<Group[]> {
  const unitIds = request.unitIds ?? [];
  const requestedUnits = await Promise.all(unitIds.map((id) => unitApi.get(id)));
  const equipmentIds = [...new Set([...(request.equipmentIds ?? []), ...requestedUnits.map((u) => u.equipmentId)])];
  return Promise.all(
    equipmentIds.map(async (equipmentId) => {
      const equipment = await equipmentApi.get(equipmentId);
      const units = equipment.isSerialized
        ? (await unitApi.list({ equipmentId, maxResultCount: 500 })).items.sort((a, b) => a.internalRef.localeCompare(b.internalRef, undefined, { numeric: true }))
        : [];
      const fromEquipment = request.equipmentIds?.includes(equipmentId) ?? false;
      return {
        equipmentId,
        code: equipment.code,
        name: equipment.name,
        isSerialized: equipment.isSerialized,
        units,
        preChecked: fromEquipment ? units.map((u) => u.id) : unitIds.filter((id) => units.some((u) => u.id === id)),
      };
    }),
  );
}

interface PendingRender {
  template: LabelTemplate;
  labels: PrintLabelItem[];
  note: string;
  title: string;
}

/** "Create labels" drawer: template, devices to print (checkboxes), optional note; opens the PDF in an in-app tab. */
function LabelDrawer({ request, onClose, onGenerated }: { request: LabelRequest; onClose: () => void; onGenerated: (title: string, blob: Blob) => void }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const { message } = App.useApp();
  const showError = useErrorToast();
  const templates = useQuery({ queryKey: ['label-templates'], queryFn: labelTemplateApi.list });
  const groups = useQuery({ queryKey: ['label-groups', request], queryFn: () => loadGroups(request), gcTime: 0 });
  const [templateId, setTemplateId] = useState<string>();
  const [checkedUnits, setCheckedUnits] = useState<Set<string>>(new Set());
  const [copies, setCopies] = useState<Record<string, number>>({});
  const [checkedBulk, setCheckedBulk] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingRender | null>(null);
  const renderRoot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!templateId && templates.data?.length) setTemplateId((templates.data.find((x) => x.isDefault) ?? templates.data[0]).id);
  }, [templates.data, templateId]);

  useEffect(() => {
    if (!groups.data) return;
    setCheckedUnits(new Set(groups.data.flatMap((g) => g.preChecked)));
    setCheckedBulk(new Set(groups.data.filter((g) => !g.isSerialized).map((g) => g.equipmentId)));
    setCopies(Object.fromEntries(groups.data.filter((g) => !g.isSerialized).map((g) => [g.equipmentId, 1])));
  }, [groups.data]);

  // Once the hidden labels are on the page, turn each into an image and put one label per PDF page.
  useEffect(() => {
    if (!pending || !renderRoot.current) return;
    let cancelled = false;
    const run = async () => {
      try {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const [{ jsPDF }, { toPng }] = await Promise.all([import('jspdf'), import('html-to-image')]);
        const { widthMm: w, heightMm: h } = pending.template;
        const orientation = w >= h ? 'landscape' : 'portrait';
        const pdf = new jsPDF({ orientation, unit: 'mm', format: [w, h] });
        const nodes = Array.from(renderRoot.current!.querySelectorAll<HTMLElement>('.label-sheet'));
        for (let i = 0; i < nodes.length; i++) {
          const png = await toPng(nodes[i], { pixelRatio: 4, backgroundColor: '#ffffff', cacheBust: true });
          if (i > 0) pdf.addPage([w, h], orientation);
          pdf.addImage(png, 'PNG', 0, 0, w, h);
        }
        if (cancelled) return;
        onGenerated(pending.title, pdf.output('blob'));
        onClose();
      } catch (e) {
        showError(e);
      } finally {
        if (!cancelled) {
          setPending(null);
          setBusy(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [pending, onGenerated, onClose, showError]);

  const template = templates.data?.find((x) => x.id === templateId);
  const selectedCount = checkedUnits.size + [...checkedBulk].reduce((s, id) => s + (copies[id] ?? 1), 0);

  const generate = async () => {
    if (!template || !groups.data) return;
    setBusy(true);
    try {
      const items = await labelApi.preparePrint({ unitIds: [...checkedUnits], equipmentIds: [...checkedBulk], createMissing: true });
      const created = items.filter((x) => x.isNew).length;
      if (created > 0) message.info(t('labelPrint.newCreated', { count: created }));
      const labels = items.flatMap((item) => (item.unitId ? [item] : Array.from({ length: copies[item.equipmentId] ?? 1 }, () => item)));
      if (labels.length === 0) {
        setBusy(false);
        return;
      }
      const single = groups.data.length === 1 ? groups.data[0] : null;
      const title = single
        ? t('labelGen.docTitle', { code: single.code, count: labels.length })
        : t('labelGen.docTitleMany', { count: labels.length });
      setPending({ template, labels, note, title });
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  };

  const toggleUnit = (id: string, on: boolean) =>
    setCheckedUnits((set) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const setGroup = (g: Group, on: boolean) =>
    setCheckedUnits((set) => {
      const next = new Set(set);
      g.units.forEach((u) => (on ? next.add(u.id) : next.delete(u.id)));
      return next;
    });

  return (
    <Drawer
      open
      width={560}
      title={t('labelGen.title')}
      onClose={onClose}
      destroyOnHidden
      footer={
        <Flex justify="space-between" align="center">
          <Typography.Text type="secondary">{t('labelPrint.count', { count: selectedCount })}</Typography.Text>
          <Space>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="primary" loading={busy} disabled={!template || selectedCount === 0} onClick={generate}>
              {t('labelGen.generate')}
            </Button>
          </Space>
        </Flex>
      }
    >
      {templates.data && templates.data.length === 0 && <Alert type="warning" showIcon message={t('labelPrint.noTemplate')} style={{ marginBottom: 12 }} />}
      <Form layout="vertical">
        <Form.Item label={t('labelPrint.template')}>
          <Select
            value={templateId}
            onChange={setTemplateId}
            loading={templates.isLoading}
            options={(templates.data ?? []).map((x) => ({ value: x.id, label: `${x.name} (${x.widthMm}×${x.heightMm} mm)` }))}
          />
        </Form.Item>

        <Typography.Title level={5} style={{ marginTop: 0 }}>
          {t('labelGen.selected')}
        </Typography.Title>
        {groups.isLoading && <Skeleton active />}
        {groups.data?.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('labelPrint.nothing')} />}
        {groups.data?.map((g) => {
          const checkedInGroup = g.units.filter((u) => checkedUnits.has(u.id)).length;
          return (
            <div key={g.equipmentId} style={{ marginBottom: 16 }}>
              <Flex justify="space-between" align="center" style={{ marginBottom: 4 }}>
                <Typography.Text strong>
                  {g.code} · {g.name}
                </Typography.Text>
                {g.isSerialized && g.units.length > 0 && (
                  <Checkbox
                    checked={checkedInGroup === g.units.length}
                    indeterminate={checkedInGroup > 0 && checkedInGroup < g.units.length}
                    onChange={(e) => setGroup(g, e.target.checked)}
                  >
                    {t('labelGen.selectAll')}
                  </Checkbox>
                )}
              </Flex>
              {g.isSerialized ? (
                g.units.length === 0 ? (
                  <Typography.Text type="secondary">{t('labelGen.noDevices')}</Typography.Text>
                ) : (
                  <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid rgba(128,128,128,0.25)', borderRadius: 6 }}>
                    {g.units.map((u) => (
                      <Flex key={u.id} align="center" gap={10} style={{ padding: '6px 10px', borderBottom: '1px solid rgba(128,128,128,0.12)' }}>
                        <Checkbox checked={checkedUnits.has(u.id)} onChange={(e) => toggleUnit(u.id, e.target.checked)} />
                        <Typography.Text strong style={{ minWidth: 110 }}>{u.internalRef}</Typography.Text>
                        <Typography.Text type="secondary">{u.serialNumber ? `S/N ${u.serialNumber}` : ''}</Typography.Text>
                      </Flex>
                    ))}
                  </div>
                )
              ) : (
                <Flex align="center" gap={10}>
                  <Checkbox
                    checked={checkedBulk.has(g.equipmentId)}
                    onChange={(e) =>
                      setCheckedBulk((set) => {
                        const next = new Set(set);
                        if (e.target.checked) next.add(g.equipmentId);
                        else next.delete(g.equipmentId);
                        return next;
                      })
                    }
                  >
                    {t('labelGen.equipmentLabel')}
                  </Checkbox>
                  <InputNumber
                    min={1}
                    max={100}
                    size="small"
                    value={copies[g.equipmentId] ?? 1}
                    onChange={(v) => setCopies((c) => ({ ...c, [g.equipmentId]: v ?? 1 }))}
                    addonAfter={t('labelGen.copies')}
                    style={{ width: 150 }}
                  />
                </Flex>
              )}
            </div>
          );
        })}

        <Form.Item label={t('labelGen.note')} extra={t('labelGen.noteHint')}>
          <Input.TextArea value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} autoSize={{ minRows: 2, maxRows: 4 }} />
        </Form.Item>
      </Form>

      {pending && (
        <div ref={renderRoot} aria-hidden style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }}>
          {pending.labels.map((item, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <LabelPreview template={pending.template} item={item} companyName={company?.name} note={pending.note} />
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
