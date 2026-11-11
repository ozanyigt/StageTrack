import { BuildOutlined, CalendarOutlined, EnvironmentOutlined, SafetyCertificateOutlined, WarningOutlined } from '@ant-design/icons';
import { Card, Col, Empty, Flex, List, Row, Skeleton, Statistic, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi } from '../api/endpoints';
import { UNIT_STATUSES, type ProjectStatus } from '../api/types';
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

  // The three questions the dashboard answers: what is confirmed, what is still waiting for an answer, and
  // what is out on a site. Prepped is a step inside the warehouse's own board, not a headline of its own.
  const cardStatuses: ProjectStatus[] = ['Confirmed', 'Pending', 'OnLocation'];

  // Crew members only see the confirmed projects they are assigned to.
  if (!can(Permissions.Projects) && can(Permissions.AssignedProjects)) {
    return (
      <>
        <div className="page-header">
          <Typography.Title level={3}>{t('dashboard.welcome', { name: user?.fullName })}</Typography.Title>
        </div>
        <Card size="small" title={t('dashboard.myProjects')} extra={<Link to="/projects">{t('common.viewAll')}</Link>}>
          {data.myProjects.length === 0 ? (
            <Empty description={t('dashboard.noMyProjects')} />
          ) : (
            <Row gutter={[12, 12]}>
              {data.myProjects.map((p) => (
                <Col xs={24} md={12} xl={8} key={p.id}>
                  <Card
                    size="small"
                    hoverable
                    onClick={() => navigate(`/projects/${p.id}`)}
                    style={{ borderInlineStart: `4px solid ${p.color}` }}
                  >
                    <Flex justify="space-between" align="start" gap={8}>
                      <Typography.Text strong>
                        {p.number} · {p.name}
                      </Typography.Text>
                      <ProjectStatusTag status={p.status} />
                    </Flex>
                    <Typography.Text type="secondary" style={{ display: 'block', marginTop: 6 }}>
                      <CalendarOutlined /> {f.period(p.useStart ?? p.planStart, p.useEnd ?? p.planEnd)}
                    </Typography.Text>
                    {p.venueName && (
                      <Typography.Text type="secondary" style={{ display: 'block' }}>
                        <EnvironmentOutlined /> {p.venueName}
                      </Typography.Text>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('dashboard.welcome', { name: user?.fullName })}</Typography.Title>
      </div>

      {can(Permissions.Projects) && (
      <Row gutter={[12, 12]}>
        {cardStatuses.map((s) => (
          <Col xs={24} sm={8} key={s}>
            <Card size="small" hoverable onClick={() => navigate(`/projects?status=${s}`)}>
              <Statistic title={t(`enums.projectStatus.${s}`)} value={data.projectsByStatus[s] ?? 0} />
            </Card>
          </Col>
        ))}
      </Row>
      )}

      {can(Permissions.Maintenance) && (
        <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
          <Col xs={24} sm={8}>
            <Card size="small" hoverable onClick={() => navigate('/maintenance/repairs')}>
              <Statistic
                title={t('dashboard.openRepairs')}
                value={data.openRepairs}
                prefix={<BuildOutlined />}
                valueStyle={data.openRepairs > 0 ? { color: '#fa8c16' } : undefined}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" hoverable onClick={() => navigate('/equipment/units')}>
              <Statistic
                title={t('dashboard.overdueInspections')}
                value={data.overdueInspections}
                prefix={<SafetyCertificateOutlined />}
                valueStyle={data.overdueInspections > 0 ? { color: '#cf1322' } : undefined}
              />
            </Card>
          </Col>
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
            {
              title: t('movements.project'),
              ellipsis: true,
              render: (_, m) => {
                if (!m.projectId) return '—';
                const label = `${m.projectNumber} · ${m.projectName}`;
                // The warehouse never opens project details; it goes to the job's scan screen.
                if (can(Permissions.Projects)) return <Link to={`/projects/${m.projectId}`}>{label}</Link>;
                if (can(Permissions.WarehouseScan)) return <Link to={`/warehouse/scan/${m.projectId}`}>{label}</Link>;
                return label;
              },
            },
          ]}
        />
      </Card>
      )}
    </>
  );
}
