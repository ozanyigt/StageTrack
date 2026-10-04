import { CheckCircleFilled, CloseCircleFilled, ExclamationCircleFilled, ExportOutlined, ImportOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Empty, Flex, List, Progress, Row, Segmented, Select, Space, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { projectApi, warehouseApi } from '../../api/endpoints';
import { ApiError } from '../../api/http';
import type { ProjectStatus, ScanDirection, ScanResult } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { LabelAssignModal } from '../../components/LabelAssignModal';
import { ScanInput, type ScanInputHandle } from '../../components/ScanInput';
import { ProjectStatusTag } from '../../components/StatusTags';
import { translateError, useErrorToast } from '../../utils/errors';

interface FeedItem {
  key: number;
  kind: 'ok' | 'warn' | 'error';
  title: string;
  detail?: string;
}

const SCANNABLE: ProjectStatus[] = ['Confirmed', 'Prepped', 'OnLocation'];

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

export function ScanPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<ScanInputHandle>(null);
  const feedKey = useRef(0);

  const [direction, setDirection] = useState<ScanDirection>('Out');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [unknownCode, setUnknownCode] = useState<string | null>(null);

  const projects = useQuery({
    queryKey: ['projects', 'scannable'],
    queryFn: () => projectApi.list({ statuses: SCANNABLE, maxResultCount: 200, sorting: 'planStart' }),
  });
  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => projectApi.get(projectId!), enabled: !!projectId });
  const packing = useQuery({ queryKey: ['packing', projectId], queryFn: () => warehouseApi.packingList(projectId!), enabled: !!projectId });

  useEffect(() => {
    if (project.data?.status === 'OnLocation') setDirection('In');
    else if (project.data) setDirection('Out');
  }, [project.data?.id, project.data?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const push = (item: Omit<FeedItem, 'key'>) => setFeed((f) => [{ ...item, key: ++feedKey.current }, ...f].slice(0, 30));

  const describe = (r: ScanResult) => `${r.equipmentCode} · ${r.equipmentName}${r.unitInternalRef ? ` — ${r.unitInternalRef}` : ''}`;

  const scan = useMutation({
    mutationFn: (code: string) => warehouseApi.scan(projectId!, code, direction),
    onSuccess: (r) => {
      const warnings = r.warnings.map((w) => t(`scan.warning.${w}`));
      if (r.alreadyScanned) {
        vibrate([60, 40, 60]);
        push({ kind: 'warn', title: describe(r), detail: t('scan.alreadyScanned') });
      } else {
        vibrate(60);
        push({
          kind: warnings.length ? 'warn' : 'ok',
          title: describe(r),
          detail: [t(r.direction === 'Out' ? 'scan.checkedOut' : 'scan.checkedIn', { out: r.outQuantity, planned: r.plannedQuantity }), ...warnings].join(' · '),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['packing', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (error, code) => {
      vibrate([200, 80, 200]);
      if (error instanceof ApiError && error.code === 'Label.NotFound' && can(Permissions.LabelsAssign)) {
        setUnknownCode(code);
      }
      push({ kind: 'error', title: code, detail: translateError(t, error) });
    },
    onSettled: () => inputRef.current?.focus(),
  });

  const changeStatus = useMutation({
    mutationFn: (s: ProjectStatus) => projectApi.changeStatus(projectId!, s),
    onSuccess: (p) => {
      queryClient.setQueryData(['project', projectId], p);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: showError,
  });

  const p = project.data;
  const totalPlanned = packing.data?.totalPlanned ?? 0;
  const totalOut = packing.data?.totalOut ?? 0;
  const quickStatuses = (p?.allowedStatuses ?? []).filter((s) => ['Prepped', 'OnLocation', 'Returned'].includes(s));
  const last = feed[0];

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('scan.title')}</Typography.Title>
        <Select
          showSearch
          optionFilterProp="label"
          placeholder={t('scan.selectProject')}
          value={projectId}
          loading={projects.isLoading}
          style={{ minWidth: 280, flex: 1, maxWidth: 480 }}
          onChange={(id) => { setFeed([]); navigate(`/warehouse/scan/${id}`); }}
          options={(projects.data?.items ?? []).map((x) => ({ value: x.id, label: `${x.number} · ${x.name}` }))}
        />
      </div>

      {!projectId ? (
        <Card><Empty description={t('scan.selectProjectHint')} /></Card>
      ) : (
        <Row gutter={[12, 12]}>
          <Col xs={24} lg={11}>
            <Card size="small">
              {p && (
                <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 12 }}>
                  <Space>
                    <Link to={`/projects/${p.id}`}><strong>{p.number}</strong> · {p.name}</Link>
                    <ProjectStatusTag status={p.status} />
                  </Space>
                </Flex>
              )}
              {p && !SCANNABLE.includes(p.status) && (
                <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={t('scan.notScannable', { status: t(`enums.projectStatus.${p.status}`) })} />
              )}
              <Segmented
                block
                size="large"
                value={direction}
                onChange={(v) => { setDirection(v as ScanDirection); inputRef.current?.focus(); }}
                options={[
                  { value: 'Out', label: <span><ExportOutlined /> {t('scan.out')}</span> },
                  { value: 'In', label: <span><ImportOutlined /> {t('scan.in')}</span> },
                ]}
                style={{ marginBottom: 12 }}
              />
              <ScanInput ref={inputRef} autoFocus disabled={scan.isPending} onScan={(code) => scan.mutate(code)} />

              {last && (
                <Card
                  size="small"
                  style={{
                    marginTop: 12,
                    borderColor: last.kind === 'ok' ? '#52c41a' : last.kind === 'warn' ? '#faad14' : '#ff4d4f',
                    borderWidth: 2,
                  }}
                >
                  <Flex gap={12} align="center">
                    {last.kind === 'ok' && <CheckCircleFilled style={{ color: '#52c41a', fontSize: 32 }} />}
                    {last.kind === 'warn' && <ExclamationCircleFilled style={{ color: '#faad14', fontSize: 32 }} />}
                    {last.kind === 'error' && <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 32 }} />}
                    <div>
                      <Typography.Text strong style={{ fontSize: 16 }}>{last.title}</Typography.Text>
                      <div><Typography.Text type="secondary">{last.detail}</Typography.Text></div>
                    </div>
                  </Flex>
                </Card>
              )}

              <div style={{ marginTop: 16 }}>
                <Typography.Text type="secondary">{t('scan.progress')}</Typography.Text>
                <Progress percent={totalPlanned ? Math.min(100, Math.round((totalOut / totalPlanned) * 100)) : 0}
                  format={() => `${totalOut} / ${totalPlanned}`} />
              </div>

              {can(Permissions.ProjectsChangeStatus) && quickStatuses.length > 0 && (
                <Flex gap={8} wrap style={{ marginTop: 8 }}>
                  {quickStatuses.map((s) => (
                    <Button key={s} loading={changeStatus.isPending} onClick={() => changeStatus.mutate(s)}>
                      {t('scan.markAs', { status: t(`enums.projectStatus.${s}`) })}
                    </Button>
                  ))}
                </Flex>
              )}

              <List
                size="small"
                style={{ marginTop: 12 }}
                header={<Typography.Text type="secondary">{t('scan.history')}</Typography.Text>}
                dataSource={feed.slice(1)}
                locale={{ emptyText: ' ' }}
                renderItem={(item) => (
                  <List.Item className="scan-feed-item">
                    <Space>
                      <Tag color={item.kind === 'ok' ? 'green' : item.kind === 'warn' ? 'gold' : 'red'}>
                        {t(`scan.kind.${item.kind}`)}
                      </Tag>
                      <span>{item.title}</span>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} lg={13}>
            <Card size="small" title={t('scan.packingList')}>
              <Table
                size="small"
                rowKey="equipmentId"
                loading={packing.isFetching}
                pagination={false}
                dataSource={packing.data?.lines}
                scroll={{ x: 520 }}
                columns={[
                  { title: t('equipment.code'), dataIndex: 'equipmentCode', width: 100 },
                  { title: t('equipment.name'), dataIndex: 'equipmentName', ellipsis: true },
                  {
                    title: t('scan.outOfPlanned'),
                    width: 140,
                    render: (_, l) => {
                      const done = l.planned > 0 && l.out >= l.planned;
                      const color = l.planned === 0 ? 'gold' : l.out > l.planned ? 'gold' : done ? 'green' : l.out > 0 ? 'blue' : 'default';
                      return <Tag color={color}>{l.out} / {l.planned}</Tag>;
                    },
                  },
                  { title: t('scan.returned'), dataIndex: 'returned', width: 80, align: 'end' },
                ]}
                expandable={{
                  rowExpandable: (l) => l.unitsOut.length > 0,
                  expandedRowRender: (l) => <Flex gap={4} wrap>{l.unitsOut.map((u) => <Tag key={u}>{u}</Tag>)}</Flex>,
                }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <LabelAssignModal
        code={unknownCode}
        onClose={() => { setUnknownCode(null); inputRef.current?.focus(); }}
        onAssigned={(label) => {
          setUnknownCode(null);
          push({ kind: 'ok', title: label.code, detail: t('labels.assigned', { code: label.code }) });
          scan.mutate(label.rawValue);
        }}
      />
    </>
  );
}
