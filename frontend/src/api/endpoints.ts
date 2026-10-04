import { http, toQuery } from './http';
import type * as T from './types';

const get = <R>(url: string, params?: object) =>
  http.get<R>(url, { params: params ? toQuery(params as Record<string, unknown>) : undefined }).then((r) => r.data);
const post = <R>(url: string, body?: unknown) => http.post<R>(url, body ?? {}).then((r) => r.data);
const put = <R>(url: string, body: unknown) => http.put<R>(url, body).then((r) => r.data);
const del = <R = void>(url: string) => http.delete<R>(url).then((r) => r.data);

export const accountApi = {
  login: (userName: string, password: string) => post<T.LoginResult>('/account/login', { userName, password }),
  me: () => get<T.CurrentUser>('/account/me'),
  setLanguage: (language: string) => put('/account/language', { language }),
  impersonate: (userId: T.Guid) => post<T.LoginResult>(`/account/impersonate/${userId}`),
  endImpersonation: () => post<T.LoginResult>('/account/end-impersonation'),
};

export const roleApi = {
  definitions: () => get<T.PermissionGroup[]>('/identity/roles/permission-definitions'),
  list: () => get<T.Role[]>('/identity/roles'),
  create: (name: string) => post<T.Role>('/identity/roles', { name }),
  rename: (id: T.Guid, name: string) => put<T.Role>(`/identity/roles/${id}`, { name }),
  setPermissions: (id: T.Guid, permissions: string[]) => put<T.Role>(`/identity/roles/${id}/permissions`, { permissions }),
  remove: (id: T.Guid) => del(`/identity/roles/${id}`),
};

export const userApi = {
  list: (params: T.PagedRequest & { text?: string }) => get<T.PagedResult<T.User>>('/identity/users', params),
  assignableRoles: () => get<T.Lookup[]>('/identity/users/assignable-roles'),
  create: (input: T.CreateUserInput) => post<T.User>('/identity/users', input),
  update: (id: T.Guid, input: T.UpdateUserInput) => put<T.User>(`/identity/users/${id}`, input),
  setActive: (id: T.Guid, isActive: boolean) => post(`/identity/users/${id}/active`, { isActive }),
  resetPassword: (id: T.Guid, newPassword: string) => post(`/identity/users/${id}/reset-password`, { newPassword }),
};

export const dashboardApi = {
  get: () => get<T.Dashboard>('/dashboard'),
};

export const folderApi = {
  list: () => get<T.EquipmentFolder[]>('/equipment-folders'),
  create: (input: { name: string; parentId?: T.Guid | null }) => post<T.EquipmentFolder>('/equipment-folders', input),
  update: (id: T.Guid, input: { name: string; parentId?: T.Guid | null }) => put<T.EquipmentFolder>(`/equipment-folders/${id}`, input),
  remove: (id: T.Guid) => del(`/equipment-folders/${id}`),
};

export const equipmentApi = {
  list: (params: T.PagedRequest & { text?: string; folderId?: T.Guid; type?: T.EquipmentType; isArchived?: boolean }) =>
    get<T.PagedResult<T.Equipment>>('/equipment', params),
  get: (id: T.Guid) => get<T.EquipmentDetail>(`/equipment/${id}`),
  lookup: (text?: string) => get<T.EquipmentLookup[]>('/equipment/lookup', { text }),
  create: (input: T.EquipmentInput) => post<T.Equipment>('/equipment', input),
  update: (id: T.Guid, input: T.EquipmentInput) => put<T.Equipment>(`/equipment/${id}`, input),
  archive: (id: T.Guid) => post(`/equipment/${id}/archive`),
  restore: (id: T.Guid) => post(`/equipment/${id}/restore`),
};

export const unitApi = {
  list: (params: T.PagedRequest & { text?: string; equipmentId?: T.Guid; status?: T.UnitStatus; stockLocationId?: T.Guid }) =>
    get<T.PagedResult<T.EquipmentUnit>>('/equipment-units', params),
  labels: (id: T.Guid) => get<T.Label[]>(`/equipment-units/${id}/labels`),
  create: (input: {
    equipmentId: T.Guid;
    internalRef: string;
    serialNumber?: string | null;
    stockLocationId?: T.Guid | null;
    notes?: string | null;
    labelCode?: string | null;
  }) => post<T.EquipmentUnit>('/equipment-units', input),
  update: (id: T.Guid, input: { internalRef: string; serialNumber?: string | null; stockLocationId?: T.Guid | null; notes?: string | null }) =>
    put<T.EquipmentUnit>(`/equipment-units/${id}`, input),
  changeStatus: (id: T.Guid, status: T.UnitStatus) => post(`/equipment-units/${id}/status`, { status }),
  archive: (id: T.Guid) => post(`/equipment-units/${id}/archive`),
};

export const labelApi = {
  resolve: (code: string) => get<T.ResolveLabelResult>('/labels/resolve', { code }),
  assign: (input: { code: string; type: T.LabelType; equipmentId?: T.Guid | null; unitId?: T.Guid | null }) =>
    post<T.Label>('/labels', input),
  remove: (id: T.Guid) => del(`/labels/${id}`),
};

export const stockLocationApi = {
  list: () => get<T.StockLocation[]>('/stock-locations'),
  create: (input: Omit<T.StockLocation, 'id'>) => post<T.StockLocation>('/stock-locations', input),
  update: (id: T.Guid, input: Omit<T.StockLocation, 'id'>) => put<T.StockLocation>(`/stock-locations/${id}`, input),
  remove: (id: T.Guid) => del(`/stock-locations/${id}`),
};

export const customerApi = {
  list: (params: T.PagedRequest & { text?: string }) => get<T.PagedResult<T.Customer>>('/customers', params),
  lookup: (text?: string) => get<T.Lookup[]>('/customers/lookup', { text }),
  create: (input: Omit<T.Customer, 'id'>) => post<T.Customer>('/customers', input),
  update: (id: T.Guid, input: Omit<T.Customer, 'id'>) => put<T.Customer>(`/customers/${id}`, input),
  remove: (id: T.Guid) => del(`/customers/${id}`),
};

export const projectApi = {
  list: (params: T.PagedRequest & { text?: string; statuses?: T.ProjectStatus[]; from?: string; to?: string; customerId?: T.Guid }) =>
    get<T.PagedResult<T.ProjectListItem>>('/projects', params),
  get: (id: T.Guid) => get<T.Project>(`/projects/${id}`),
  create: (input: T.ProjectInput) => post<T.Project>('/projects', input),
  update: (id: T.Guid, input: T.ProjectInput) => put<T.Project>(`/projects/${id}`, input),
  remove: (id: T.Guid) => del(`/projects/${id}`),
  changeStatus: (id: T.Guid, status: T.ProjectStatus) => post<T.Project>(`/projects/${id}/status`, { status }),
  addEquipment: (id: T.Guid, equipmentId: T.Guid, quantity: number) =>
    post<T.Project>(`/projects/${id}/equipment`, { equipmentId, quantity }),
  updateEquipment: (id: T.Guid, lineId: T.Guid, quantity: number, notes?: string | null) =>
    put<T.Project>(`/projects/${id}/equipment/${lineId}`, { quantity, notes }),
  removeEquipment: (id: T.Guid, lineId: T.Guid) => del<T.Project>(`/projects/${id}/equipment/${lineId}`),
};

export const warehouseApi = {
  scan: (projectId: T.Guid, code: string, direction: T.ScanDirection) =>
    post<T.ScanResult>('/warehouse/scan', { projectId, code, direction }),
  packingList: (projectId: T.Guid) => get<T.PackingList>(`/warehouse/packing-list/${projectId}`),
  board: (params: { date?: string; stockLocationId?: T.Guid }) => get<T.WarehouseBoard>('/warehouse/board', params),
  movements: (params: T.PagedRequest & { text?: string; projectId?: T.Guid; equipmentId?: T.Guid; unitId?: T.Guid; action?: T.MovementAction }) =>
    get<T.PagedResult<T.Movement>>('/warehouse/movements', params),
};

export const rentalFactorApi = {
  list: () => get<T.RentalFactorProfile[]>('/rental-factor-profiles'),
  preview: (id: T.Guid, maxDays = 14) => get<T.FactorPreview[]>(`/rental-factor-profiles/${id}/preview`, { maxDays }),
  create: (input: T.RentalFactorProfileInput) => post<T.RentalFactorProfile>('/rental-factor-profiles', input),
  update: (id: T.Guid, input: T.RentalFactorProfileInput) => put<T.RentalFactorProfile>(`/rental-factor-profiles/${id}`, input),
  remove: (id: T.Guid) => del(`/rental-factor-profiles/${id}`),
};

export const quoteApi = {
  list: (params: T.PagedRequest & { text?: string; projectId?: T.Guid; status?: T.QuoteStatus }) =>
    get<T.PagedResult<T.QuoteListItem>>('/quotes', params),
  get: (id: T.Guid) => get<T.Quote>(`/quotes/${id}`),
  create: (projectId: T.Guid, rentalFactorProfileId?: T.Guid | null) => post<T.Quote>('/quotes', { projectId, rentalFactorProfileId }),
  updateHeader: (id: T.Guid, input: T.QuoteHeaderInput) => put<T.Quote>(`/quotes/${id}`, input),
  addLine: (id: T.Guid, input: T.QuoteLineInput) => post<T.Quote>(`/quotes/${id}/lines`, input),
  updateLine: (id: T.Guid, lineId: T.Guid, input: T.QuoteLineInput) => put<T.Quote>(`/quotes/${id}/lines/${lineId}`, input),
  removeLine: (id: T.Guid, lineId: T.Guid) => del<T.Quote>(`/quotes/${id}/lines/${lineId}`),
  changeStatus: (id: T.Guid, status: T.QuoteStatus) => post<T.Quote>(`/quotes/${id}/status`, { status }),
  revise: (id: T.Guid) => post<T.Quote>(`/quotes/${id}/revise`),
  remove: (id: T.Guid) => del(`/quotes/${id}`),
};
