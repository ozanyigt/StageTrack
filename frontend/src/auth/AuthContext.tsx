import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { accountApi } from '../api/endpoints';
import type { Company, CurrentUser, LoginResult } from '../api/types';
import i18n from '../i18n';
import { session } from './session';

interface AuthState {
  user: CurrentUser | null;
  company: Company | null;
  loading: boolean;
  /** True while an admin is signed in as another user. */
  impersonating: boolean;
  login: (userName: string, password: string) => Promise<void>;
  logout: () => void;
  switchCompany: (companyId: string) => void;
  can: (permission: string) => boolean;
  /** Reloads the user's permissions, e.g. after a role of the current user was edited. */
  refresh: () => Promise<void>;
  impersonate: (userId: string) => Promise<void>;
  endImpersonation: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(session.getCompanyId());
  const [loading, setLoading] = useState(!!session.getToken());

  const applyUser = useCallback((u: CurrentUser) => {
    setUser(u);
    const keep = u.companies.find((c) => c.id === session.getCompanyId());
    const selected = keep ?? u.companies[0] ?? null;
    session.setCompanyId(selected?.id ?? null);
    setCompanyId(selected?.id ?? null);
  }, []);

  /** Swaps the session to a new token (login, impersonation start/end) and drops every cached query. */
  const applyLogin = useCallback(
    (result: LoginResult) => {
      session.setToken(result.accessToken);
      queryClient.clear();
      applyUser(result.user);
    },
    [applyUser, queryClient],
  );

  const logout = useCallback(() => {
    session.setToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    if (!session.getToken()) return;
    accountApi
      .me()
      .then(applyUser)
      .catch(() => session.setToken(null))
      .finally(() => setLoading(false));
  }, [applyUser]);

  useEffect(
    () =>
      session.onExpired(() => {
        setUser(null);
        queryClient.clear();
      }),
    [queryClient],
  );

  const login = useCallback(
    async (userName: string, password: string) => applyLogin(await accountApi.login(userName, password)),
    [applyLogin],
  );

  const refresh = useCallback(async () => applyUser(await accountApi.me()), [applyUser]);

  const impersonate = useCallback(async (userId: string) => applyLogin(await accountApi.impersonate(userId)), [applyLogin]);

  const endImpersonation = useCallback(async () => applyLogin(await accountApi.endImpersonation()), [applyLogin]);

  const switchCompany = useCallback(
    (id: string) => {
      session.setCompanyId(id);
      setCompanyId(id);
      queryClient.clear();
    },
    [queryClient],
  );

  const value = useMemo<AuthState>(() => {
    const permissions = new Set(user?.permissions ?? []);
    return {
      user,
      company: user?.companies.find((c) => c.id === companyId) ?? null,
      loading,
      impersonating: !!user?.impersonatorName,
      login,
      logout,
      switchCompany,
      can: (permission: string) => permissions.has(permission),
      refresh,
      impersonate,
      endImpersonation,
    };
  }, [user, companyId, loading, login, logout, switchCompany, refresh, impersonate, endImpersonation]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Persists the UI language on the user profile as well (best effort). */
export async function changeLanguage(code: string, signedIn: boolean) {
  await i18n.changeLanguage(code);
  if (signedIn) accountApi.setLanguage(code).catch(() => undefined);
}

export const Permissions = {
  Equipment: 'StageTrack.Equipment',
  EquipmentManage: 'StageTrack.Equipment.Manage',
  LabelsAssign: 'StageTrack.Labels.Assign',
  Customers: 'StageTrack.Customers',
  CustomersManage: 'StageTrack.Customers.Manage',
  Projects: 'StageTrack.Projects',
  ProjectsManage: 'StageTrack.Projects.Manage',
  ProjectsChangeStatus: 'StageTrack.Projects.ChangeStatus',
  Warehouse: 'StageTrack.Warehouse',
  WarehouseScan: 'StageTrack.Warehouse.Scan',
  Quotes: 'StageTrack.Quotes',
  QuotesManage: 'StageTrack.Quotes.Manage',
  RentalFactors: 'StageTrack.Settings.RentalFactors',
  StockLocations: 'StageTrack.Settings.StockLocations',
  IdentityRoles: 'StageTrack.Identity.Roles',
  IdentityUsers: 'StageTrack.Identity.Users',
  Impersonate: 'StageTrack.Identity.Users.Impersonate',
} as const;

/** Locale key of a permission: "StageTrack.Projects.Manage" → "permissions.Projects_Manage". */
export const permissionLabelKey = (name: string) => `permissions.${name.replace(/^StageTrack\./, '').replace(/\./g, '_')}`;

/** Built-in roles have translated names; roles created by the admin show the name as typed. */
export const roleLabel = (t: (key: string, options?: Record<string, unknown>) => string, name: string) =>
  t(`roles.builtin.${name}`, { defaultValue: name });
