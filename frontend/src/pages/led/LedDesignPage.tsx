import { DeleteOutlined, ExportOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Empty, Flex, Input, InputNumber, Row, Segmented, Select, Space, Statistic, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { POWER_MODES, type PowerMode } from '../../api/ledTypes';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { LedScreenGrid } from './LedScreenGrid';
import { LedToJobModal } from './LedToJobModal';
import { useLedJob } from './useLedJob';

const VOLTAGES = [110, 220, 230, 240];

/**
 * Screen design: the job's LED walls, drawn to scale, with what each one comes to. Every figure here is the
 * server's — the browser only draws — so this screen, the loading plan and the transfer to a job can never
 * disagree about how many panels a wall needs.
 */
export function LedDesignPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { job, walls, nameOf, panels, panelById, request, evaluation, add, update, remove, setPower, clear } = useLedJob();
  const [transferOpen, setTransferOpen] = useState(false);

  const result = evaluation.data;
  const panelOptions = (panels.data ?? []).map((p) => ({ value: p.equipmentId, label: `${p.code} · ${p.name}` }));

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('led.designTitle')}</Typography.Title>
        <Space wrap>
          {job.screens.length > 0 && (
            <Button onClick={clear}>{t('led.clearJob')}</Button>
          )}
          {can(Permissions.LedQuote) && (
            <Button icon={<ExportOutlined />} disabled={job.screens.length === 0} onClick={() => setTransferOpen(true)}>
              {t('led.transferToJob')}
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={add}>
            {t('led.addScreen')}
          </Button>
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Flex gap={16} wrap align="center">
          <Space>
            <Typography.Text type="secondary">{t('led.voltage')}</Typography.Text>
            <Select
              value={job.voltage}
              style={{ width: 110 }}
              onChange={(v) => setPower(v, job.mode)}
              options={VOLTAGES.map((v) => ({ value: v, label: `${v} V` }))}
            />
          </Space>
          <Segmented
            value={job.mode}
            onChange={(v) => setPower(job.voltage, v as PowerMode)}
            options={POWER_MODES.map((m) => ({ value: m, label: t(`enums.powerMode.${m}`) }))}
          />
          {result?.job.power && (
            <Space size="large" wrap style={{ marginInlineStart: 'auto' }}>
              <Statistic title={t('led.totalWatt')} value={Math.round(result.job.power.totalWattMax)} suffix="W" valueStyle={{ fontSize: 18 }} />
              <Statistic title={t('led.circuits')} value={result.job.power.totalCircuits} valueStyle={{ fontSize: 18 }} />
              <Statistic title={t('led.socapex')} value={result.job.power.totalSocapex} valueStyle={{ fontSize: 18 }} />
              <Statistic title={t('led.perPhase')} value={result.job.power.perPhaseMaxA.toFixed(1)} suffix="A" valueStyle={{ fontSize: 18 }} />
            </Space>
          )}
        </Flex>
      </Card>

      {panels.data?.length === 0 && (
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('led.noPanelsYet')} description={t('led.noPanelsHint')} />
      )}

      {job.screens.length === 0 ? (
        <Card><Empty description={t('led.noScreens')} /></Card>
      ) : (
        <Row gutter={[12, 12]}>
          {job.screens.map((screen, index) => {
            const evaluated = result?.screens.find((s) => s.id === screen.id);
            const panel = screen.panelId ? panelById.get(screen.panelId) : undefined;
            const option = evaluated?.processor?.options[evaluated.processor.selectedIndex];

            return (
              <Col key={screen.id} xs={24} xl={12}>
                <Card
                  size="small"
                  title={
                    <Input
                      variant="borderless"
                      value={screen.name ?? nameOf(walls[index])}
                      onChange={(e) => update(screen.id, { name: e.target.value || null })}
                      style={{ fontWeight: 600, paddingInline: 0 }}
                    />
                  }
                  extra={<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(screen.id)} aria-label={t('common.delete')} />}
                >
                  <Flex gap={16} wrap align="start">
                    <div style={{ flex: '1 1 260px', minWidth: 240 }}>
                      <Select
                        showSearch
                        optionFilterProp="label"
                        style={{ width: '100%', marginBottom: 8 }}
                        placeholder={t('led.pickPanel')}
                        value={screen.panelId ?? undefined}
                        loading={panels.isFetching}
                        options={panelOptions}
                        onChange={(v) => update(screen.id, { panelId: v })}
                      />
                      <Space>
                        <InputNumber
                          min={0}
                          max={1000}
                          value={screen.widthPanels}
                          onChange={(v) => update(screen.id, { widthPanels: v ?? 0 })}
                          addonBefore={t('led.columns')}
                          style={{ width: 150 }}
                        />
                        <InputNumber
                          min={0}
                          max={1000}
                          value={screen.heightPanels}
                          onChange={(v) => update(screen.id, { heightPanels: v ?? 0 })}
                          addonBefore={t('led.rows')}
                          style={{ width: 150 }}
                        />
                      </Space>

                      {evaluated?.power && (
                        <div style={{ marginTop: 12 }}>
                          <Space size={[6, 6]} wrap>
                            <Tag color="blue">{t('led.panelCount', { count: evaluated.power.panelCount })}</Tag>
                            <Tag>{(evaluated.power.widthMm / 1000).toFixed(2)} × {(evaluated.power.heightMm / 1000).toFixed(2)} m</Tag>
                            <Tag>{evaluated.power.resolutionX} × {evaluated.power.resolutionY} px</Tag>
                            <Tag>{evaluated.power.areaM2.toFixed(1)} m²</Tag>
                            {evaluated.power.totalWeightKg > 0 && <Tag>{Math.round(evaluated.power.totalWeightKg)} kg</Tag>}
                          </Space>
                          <Space size={[6, 6]} wrap style={{ marginTop: 6 }}>
                            <Tag color="gold">{t('led.circuitsNeeded', { count: evaluated.power.circuitsNeeded })}</Tag>
                            <Tag color="gold">{t('led.socapexNeeded', { count: evaluated.power.socapexNeeded })}</Tag>
                            <Tag color="gold">{evaluated.power.perPhaseMaxA.toFixed(1)} A / {t('led.phase')}</Tag>
                          </Space>
                          {evaluated.power.wattMissing && (
                            <Alert type="warning" showIcon style={{ marginTop: 8 }} message={t('led.wattMissingWarning')} />
                          )}
                          {option ? (
                            <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                              {t('led.processorPlan', {
                                processors: option.units,
                                extenders: option.extenderUnits,
                                percent: option.utilizationPercent.toFixed(0),
                              })}
                            </Typography.Paragraph>
                          ) : (
                            evaluated.processor && (
                              <Alert type="warning" showIcon style={{ marginTop: 8 }} message={t('led.noProcessorOption')} />
                            )
                          )}
                        </div>
                      )}
                      {evaluated && !evaluated.panelFound && (
                        <Alert type="error" showIcon style={{ marginTop: 8 }} message={t('led.panelNotFound')} />
                      )}
                    </div>
                    <LedScreenGrid columns={screen.widthPanels} rows={screen.heightPanels} panel={panel} />
                  </Flex>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <LedToJobModal open={transferOpen} screens={request.screens} evaluation={result} onClose={() => setTransferOpen(false)} />
    </>
  );
}
