import { Alert, Button, Col, Drawer, Form, Input, InputNumber, Row, Select, Space, Switch } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ledApi } from '../../api/endpoints';
import {
  LED_PANEL_GROUPS,
  LED_PANEL_TYPES,
  LED_TRANSPORT_KINDS,
  type LedExtenderInput,
  type LedPanelInput,
  type LedProcessorInput,
  type LedRole,
} from '../../api/ledTypes';
import { EquipmentSelect } from '../../components/Selects';
import { useGuardedForm } from '../../components/useGuardedModal';
import { useErrorToast } from '../../utils/errors';

interface Props {
  open: boolean;
  role: LedRole;
  /** Set when an existing item is edited; the equipment can then no longer be changed. */
  equipmentId?: string;
  onClose: () => void;
  onSaved: () => void;
}

const PANEL_DEFAULTS = {
  pitchMm: 3.9,
  widthMm: 500,
  heightMm: 1000,
  pixelWidth: 128,
  pixelHeight: 256,
  panelType: 'Flat',
  group: 'Indoor',
  transportKind: 'Case',
  hasExclusiveProcessors: false,
  compatibleProcessorIds: [],
};

/**
 * The LED side of one equipment item. The equipment itself is picked, not created: a panel is an ordinary
 * equipment record, so its name, brand, weight and stock stay on the equipment screens.
 */
export function LedItemDrawer({ open, role, equipmentId, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const showError = useErrorToast();
  const [form] = Form.useForm();
  const editing = !!equipmentId;

  const processors = useQuery({
    queryKey: ['led-inventory', 'Processor', undefined],
    queryFn: () => ledApi.processors(),
    enabled: open && role === 'Panel',
  });

  const existing = useQuery({
    queryKey: ['led-item', role, equipmentId],
    queryFn: async () => {
      const list = role === 'Panel' ? await ledApi.panels({ includeArchived: true })
        : role === 'Processor' ? await ledApi.processors({ includeArchived: true })
        : await ledApi.extenders({ includeArchived: true });
      return list.find((i) => i.equipmentId === equipmentId) ?? null;
    },
    enabled: open && editing,
  });

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editing) {
      if (existing.data) form.setFieldsValue({ ...existing.data, equipmentId });
      return;
    }

    form.setFieldsValue(
      role === 'Panel' ? PANEL_DEFAULTS
        : role === 'Processor' ? { ethernetPorts: 16, optPorts: 0 }
        : { ethernetPorts: 10, fiberPorts: 2 },
    );
  }, [open, editing, role, equipmentId, existing.data, form]);

  const save = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const id = (equipmentId ?? values.equipmentId) as string;
      if (role === 'Panel') return ledApi.savePanel(id, values as unknown as LedPanelInput);
      if (role === 'Processor') return ledApi.saveProcessor(id, values as unknown as LedProcessorInput);
      return ledApi.saveExtender(id, values as unknown as LedExtenderInput);
    },
    onSuccess: () => {
      guard.markSaved();
      onSaved();
    },
    onError: showError,
  });

  const guard = useGuardedForm(open, async () => save.mutateAsync(await form.validateFields()));
  const close = guard.guardClose(onClose);
  const required = [{ required: true, message: t('validation.required') }];

  return (
    <Drawer
      open={open}
      onClose={close}
      width={560}
      title={t(editing ? 'led.editTitle' : 'led.addTitle', { role: t(`enums.ledRole.${role}`) })}
      destroyOnHidden
      extra={
        <Space>
          <Button onClick={close}>{t('common.cancel')}</Button>
          <Button type="primary" loading={save.isPending} onClick={() => form.submit()}>
            {t('common.save')}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} onValuesChange={guard.onValuesChange}>
        {!editing && (
          <>
            <Alert type="info" showIcon style={{ marginBottom: 16 }} message={t('led.pickEquipmentHint')} />
            <Form.Item name="equipmentId" label={t('led.equipment')} rules={required}>
              <EquipmentSelect />
            </Form.Item>
          </>
        )}

        {role === 'Panel' && (
          <>
            <Row gutter={12}>
              <Col xs={12} md={8}>
                <Form.Item name="pitchMm" label={t('led.pitch')} rules={required}>
                  <InputNumber min={0.01} max={1000} step={0.1} style={{ width: '100%' }} addonAfter="mm" />
                </Form.Item>
              </Col>
              <Col xs={12} md={8}>
                <Form.Item name="widthMm" label={t('led.width')} rules={required}>
                  <InputNumber min={1} max={100000} style={{ width: '100%' }} addonAfter="mm" />
                </Form.Item>
              </Col>
              <Col xs={12} md={8}>
                <Form.Item name="heightMm" label={t('led.height')} rules={required}>
                  <InputNumber min={1} max={100000} style={{ width: '100%' }} addonAfter="mm" />
                </Form.Item>
              </Col>
              <Col xs={12} md={8}>
                <Form.Item name="pixelWidth" label={t('led.pixelWidth')} rules={required}>
                  <InputNumber min={1} max={1000000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={12} md={8}>
                <Form.Item name="pixelHeight" label={t('led.pixelHeight')} rules={required}>
                  <InputNumber min={1} max={1000000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={12} md={8}>
                <Form.Item name="panelType" label={t('led.panelType')} rules={required}>
                  <Select options={LED_PANEL_TYPES.map((v) => ({ value: v, label: t(`enums.ledPanelType.${v}`) }))} />
                </Form.Item>
              </Col>
              <Col xs={12} md={8}>
                <Form.Item name="group" label={t('led.group')} rules={required}>
                  <Select options={LED_PANEL_GROUPS.map((v) => ({ value: v, label: t(`enums.ledPanelGroup.${v}`) }))} />
                </Form.Item>
              </Col>
              <Col xs={12} md={8}>
                <Form.Item name="wattMax" label={t('led.wattMax')} extra={t('led.wattHint')}>
                  <InputNumber min={0} max={100000} style={{ width: '100%' }} addonAfter="W" />
                </Form.Item>
              </Col>
              <Col xs={12} md={8}>
                <Form.Item name="wattAvg" label={t('led.wattAvg')}>
                  <InputNumber min={0} max={100000} style={{ width: '100%' }} addonAfter="W" />
                </Form.Item>
              </Col>
              <Col xs={12} md={8}>
                <Form.Item name="maxLink" label={t('led.maxLink')} extra={t('led.linkHint')}>
                  <InputNumber min={1} max={10000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={12} md={8}>
                <Form.Item name="avgLink" label={t('led.avgLink')}>
                  <InputNumber min={1} max={10000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={12}>
              <Col xs={8}>
                <Form.Item name="angleMin" label={t('led.angleMin')} extra={t('led.angleHint')}>
                  <InputNumber min={-180} max={180} step={0.5} style={{ width: '100%' }} addonAfter="°" />
                </Form.Item>
              </Col>
              <Col xs={8}>
                <Form.Item name="angleMax" label={t('led.angleMax')}>
                  <InputNumber min={-180} max={180} step={0.5} style={{ width: '100%' }} addonAfter="°" />
                </Form.Item>
              </Col>
              <Col xs={8}>
                <Form.Item name="angleStep" label={t('led.angleStep')}>
                  <InputNumber min={0.01} max={180} step={0.5} style={{ width: '100%' }} addonAfter="°" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={12}>
              <Col xs={12} md={6}>
                <Form.Item name="transportKind" label={t('led.transportKind')} rules={required}>
                  <Select options={LED_TRANSPORT_KINDS.map((v) => ({ value: v, label: t(`enums.ledTransportKind.${v}`) }))} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item name="casePanelCount" label={t('led.casePanelCount')}>
                  <InputNumber min={1} max={1000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item name="caseDimensionsCm" label={t('led.caseDimensions')} extra={t('led.caseDimensionsHint')}>
                  <Input placeholder="72x60x100" maxLength={50} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item name="caseWeightKg" label={t('led.caseWeight')}>
                  <InputNumber min={0} max={100000} style={{ width: '100%' }} addonAfter="kg" />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item name="maxStack" label={t('led.maxStack')}>
                  <InputNumber min={1} max={10} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={12} md={9}>
                <Form.Item name="receivingCard" label={t('led.receivingCard')}>
                  <Input maxLength={100} placeholder="Novastar A8s" />
                </Form.Item>
              </Col>
              <Col xs={12} md={9}>
                <Form.Item name="pwmHz" label={t('led.pwmHz')}>
                  <InputNumber min={1} max={1000000} style={{ width: '100%' }} addonAfter="Hz" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="hasExclusiveProcessors" label={t('led.exclusiveProcessors')} valuePropName="checked" extra={t('led.exclusiveHint')}>
              <Switch />
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(a, b) => a.hasExclusiveProcessors !== b.hasExclusiveProcessors}>
              {({ getFieldValue }) =>
                getFieldValue('hasExclusiveProcessors') ? (
                  <Form.Item name="compatibleProcessorIds" label={t('led.compatibleProcessors')} rules={required}>
                    <Select
                      mode="multiple"
                      loading={processors.isFetching}
                      optionFilterProp="label"
                      options={(processors.data ?? []).map((p) => ({ value: p.equipmentId, label: `${p.code} · ${p.name}` }))}
                    />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
          </>
        )}

        {role === 'Processor' && (
          <Row gutter={12}>
            <Col xs={12}>
              <Form.Item name="totalPixels" label={t('led.totalPixels')} rules={required}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12}>
              <Form.Item name="ethernetPorts" label={t('led.ethernetPorts')} rules={required}>
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12}>
              <Form.Item name="pixelsPerPort" label={t('led.pixelsPerPort')} extra={t('led.pixelsPerPortHint')}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12}>
              <Form.Item name="optPorts" label={t('led.optPorts')} extra={t('led.optPortsHint')} rules={required}>
                <InputNumber min={0} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        )}

        {role === 'Extender' && (
          <Row gutter={12}>
            <Col xs={8}>
              <Form.Item name="ethernetPorts" label={t('led.ethernetPorts')} rules={required}>
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={8}>
              <Form.Item name="fiberPorts" label={t('led.fiberPorts')} rules={required}>
                <InputNumber min={0} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={8}>
              <Form.Item name="maxPixels" label={t('led.maxPixels')} rules={required}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        )}
      </Form>
    </Drawer>
  );
}
