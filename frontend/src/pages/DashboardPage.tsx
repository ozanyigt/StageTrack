import { WarningOutlined } from '@ant-design/icons';
import { Card, Col, Empty, List, Row, Skeleton, Statistic, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi } from '../api/endpoints';
import { PROJECT_STATUSES, UNIT_STATUSES } from '../api/types';
import { Permissions, useAuth } from '../auth/AuthContext';
import { ProjectStatusTag } from '../components/StatusTags';
import { useFormat } from '../utils/format';

export function DashboardPage() {
  const { t } = useTranslation();
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const f = useFormat();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get, refetchInterval: 30_000 });

  if (isLoading || !data) return <Skeleton active />;

  const activeStatuses = PROJECT_STATUSES.filter((s) => !['Returned', 'Cancelled', 'Draft'].includes(s));

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('dashboard.welcome', { name: user?.fullName })}</Typography.Title>
      </div>

      {can(Permissions.Projects) && (
      <Row gutter={[12, 12]}>
        {activeStatuses.map((s) => (
          <Col xs={12} md={6} key={s}>
            <Card size="small" hoverable onClick={() => navigate(`/projects?status=${s}`)}>
              <Statistic title={t(`enums.projectStatus.${s}`)} value={data.projectsByStatus[s] ?? 0} />
            </Card>
          </Col>
        ))}
      </Row>
      )}

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        {can(Permissions.Projects) && (
        <Col xs={24} lg={14}>
          <Card title={t('dashboard.upcoming')} size="small">
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={data.upcoming}
              locale={{ emptyText: <Empty description={t('dashboard.noUpcoming')} /> }}
              onRow={(p) => ({ onClick: () => navigate(`/projects/${p.id}`), style: { cursor: 'pointer' } })}
              columns={[
                { title: t('projects.number'), dataIndex: 'number', width: 70 },
                { title: t('projects.name'), dataIndex: 'name', ellipsis: true },
                { title: t('projects.planStart'), dataIndex: 'planStart', width: 110, render: (v) => f.date(v) },
                { title: t('projects.status'), dataIndex: 'status', width: 120, render: (s) => <ProjectStatusTag status={s} /> },
              ]}
            />
          </Card>
        </Col>
        )}
        <Col xs={24} lg={can(Permissions.Projects) ? 10 : 24}>
          {can(Permissions.Projects) && (
          <Card
            size="small"
            title={<span><WarningOutlined style={{ color: '#fa8c16' }} /> {t('dashboard.shortages')}</span>}
          >
            {data.shortages.length === 0 ? (
              <Empty description={t('dashboard.noShortages')} />
            ) : (
              <List
                dataSource={data.shortages}
                renderItem={(s) => (
                  <List.Item extra={<Tag color="red">{t('dashboard.missing', { count: s.missingQuantity })}</Tag>}>
                    <List.Item.Meta
                      title={<Link to={`/projects/${s.projectId}`}>{s.projectNumber} · {s.projectName}</Link>}
                      description={t('dashboard.shortageLines', { count: s.lineCount, date: f.date(s.planStart) })}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
          )}
          {can(Permissions.Equipment) && (
          <Card size="small" title={t('dashboard.devices')} style={{ marginTop: 12 }}>
            <Row gutter={8}>
              {UNIT_STATUSES.map((s) => (
                <Col span={6} key={s}>
                  <Statistic title={t(`enums.unitStatus.${s}`)} value={data.unitsByStatus[s] ?? 0} valueStyle={{ fontSize: 20 }} />
                </Col>
              ))}
            </Row>
          </Card>
          )}
        </Col>
      </Row>

      {can(Permissions.Warehouse) && (
      <Card size="small" title={t('dashboard.recentMovements')} style={{ marginTop: 12 }} extra={<Link to="/warehouse/movements">{t('common.viewAll')}</Link>}>
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={data.recentMovements}
          scroll={{ x: 700 }}
          columns={[
            { title: t('movements.time'), dataIndex: 'creationTime', width: 140, render: (v) => f.utcDateTime(v) },
            { title: t('movements.action'), dataIndex: 'action', width: 130, render: (a) => t(`enums.movementAction.${a}`) },
            { title: t('movements.equipment'), render: (_, m) => `${m.equipmentCode} · ${m.equipmentName}`, ellipsis: true },
            { title: t('movements.unit'), dataIndex: 'unitInternalRef', width: 140 },
            { title: t('movements.project'), render: (_, m) => (m.projectNumber ? `${m.projectNumber} · ${m.projectName}` : '—'), ellipsis: true },
          ]}
        />
      </Card>
      )}
    </>
  );
}
