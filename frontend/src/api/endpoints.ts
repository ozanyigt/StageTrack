import { http, toQuery } from './http';
import type * as T from './types';

const get = <R>(url: string, params?: object) =>
  http.get<R>(url, { params: params ? toQuery(params as Record<string, unknown>) : undefined }).then((r) => r.data);
const post = <R>(url: string, body?: unknown) => http.post<R>(url, body ?? {}).then((r) => r.data);
const put = <R>(url: string, body: unknown) => http.put<R>(url, body).then((r) => r.data);
const del = <R = void>(url: string) => http.delete<R>(url).then((r) => r.data);

/** Multipart upload of a single file in the "file" field. */
const upload = <R>(url: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return http.post<R>(url, form).then((r) => r.data);
};

/** Downloads a protected file as a blob (bearer token is sent by the interceptor). */
export const fetchBlob = (url: string) => http.get<Blob>(url, { responseType: 'blob' }).then((r) => r.data);

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
  list: (
    params: T.PagedRequest & { text?: string; folderId?: T.Guid; includeSubfolders?: boolean; type?: T.EquipmentType; isArchived?: boolean },
  ) => get<T.PagedResult<T.Equipment>>('/equipment', params),
  get: (id: T.Guid) => get<T.EquipmentDetail>(`/equipment/${id}`),
  /** forQuote: projects and quotes — leaves out office equipment and equipment with nothing rentable (e.g. in repair). */
  lookup: (text?: string, forQuote = false) => get<T.EquipmentLookup[]>('/equipment/lookup', { text, forQuote: forQuote || undefined }),
  availability: (equipmentIds: T.Guid[], start: string, end: string, excludeProjectId?: T.Guid) =>
    post<{ equipmentId: T.Guid; stock: number; plannedElsewhere: number; available: number }[]>('/equipment/availability', {
      equipmentIds,
      start,
      end,
      excludeProjectId,
    }),
  create: (input: T.EquipmentInput) => post<T.Equipment>('/equipment', input),
  update: (id: T.Guid, input: T.EquipmentInput) => put<T.EquipmentDetail>(`/equipment/${id}`, input),
  archive: (id: T.Guid) => post(`/equipment/${id}/archive`),
  restore: (id: T.Guid) => post(`/equipment/${id}/restore`),
  /** Deletes equipment entered by mistake (never on a project/quote) with its devices and labels; logged. */
  remove: (id: T.Guid) => del(`/equipment/${id}`),
  /** Case price back to its content total (and following it again). */
  usePriceFromContent: (id: T.Guid) => post<T.EquipmentDetail>(`/equipment/${id}/price-from-content`),
  addRelation: (id: T.Guid, kind: T.RelationKind, relatedEquipmentId: T.Guid, quantity: number) =>
    post<T.EquipmentDetail>(`/equipment/${id}/relations`, { kind, relatedEquipmentId, quantity }),
  updateRelation: (id: T.Guid, relationId: T.Guid, quantity: number) =>
    put<T.EquipmentDetail>(`/equipment/${id}/relations/${relationId}`, { quantity }),
  removeRelation: (id: T.Guid, relationId: T.Guid) => del<T.EquipmentDetail>(`/equipment/${id}/relations/${relationId}`),
  addSupplier: (id: T.Guid, input: { supplierId: T.Guid; supplierCode?: string | null; purchasePrice?: number | null; isPreferred: boolean }) =>
    post<T.EquipmentDetail>(`/equipment/${id}/suppliers`, input),
  updateSupplier: (
    id: T.Guid,
    linkId: T.Guid,
    input: { supplierId: T.Guid; supplierCode?: string | null; purchasePrice?: number | null; isPreferred: boolean },
  ) => put<T.EquipmentDetail>(`/equipment/${id}/suppliers/${linkId}`, input),
  removeSupplier: (id: T.Guid, linkId: T.Guid) => del<T.EquipmentDetail>(`/equipment/${id}/suppliers/${linkId}`),
  setImage: (id: T.Guid, file: File) => upload<T.EquipmentDetail>(`/equipment/${id}/image`, file),
  removeImage: (id: T.Guid) => del<T.EquipmentDetail>(`/equipment/${id}/image`),
  import: (rows: T.EquipmentImportRow[]) => post<T.ImportResult>('/equipment/import', rows),
};

export const unitApi = {
  list: (
    params: T.PagedRequest & { text?: string; equipmentId?: T.Guid; status?: T.UnitStatus; stockLocationId?: T.Guid; includeArchived?: boolean },
  ) => get<T.PagedResult<T.EquipmentUnit>>('/equipment-units', params),
  get: (id: T.Guid) => get<T.EquipmentUnitDetail>(`/equipment-units/${id}`),
  /** Proposed internal reference of the next device (1, 2, 3… or TR-004 after TR-003). */
  nextInternalRef: (equipmentId: T.Guid) => get<string>('/equipment-units/next-internal-ref', { equipmentId }),
  labels: (id: T.Guid) => get<T.Label[]>(`/equipment-units/${id}/labels`),
  create: (input: {
    equipmentId: T.Guid;
    internalRef: string;
    serialNumber?: string | null;
    stockLocationId?: T.Guid | null;
    notes?: string | null;
    purchaseDate?: string | null;
    supplierId?: T.Guid | null;
    labelCode?: string | null;
  }) => post<T.EquipmentUnit>('/equipment-units', input),
  update: (id: T.Guid, input: T.UnitInput) => put<T.EquipmentUnitDetail>(`/equipment-units/${id}`, input),
  changeStatus: (id: T.Guid, status: T.UnitStatus) => post(`/equipment-units/${id}/status`, { status }),
  archive: (id: T.Guid) => post(`/equipment-units/${id}/archive`),
  restore: (id: T.Guid) => post(`/equipment-units/${id}/restore`),
  setImage: (id: T.Guid, file: File) => upload<T.EquipmentUnitDetail>(`/equipment-units/${id}/image`, file),
  removeImage: (id: T.Guid) => del<T.EquipmentUnitDetail>(`/equipment-units/${id}/image`),
  transfer: (unitIds: T.Guid[], targetCompanyId: T.Guid) =>
    post<T.TransferResult>('/equipment-units/transfer', { unitIds, targetCompanyId }),
  import: (rows: T.UnitImportRow[]) => post<T.ImportResult>('/equipment-units/import', rows),
};

export const labelApi = {
  resolve: (code: string) => get<T.ResolveLabelResult>('/labels/resolve', { code }),
  assign: (input: { code: string; type: T.LabelType; equipmentId?: T.Guid | null; unitId?: T.Guid | null }) =>
    post<T.Label>('/labels', input),
  remove: (id: T.Guid) => del(`/labels/${id}`),
  /** Returns printable items; creates new Rentman-format labels for items without one when createMissing is set. */
  preparePrint: (input: { unitIds?: T.Guid[]; equipmentIds?: T.Guid[]; createMissing?: boolean }) =>
    post<T.PrintLabelItem[]>('/labels/print', { unitIds: [], equipmentIds: [], createMissing: true, ...input }),
};

export const labelTemplateApi = {
  list: () => get<T.LabelTemplate[]>('/label-templates'),
  create: (input: T.LabelTemplateInput) => post<T.LabelTemplate>('/label-templates', input),
  update: (id: T.Guid, input: T.LabelTemplateInput) => put<T.LabelTemplate>(`/label-templates/${id}`, input),
  remove: (id: T.Guid) => del(`/label-templates/${id}`),
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
  import: (rows: T.CustomerImportRow[]) => post<T.ImportResult>('/customers/import', rows),
};

export const projectApi = {
  list: (params: T.PagedRequest & { text?: string; statuses?: T.ProjectStatus[]; from?: string; to?: string; customerId?: T.Guid }) =>
    get<T.PagedResult<T.ProjectListItem>>('/projects', params),
  get: (id: T.Guid) => get<T.Project>(`/projects/${id}`),
  packingSlip: (id: T.Guid) => get<T.PackingSlip>(`/projects/${id}/packing-slip`),
  create: (input: T.ProjectInput) => post<T.Project>('/projects', input),
  update: (id: T.Guid, input: T.ProjectInput) => put<T.Project>(`/projects/${id}`, input),
  remove: (id: T.Guid) => del(`/projects/${id}`),
  changeStatus: (id: T.Guid, status: T.ProjectStatus) => post<T.Project>(`/projects/${id}/status`, { status }),
  addEquipment: (id: T.Guid, equipmentId: T.Guid, quantity: number, sectionId?: T.Guid | null, includeAccessories = false) =>
    post<T.Project>(`/projects/${id}/equipment`, { equipmentId, quantity, sectionId, includeAccessories }),
  updateEquipment: (id: T.Guid, lineId: T.Guid, quantity: number, notes?: string | null) =>
    put<T.Project>(`/projects/${id}/equipment/${lineId}`, { quantity, notes }),
  removeEquipment: (id: T.Guid, lineId: T.Guid) => del<T.Project>(`/projects/${id}/equipment/${lineId}`),
  /** Moves a line into another section (sectionId, null = no section) or up/down (direction -1 / 1). */
  moveEquipment: (id: T.Guid, lineId: T.Guid, input: { sectionId?: T.Guid | null; direction?: number | null }) =>
    post<T.Project>(`/projects/${id}/equipment/${lineId}/move`, input),
  addSection: (id: T.Guid, name: string, parentId?: T.Guid | null) => post<T.Project>(`/projects/${id}/sections`, { name, parentId }),
  renameSection: (id: T.Guid, sectionId: T.Guid, name: string, parentId?: T.Guid | null) =>
    put<T.Project>(`/projects/${id}/sections/${sectionId}`, { name, parentId }),
  moveSection: (id: T.Guid, sectionId: T.Guid, direction: number) =>
    post<T.Project>(`/projects/${id}/sections/${sectionId}/move`, { direction }),
  removeSection: (id: T.Guid, sectionId: T.Guid) => del<T.Project>(`/projects/${id}/sections/${sectionId}`),
  addCrew: (id: T.Guid, userId: T.Guid, fn?: string | null) => post<T.Project>(`/projects/${id}/crew`, { userId, function: fn }),
  updateCrew: (id: T.Guid, crewId: T.Guid, fn?: string | null) => put<T.Project>(`/projects/${id}/crew/${crewId}`, { function: fn }),
  removeCrew: (id: T.Guid, crewId: T.Guid) => del<T.Project>(`/projects/${id}/crew/${crewId}`),
};

export const crewApi = {
  directory: () => get<T.CrewDirectoryEntry[]>('/crew'),
};

export const supplierApi = {
  list: (params: T.PagedRequest & { text?: string }) => get<T.PagedResult<T.Supplier>>('/suppliers', params),
  lookup: (text?: string) => get<T.Lookup[]>('/suppliers/lookup', { text }),
  create: (input: T.SupplierInput) => post<T.Supplier>('/suppliers', input),
  update: (id: T.Guid, input: T.SupplierInput) => put<T.Supplier>(`/suppliers/${id}`, input),
  remove: (id: T.Guid) => del(`/suppliers/${id}`),
};

export const repairApi = {
  list: (params: T.PagedRequest & { text?: string; equipmentId?: T.Guid; unitId?: T.Guid; status?: T.RepairStatus; onlyOpen?: boolean }) =>
    get<T.PagedResult<T.Repair>>('/repairs', params),
  create: (input: T.RepairInput) => post<T.Repair>('/repairs', input),
  update: (id: T.Guid, input: { title: string; description?: string | null; supplierId?: T.Guid | null; cost?: number | null }) =>
    put<T.Repair>(`/repairs/${id}`, input),
  changeStatus: (id: T.Guid, status: T.RepairStatus) => post<T.Repair>(`/repairs/${id}/status`, { status }),
};

export const inspectionApi = {
  list: (params: { equipmentId?: T.Guid; unitId?: T.Guid }) => get<T.Inspection[]>('/inspections', params),
  record: (input: { unitId: T.Guid; date: string; passed: boolean; notes?: string | null }) => post<T.Inspection>('/inspections', input),
};

/** Notes, tasks and files of an equipment item, device or project. */
export const collaborationApi = {
  notes: (type: T.OwnerType, ownerId: T.Guid) => get<T.Note[]>(`/collaboration/${type}/${ownerId}/notes`),
  addNote: (type: T.OwnerType, ownerId: T.Guid, text: string) => post<T.Note>(`/collaboration/${type}/${ownerId}/notes`, { text }),
  updateNote: (id: T.Guid, text: string) => put<T.Note>(`/collaboration/notes/${id}`, { text }),
  removeNote: (id: T.Guid) => del(`/collaboration/notes/${id}`),
  tasks: (type: T.OwnerType, ownerId: T.Guid) => get<T.TaskItem[]>(`/collaboration/${type}/${ownerId}/tasks`),
  addTask: (type: T.OwnerType, ownerId: T.Guid, input: T.TaskInput) => post<T.TaskItem>(`/collaboration/${type}/${ownerId}/tasks`, input),
  updateTask: (id: T.Guid, input: T.TaskInput) => put<T.TaskItem>(`/collaboration/tasks/${id}`, input),
  setTaskCompleted: (id: T.Guid, isCompleted: boolean) => post<T.TaskItem>(`/collaboration/tasks/${id}/completed`, { isCompleted }),
  removeTask: (id: T.Guid) => del(`/collaboration/tasks/${id}`),
  files: (type: T.OwnerType, ownerId: T.Guid) => get<T.Attachment[]>(`/collaboration/${type}/${ownerId}/files`),
  uploadFile: (type: T.OwnerType, ownerId: T.Guid, file: File) => upload<T.Attachment>(`/collaboration/${type}/${ownerId}/files`, file),
  /** Also used for equipment/device images (imageAttachmentId). */
  download: (id: T.Guid) => fetchBlob(`/collaboration/files/${id}`),
  removeFile: (id: T.Guid) => del(`/collaboration/files/${id}`),
};

export const warehouseApi = {
  scan: (projectId: T.Guid, code: string, direction: T.ScanDirection, allowUnplanned = false) =>
    post<T.ScanResult>('/warehouse/scan', { projectId, code, direction, allowUnplanned }),
  scanSheet: (projectId: T.Guid) => get<T.ScanSheet>(`/warehouse/scan-sheet/${projectId}`),
  /** Warehouse: Prepped / OnLocation / Returned without project access. */
  setProjectStatus: (projectId: T.Guid, status: T.ProjectStatus) =>
    post<T.ScanSheet>(`/warehouse/projects/${projectId}/status`, { status }),
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
  changeStatus: (id: T.Guid, status: T.QuoteStatus, reason?: string | null) =>
    post<T.Quote>(`/quotes/${id}/status`, { status, reason }),
  revise: (id: T.Guid) => post<T.Quote>(`/quotes/${id}/revise`),
  /** Sales list: one row per job (project) with its newest quote. */
  jobs: (params: T.PagedRequest & { text?: string; view: T.QuoteJobView }) => get<T.PagedResult<T.QuoteJob>>('/quotes/jobs', params),
  /** New job: pending project + first draft quote. */
  createJob: (input: T.ProjectInput & { rentalFactorProfileId?: T.Guid | null }) => post<T.Quote>('/quotes/jobs', input),
  reopen: (id: T.Guid) => post<T.Quote>(`/quotes/${id}/reopen`),
  syncFromProject: (id: T.Guid) => post<T.Quote>(`/quotes/${id}/sync-from-project`),
  remove: (id: T.Guid) => del(`/quotes/${id}`),
};

/** Platform administration: customer firms, subscriptions, locations and firm users. */
export const hostApi = {
  summary: () => get<T.HostSummary>('/host/tenants/summary'),
  list: (params: T.PagedRequest & { text?: string }) => get<T.PagedResult<T.Tenant>>('/host/tenants', params),
  get: (id: T.Guid) => get<T.TenantDetail>(`/host/tenants/${id}`),
  create: (input: T.TenantInput & { location: T.TenantLocationInput; admin: T.TenantAdminInput }) =>
    post<T.TenantDetail>('/host/tenants', input),
  update: (id: T.Guid, input: T.TenantInput) => put<T.TenantDetail>(`/host/tenants/${id}`, input),
  setActive: (id: T.Guid, isActive: boolean) => post<T.TenantDetail>(`/host/tenants/${id}/active`, { isActive }),
  addLocation: (id: T.Guid, input: T.TenantLocationInput) => post<T.TenantDetail>(`/host/tenants/${id}/locations`, input),
  updateLocation: (id: T.Guid, locationId: T.Guid, input: T.TenantLocationInput) =>
    put<T.TenantDetail>(`/host/tenants/${id}/locations/${locationId}`, input),
  resetPassword: (id: T.Guid, userId: T.Guid, newPassword: string) =>
    post(`/host/tenants/${id}/users/${userId}/reset-password`, { newPassword }),
  impersonate: (userId: T.Guid) => post<T.LoginResult>(`/host/tenants/users/${userId}/impersonate`),
};

export const auditLogApi = {
  list: (params: T.PagedRequest & { text?: string }) => get<T.PagedResult<T.AuditLog>>('/audit-logs', params),
};

/** The signed-in user's firm: logo printed on quotes and packing slips. */
export const firmApi = {
  /** Null when the firm has no logo. */
  logo: () => http.get<Blob>('/firm/logo', { responseType: 'blob' }).then((r) => (r.status === 204 || r.data.size === 0 ? null : r.data)),
  setLogo: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.put('/firm/logo', form).then((r) => r.data);
  },
  removeLogo: () => del('/firm/logo'),
};
