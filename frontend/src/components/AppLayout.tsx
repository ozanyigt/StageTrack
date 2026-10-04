import {
  AppstoreOutlined,
  BarcodeOutlined,
  CalendarOutlined,
  DashboardOutlined,
  FileTextOutlined,
  HistoryOutlined,
  HomeOutlined,
  LogoutOutlined,
  MoonOutlined,
  ProjectOutlined,
  ScanOutlined,
  SettingOutlined,
  SunOutlined,
  TagsOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined,
  SafetyOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { Alert, Avatar, Button, Dropdown, Flex, Layout, Menu, Select, Typography, theme, type MenuProps } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { changeLanguage, Permissions, roleLabel, useAuth } from '../auth/AuthContext';
import { useErrorToast } from '../utils/errors';
import { LANGUAGES } from '../i18n';
import { useThemeMode } from './ThemeMode';

type Item = Required<MenuProps>['items'][number] & { permission?: string };

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, company, can, logout, switchCompany, impersonating, endImpersonation } = useAuth();
  const showError = useErrorToast();
  const { mode, toggle } = useThemeMode();
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);

  const items: Item[] = [
    { key: '/', icon: <DashboardOutlined />, label: t('nav.dashboard') },
    { key: '/calendar', icon: <CalendarOutlined />, label: t('nav.calendar'), permission: Permissions.Projects },
    {
      key: 'warehouse',
      icon: <HomeOutlined />,
      label: t('nav.warehouse'),
      permission: Permissions.Warehouse,
      children: [
        { key: '/warehouse', icon: <AppstoreOutlined />, label: t('nav.warehouseBoard') },
        { key: '/warehouse/scan', icon: <ScanOutlined />, label: t('nav.scan'), permission: Permissions.WarehouseScan },
        { key: '/warehouse/movements', icon: <HistoryOutlined />, label: t('nav.movements') },
      ].filter((i) => !('permission' in i) || can(i.permission as string)),
    },
    { key: '/projects', icon: <ProjectOutlined />, label: t('nav.projects'), permission: Permissions.Projects },
    { key: '/quotes', icon: <FileTextOutlined />, label: t('nav.quotes'), permission: Permissions.Quotes },
    {
      key: 'equipment',
      icon: <ToolOutlined />,
      label: t('nav.equipment'),
      permission: Permissions.Equipment,
      children: [
        { key: '/equipment', icon: <TagsOutlined />, label: t('nav.equipmentList') },
        { key: '/equipment/units', icon: <BarcodeOutlined />, label: t('nav.units') },
      ],
    },
    { key: '/customers', icon: <TeamOutlined />, label: t('nav.customers'), permission: Permissions.Customers },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: t('nav.settings'),
      children: [
        { key: '/settings/users', icon: <UserOutlined />, label: t('nav.users'), permission: Permissions.IdentityUsers },
        { key: '/settings/roles', icon: <SafetyOutlined />, label: t('nav.roles'), permission: Permissions.IdentityRoles },
        { key: '/settings/rental-factors', label: t('nav.rentalFactors'), permission: Permissions.RentalFactors },
        { key: '/settings/stock-locations', label: t('nav.stockLocations'), permission: Permissions.StockLocations },
      ].filter((i) => can(i.permission)),
    },
  ];

  const visible = items
    .filter((i) => !i.permission || can(i.permission))
    .filter((i) => !('children' in i) || (i.children as unknown[]).length > 0)
    .map(({ permission: _p, ...rest }) => rest) as MenuProps['items'];

  const path = location.pathname;
  const selected =
    ['/warehouse/scan', '/warehouse/movements', '/equipment/units', '/settings/users', '/settings/roles', '/settings/rental-factors', '/settings/stock-locations', '/calendar']
      .find((p) => path.startsWith(p)) ??
    ['/warehouse', '/projects', '/quotes', '/equipment', '/customers'].find((p) => path.startsWith(p)) ??
    '/';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider
        breakpoint="lg"
        collapsedWidth={0}
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={232}
        theme="dark"
        style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'auto' }}
      >
        <Flex align="center" gap={10} style={{ padding: '18px 16px' }}>
          <img src="/favicon.svg" width={30} height={30} alt="" />
          <div style={{ lineHeight: 1.2 }}>
            <Typography.Text strong style={{ color: '#fff', display: 'block' }}>StageTrack</Typography.Text>
            <Typography.Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>{company?.name}</Typography.Text>
          </div>
        </Flex>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          defaultOpenKeys={['warehouse', 'equipment', 'settings']}
          items={visible}
          onClick={(e) => {
            navigate(e.key);
            if (window.innerWidth < 992) setCollapsed(true);
          }}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header
          className="no-print"
          style={{
            background: token.colorBgContainer,
            paddingInline: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          {user && user.companies.length > 1 && (
            <Select
              className="hide-mobile"
              style={{ minWidth: 220 }}
              value={company?.id}
              onChange={(id) => {
                switchCompany(id);
                navigate('/');
              }}
              options={user.companies.map((c) => ({ value: c.id, label: c.name }))}
              aria-label={t('layout.company')}
            />
          )}
          <Select
            value={i18n.language}
            style={{ width: 120 }}
            onChange={(code) => changeLanguage(code, true)}
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
            aria-label={t('layout.language')}
          />
          <Button
            type="text"
            icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
            onClick={toggle}
            aria-label={t('layout.toggleTheme')}
          />
          <Dropdown
            menu={{
              items: [
                { key: 'user', label: `${user?.userName} · ${(user?.roles ?? []).map((r) => roleLabel(t, r)).join(', ')}`, disabled: true },
                { type: 'divider' },
                { key: 'logout', icon: <LogoutOutlined />, label: t('layout.logout'), onClick: logout },
              ],
            }}
          >
            <Button type="text">
              <Avatar size="small" icon={<UserOutlined />} style={{ background: '#f97316' }} />
              <span className="hide-mobile" style={{ marginInlineStart: 8 }}>{user?.fullName}</span>
            </Button>
          </Dropdown>
        </Layout.Header>
        {impersonating && (
          <Alert
            className="no-print"
            type="warning"
            banner
            icon={<UserSwitchOutlined />}
            message={t('layout.impersonating', { user: user?.fullName, admin: user?.impersonatorName })}
            action={
              <Button size="small" type="primary" onClick={() => endImpersonation().then(() => navigate('/settings/users')).catch(showError)}>
                {t('layout.backToMyAccount')}
              </Button>
            }
          />
        )}
        <Layout.Content style={{ padding: 16 }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
