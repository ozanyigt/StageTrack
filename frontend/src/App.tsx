import { App as AntApp, ConfigProvider, Empty, Spin, theme as antTheme } from 'antd';
import trTR from 'antd/locale/tr_TR';
import enUS from 'antd/locale/en_US';
import arEG from 'antd/locale/ar_EG';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, Permissions, useAuth } from './auth/AuthContext';
import { ThemeProvider, useThemeMode } from './components/ThemeMode';
import { AppLayout } from './components/AppLayout';
import { isRtl } from './i18n';
import { LocationPickerPage, LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { EquipmentListPage } from './pages/equipment/EquipmentListPage';
import { EquipmentDetailPage } from './pages/equipment/EquipmentDetailPage';
import { UnitListPage } from './pages/equipment/UnitListPage';
import { EquipmentLayout } from './pages/equipment/EquipmentLayout';
import { UnitDetailPage } from './pages/equipment/UnitDetailPage';
import { LabelPrintPage } from './pages/equipment/LabelPrintPage';
import { LabelTemplatesPage } from './pages/settings/LabelTemplatesPage';
import { RepairListPage } from './pages/maintenance/RepairListPage';
import { SupplierListPage } from './pages/suppliers/SupplierListPage';
import { CrewDirectoryPage } from './pages/crew/CrewDirectoryPage';
import { PackingSlipPrintPage } from './pages/projects/PackingSlipPrintPage';
import { ProjectListPage } from './pages/projects/ProjectListPage';
import { ProjectDetailPage } from './pages/projects/ProjectDetailPage';
import { CalendarPage } from './pages/projects/CalendarPage';
import { WarehouseBoardPage } from './pages/warehouse/WarehouseBoardPage';
import { ScanPage } from './pages/warehouse/ScanPage';
import { MovementsPage } from './pages/warehouse/MovementsPage';
import { QuoteListPage } from './pages/quotes/QuoteListPage';
import { QuoteEditorPage } from './pages/quotes/QuoteEditorPage';
import { QuotePrintPage } from './pages/quotes/QuotePrintPage';
import { CustomerListPage } from './pages/customers/CustomerListPage';
import { RentalFactorsPage } from './pages/settings/RentalFactorsPage';
import { StockLocationsPage } from './pages/settings/StockLocationsPage';
import { RolesPage } from './pages/settings/RolesPage';
import { UsersPage } from './pages/settings/UsersPage';
import type { ReactNode } from 'react';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } },
});

const antLocales = { tr: trTR, en: enUS, ar: arEG } as const;

function Themed({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { mode } = useThemeMode();
  return (
    <ConfigProvider
      locale={antLocales[i18n.language as keyof typeof antLocales] ?? trTR}
      direction={isRtl(i18n.language) ? 'rtl' : 'ltr'}
      renderEmpty={() => <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('common.noData')} />}
      theme={{
        algorithm: mode === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: { colorPrimary: '#4f46e5', borderRadius: 6 },
      }}
    >
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}

/** Renders the page when the user has the permission (or any of the permissions in the array). */
function Guard({ permission, children }: { permission?: string | string[]; children: ReactNode }) {
  const { can } = useAuth();
  const required = permission === undefined ? [] : Array.isArray(permission) ? permission : [permission];
  if (required.length > 0 && !required.some(can)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const ProjectAccess = [Permissions.Projects, Permissions.AssignedProjects];

function AppRoutes() {
  const { user, loading, choosingLocation } = useAuth();

  if (loading) {
    return <Spin size="large" fullscreen />;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  if (choosingLocation) {
    return <LocationPickerPage />;
  }

  return (
    <Routes>
      <Route path="/quotes/:id/print" element={<Guard permission={Permissions.Quotes}><QuotePrintPage /></Guard>} />
      <Route path="/projects/:id/packing-slip" element={<Guard permission={ProjectAccess}><PackingSlipPrintPage /></Guard>} />
      <Route path="/labels/print" element={<Guard permission={Permissions.Equipment}><LabelPrintPage /></Guard>} />
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="calendar" element={<Guard permission={Permissions.Projects}><CalendarPage /></Guard>} />
        <Route path="projects" element={<Guard permission={ProjectAccess}><ProjectListPage /></Guard>} />
        <Route path="projects/:id" element={<Guard permission={ProjectAccess}><ProjectDetailPage /></Guard>} />
        <Route path="warehouse" element={<Guard permission={Permissions.Warehouse}><WarehouseBoardPage /></Guard>} />
        <Route path="warehouse/scan" element={<Guard permission={Permissions.WarehouseScan}><ScanPage /></Guard>} />
        <Route path="warehouse/scan/:projectId" element={<Guard permission={Permissions.WarehouseScan}><ScanPage /></Guard>} />
        <Route path="warehouse/movements" element={<Guard permission={Permissions.Warehouse}><MovementsPage /></Guard>} />
        <Route path="equipment" element={<Guard permission={Permissions.Equipment}><EquipmentLayout /></Guard>}>
          <Route index element={<EquipmentListPage />} />
          <Route path="units" element={<UnitListPage />} />
          <Route path="units/:id" element={<UnitDetailPage />} />
          <Route path=":id" element={<EquipmentDetailPage />} />
        </Route>
        <Route path="maintenance/repairs" element={<Guard permission={Permissions.Maintenance}><RepairListPage /></Guard>} />
        <Route path="suppliers" element={<Guard permission={Permissions.Suppliers}><SupplierListPage /></Guard>} />
        <Route path="crew" element={<CrewDirectoryPage />} />
        <Route path="quotes" element={<Guard permission={Permissions.Quotes}><QuoteListPage /></Guard>} />
        <Route path="quotes/:id" element={<Guard permission={Permissions.Quotes}><QuoteEditorPage /></Guard>} />
        <Route path="customers" element={<Guard permission={Permissions.Customers}><CustomerListPage /></Guard>} />
        <Route path="settings/rental-factors" element={<Guard permission={Permissions.RentalFactors}><RentalFactorsPage /></Guard>} />
        <Route path="settings/users" element={<Guard permission={Permissions.IdentityUsers}><UsersPage /></Guard>} />
        <Route path="settings/roles" element={<Guard permission={Permissions.IdentityRoles}><RolesPage /></Guard>} />
        <Route path="settings/stock-locations" element={<Guard permission={Permissions.StockLocations}><StockLocationsPage /></Guard>} />
        <Route path="settings/label-templates" element={<Guard permission={Permissions.LabelTemplates}><LabelTemplatesPage /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Themed>
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </Themed>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
