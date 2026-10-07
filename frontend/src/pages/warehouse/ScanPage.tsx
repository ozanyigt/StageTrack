import { CheckCircleFilled, CloseCircleFilled, ExclamationCircleFilled, ExportOutlined, ImportOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Col, Empty, Flex, Progress, Row, Segmented, Select, Space, Tag, Typography, theme } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { warehouseApi } from '../../api/endpoints';
import { ApiError } from '../../api/http';
import type { ProjectListItem, ProjectStatus, ScanDirection, ScanResult, ScanSheet, ScanSheetLine } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { LabelAssignModal } from '../../components/LabelAssignModal';
import { ScanInput, type ScanFeedback, type ScanInputHandle } from '../../components/ScanInput';
import { ProjectStatusTag } from '../../components/StatusTags';
import { translateError, useErrorToast } from '../../utils/errors';

const SCANNABLE: ProjectStatus[] = ['Confirmed', 'Prepped', 'OnLocation'];

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

interface SectionGroup {
  key: string;
  name: string;
  depth: number;
  lines: ScanSheetLine[];
}

/** Lines grouped like the quote: lines without a section first, then each section; case content right after its case. */
function groupLines(sheet: ScanSheet, noSection: string, extras: string): SectionGroup[] {
  const groups: SectionGroup[] = [
    { key: 'none', name: noSection, depth: 1, lines: sheet.lines.filter((l) => !l.sectionId) },
    ...sheet.sections.map((s) => ({
      key: s.id,
      name: s.isWarehouseExtras ? extras : s.name,
      depth: s.depth,
      lines: sheet.lines.filter((l) => l.sectionId === s.id),
    })),
  ];
  return groups.filter((g) => g.key !== 'none' || g.lines.length > 0);
}

/**
 * Warehouse scan screen: on the left what still has to be scanned (in the quote's sections), on the right what
 * was scanned, with the devices that went out (e.g. TR-003). Unplanned items are added after confirmation.
 */
export function ScanPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { modal } = App.useApp();
  const { token } = theme.useToken();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<ScanInputHandle>(null);

  const [direction, setDirection] = useState<ScanDirection>('Out');
  const [last, setLast] = useState<ScanFeedback | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [unknownCode, setUnknownCode] = useState<string | null>(null);

  // Jobs the warehouse works on today come from the board (no project permission needed).
  const board = useQuery({
    queryKey: ['board', 'scan-picker'],
    queryFn: () => warehouseApi.board({ date: dayjs().format('YYYY-MM-DD') }),
  });
  const jobs = useMemo(() => {
    const all: ProjectListItem[] = [
      ...(board.data?.confirmed ?? []),
      ...(board.data?.prepped ?? []),
      ...(board.data?.onLocation ?? []),
      ...(board.data?.expectedBack ?? []),
      ...(board.data?.delayed ?? []),
    ];
    return all.filter((p, i) => all.findIndex((x) => x.id === p.id) === i);
  }, [board.data]);

  const sheetKey = ['scan-sheet', projectId];
  const sheet = useQuery({ queryKey: sheetKey, queryFn: () => warehouseApi.scanSheet(projectId!), enabled: !!projectId });
  const s = sheet.data;

  useEffect(() => {
    if (s?.status === 'OnLocation') setDirection('In');
    else if (s) setDirection('Out');
  }, [s?.projectId, s?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => setHighlight(null), 2500);
    return () => clearTimeout(timer);
  }, [highlight]);

  const describe = (r: ScanResult) => `${r.equipmentCode} · ${r.equipmentName}${r.unitInternalRef ? ` — ${r.unitInternalRef}` : ''}`;

  const scan = useMutation({
    mutationFn: ({ code, allowUnplanned }: { code: string; allowUnplanned?: boolean }) =>
      warehouseApi.scan(projectId!, code, direction, allowUnplanned ?? false),
    onSuccess: (r, vars) => {
      if (r.requiresConfirmation) {
        vibrate([60, 40, 60]);
        modal.confirm({
          title: t('scanSheet.confirmTitle'),
          content: `${describe(r)} — ${t(r.warnings.includes('NotPlanned') ? 'scanSheet.confirmNotPlanned' : 'scanSheet.confirmOverPlanned')}`,
          okText: t('scanSheet.confirmYes'),
          cancelText: t('common.no'),
          onOk: () => scan.mutate({ code: vars.code, allowUnplanned: true }),
          afterClose: () => inputRef.current?.focus(),
        });
        return;
      }

      if (r.alreadyScanned) {
        vibrate([60, 40, 60]);
        setLast({ kind: 'warn', title: describe(r), detail: t('scan.alreadyScanned') });
      } else {
        vibrate(60);
        const warnings = vars.allowUnplanned ? [t('scanSheet.addedToExtras')] : [];
        setLast({
          kind: warnings.length ? 'warn' : 'ok',
          title: describe(r),
          detail: [t(r.direction === 'Out' ? 'scan.checkedOut' : 'scan.checkedIn', { out: r.outQuantity, planned: r.plannedQuantity }), ...warnings].join(' · '),
        });
        setHighlight(r.equipmentId);
      }
      queryClient.invalidateQueries({ queryKey: sheetKey });
    },
    onError: (error, vars) => {
      vibrate([200, 80, 200]);
      if (error instanceof ApiError && error.code === 'Label.NotFound' && can(Permissions.LabelsAssign)) {
        setUnknownCode(vars.code);
      }
      setLast({ kind: 'error', title: vars.code, detail: translateError(t, error) });
    },
    onSettled: () => inputRef.current?.focus(),
  });

  const changeStatus = useMutation({
    mutationFn: (status: ProjectStatus) => warehouseApi.setProjectStatus(projectId!, status),
    onSuccess: (updated) => {
      queryClient.setQueryData(sheetKey, updated);
      queryClient.invalidateQueries({ queryKey: ['board'] });
    },
    onError: showError,
  });

  const groups = s ? groupLines(s, t('scanSheet.noSection'), t('scanSheet.extras')) : [];
  const remainingOf = (l: ScanSheetLine) => (direction === 'Out' ? Math.max(0, l.planned - l.out) : Math.max(0, l.out - l.returned));
  const scannedOf = (l: ScanSheetLine) => (direction === 'Out' ? l.out : l.returned);
  const unitsOf = (l: ScanSheetLine) => (direction === 'Out' ? l.unitsOut : l.unitsReturned);
  const total = s ? s.lines.reduce((sum, l) => sum + (direction === 'Out' ? l.planned : l.out), 0) : 0;
  const done = s ? s.lines.reduce((sum, l) => sum + scannedOf(l), 0) : 0;
  const remainingTotal = s ? s.lines.reduce((sum, l) => sum + remainingOf(l), 0) : 0;

  const sectionHeader = (g: SectionGroup, count?: number) => (
    <Flex
      justify="space-between"
      style={{
        padding: '6px 10px',
        marginInlineStart: (g.depth - 1) * 16,
        background: token.colorFillTertiary,
        borderRadius: 6,
        marginTop: 8,
      }}
    >
      <Typography.Text strong>{g.name}</Typography.Text>
      {count !== undefined && <Typography.Text type="secondary">{count}</Typography.Text>}
    </Flex>
  );

  const lineRow = (g: SectionGroup, l: ScanSheetLine, right: React.ReactNode, extra?: React.ReactNode) => (
    <div
      key={l.lineId}
      style={{
        padding: '6px 10px',
        marginInlineStart: (g.depth - 1) * 16 + (l.parentLineId ? 20 : 0),
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: highlight === l.equipmentId ? token.colorSuccessBg : undefined,
        transition: 'background .4s',
      }}
    >
      <Flex justify="space-between" align="center" gap={8}>
        <div style={{ minWidth: 0 }}>
          {l.parentLineId && <Typography.Text type="secondary">↳ </Typography.Text>}
          <Typography.Text type="secondary" style={{ fontSize: 12, marginInlineEnd: 6 }}>{l.code}</Typography.Text>
          <Typography.Text>{l.name}</Typography.Text>
        </div>
        {right}
      </Flex>
      {extra}
    </div>
  );

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>{t('scan.title')}</Typography.Title>

      {/* Top bar: job, direction, scanner, warehouse status buttons */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Flex gap={12} wrap align="center">
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={t('scan.selectProject')}
            value={projectId}
            loading={board.isLoading}
            style={{ minWidth: 260, flex: '1 1 260px', maxWidth: 420 }}
            onChange={(id) => { setLast(null); navigate(`/warehouse/scan/${id}`); }}
            options={jobs.map((x) => ({ value: x.id, label: `${x.number} · ${x.name}` }))}
          />
          {s && (
            <Space wrap>
              <Typography.Text strong>{s.number} · {s.name}</Typography.Text>
              <ProjectStatusTag status={s.status} />
              {s.customerName && <Typography.Text type="secondary">{s.customerName}</Typography.Text>}
            </Space>
          )}
          {s && can(Permissions.WarehouseScan) && s.allowedStatuses.length > 0 && (
            <Space wrap style={{ marginInlineStart: 'auto' }}>
              {s.allowedStatuses.map((st) => (
                <Button key={st} loading={changeStatus.isPending} onClick={() => changeStatus.mutate(st)}>
                  {t('scan.markAs', { status: t(`enums.projectStatus.${st}`) })}
                </Button>
              ))}
            </Space>
          )}
        </Flex>
        {projectId && (
          <Flex gap={12} wrap align="center" style={{ marginTop: 12 }}>
            <Segmented
              size="large"
              value={direction}
              onChange={(v) => { setDirection(v as ScanDirection); inputRef.current?.focus(); }}
              options={[
                { value: 'Out', label: <span><ExportOutlined /> {t('scan.out')}</span> },
                { value: 'In', label: <span><ImportOutlined /> {t('scan.in')}</span> },
              ]}
            />
            <div style={{ flex: '1 1 360px' }}>
              {/* Continuous: the camera stays open for the next label, so every result is repeated inside it. */}
              <ScanInput
                ref={inputRef}
                autoFocus
                mode="continuous"
                feedback={last}
                disabled={scan.isPending}
                onScan={(code) => scan.mutate({ code })}
              />
            </div>
            <div style={{ flex: '0 1 240px', minWidth: 180 }}>
              <Progress
                percent={total ? Math.min(100, Math.round((done / total) * 100)) : 0}
                format={() => `${done} / ${total}`}
                style={{ margin: 0 }}
              />
            </div>
          </Flex>
        )}
        {s && !SCANNABLE.includes(s.status) && (
          <Alert type="warning" showIcon style={{ marginTop: 12 }} message={t('scan.notScannable', { status: t(`enums.projectStatus.${s.status}`) })} />
        )}
        {last && (
          <Flex
            gap={10}
            align="center"
            style={{
              marginTop: 12,
              padding: '8px 12px',
              borderRadius: 8,
              border: `2px solid ${last.kind === 'ok' ? '#52c41a' : last.kind === 'warn' ? '#faad14' : '#ff4d4f'}`,
            }}
          >
            {last.kind === 'ok' && <CheckCircleFilled style={{ color: '#52c41a', fontSize: 24 }} />}
            {last.kind === 'warn' && <ExclamationCircleFilled style={{ color: '#faad14', fontSize: 24 }} />}
            {last.kind === 'error' && <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 24 }} />}
            <div>
              <Typography.Text strong>{last.title}</Typography.Text>
              {last.detail && <div><Typography.Text type="secondary">{last.detail}</Typography.Text></div>}
            </div>
          </Flex>
        )}
      </Card>

      {!projectId ? (
        <Card><Empty description={t('scan.selectProjectHint')} /></Card>
      ) : (
        <Row gutter={[12, 12]}>
          <Col xs={24} lg={12}>
            <Card size="small" title={`${t('scanSheet.toScan')} (${remainingTotal})`} loading={sheet.isLoading}>
              {remainingTotal === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('scanSheet.allDone')} />
              ) : (
                groups.map((g) => {
                  const lines = g.lines.filter((l) => remainingOf(l) > 0);
                  if (lines.length === 0) return null;
                  return (
                    <div key={g.key}>
                      {sectionHeader(g, lines.reduce((sum, l) => sum + remainingOf(l), 0))}
                      {lines.map((l) => lineRow(g, l, <Tag color="blue">{t('scanSheet.remaining', { count: remainingOf(l) })}</Tag>))}
                    </div>
                  );
                })
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card size="small" title={`${t('scanSheet.scanned')} (${done})`} loading={sheet.isLoading}>
              {groups.map((g) => {
                const lines = g.lines.filter((l) => scannedOf(l) > 0);
                return (
                  <div key={g.key}>
                    {sectionHeader(g, lines.reduce((sum, l) => sum + scannedOf(l), 0))}
                    {lines.length === 0 ? (
                      <Typography.Text type="secondary" style={{ display: 'block', padding: '6px 10px', marginInlineStart: (g.depth - 1) * 16, fontSize: 12 }}>
                        {t('scanSheet.nothingScanned')}
                      </Typography.Text>
                    ) : (
                      lines.map((l) =>
                        lineRow(
                          g,
                          l,
                          <Tag color={l.isExtra ? 'gold' : 'green'}>{scannedOf(l)} / {direction === 'Out' ? l.planned : l.out}</Tag>,
                          unitsOf(l).length > 0 && (
                            <Flex gap={4} wrap style={{ marginTop: 4, marginInlineStart: l.parentLineId ? 16 : 0 }}>
                              {unitsOf(l).map((u) => (
                                <Tag key={u.unitId} bordered={false} color="geekblue">
                                  {u.internalRef}{u.serialNumber ? ` · ${u.serialNumber}` : ''}
                                </Tag>
                              ))}
                            </Flex>
                          ),
                        ),
                      )
                    )}
                  </div>
                );
              })}
            </Card>
          </Col>
        </Row>
      )}

      <LabelAssignModal
        code={unknownCode}
        onClose={() => { setUnknownCode(null); inputRef.current?.focus(); }}
        onAssigned={(label) => {
          setUnknownCode(null);
          setLast({ kind: 'ok', title: label.code, detail: t('labels.assigned', { code: label.code }) });
          scan.mutate({ code: label.rawValue });
        }}
      />
    </>
  );
}
