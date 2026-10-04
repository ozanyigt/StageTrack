// Mirrors the backend DTOs (StageTrack.Application.Contracts). Enums are sent as strings.

export type Guid = string;

export interface PagedResult<T> {
  totalCount: number;
  items: T[];
}

export interface PagedRequest {
  skipCount?: number;
  maxResultCount?: number;
  sorting?: string;
}

export interface Lookup {
  id: Guid;
  name: string;
  code?: string | null;
}

// Account
export interface Company {
  id: Guid;
  name: string;
  code: string;
  defaultCurrency: string;
  defaultVatRate: number;
  countryCode: string;
}

export interface CurrentUser {
  id: Guid;
  userName: string;
  fullName: string;
  email?: string | null;
  language: string;
  roles: string[];
  permissions: string[];
  companies: Company[];
  /** Set while an admin is signed in as this user. */
  impersonatorName?: string | null;
}

export interface LoginResult {
  accessToken: string;
  expiresAt: string;
  user: CurrentUser;
}

// Inventory
export const EQUIPMENT_TYPES = ['Physical', 'Consumable', 'Sale'] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const UNIT_STATUSES = ['InStock', 'OnProject', 'InRepair', 'Lost'] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export const LABEL_TYPES = ['RentmanQr', 'Qr', 'Barcode', 'Rfid'] as const;
export type LabelType = (typeof LABEL_TYPES)[number];

export const STOCK_LOCATION_TYPES = ['Warehouse', 'StorageLocation'] as const;
export type StockLocationType = (typeof STOCK_LOCATION_TYPES)[number];

export interface EquipmentFolder {
  id: Guid;
  name: string;
  parentId?: Guid | null;
  sortOrder: number;
}

export interface Equipment {
  id: Guid;
  code: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  folderId?: Guid | null;
  type: EquipmentType;
  isSerialized: boolean;
  stock: number;
  rentalPrice: number;
  weightKg?: number | null;
  volumeM3?: number | null;
  notes?: string | null;
  isArchived: boolean;
}

export interface EquipmentDetail extends Equipment {
  stockQuantity: number;
  labels: Label[];
  unitStatusCounts: Partial<Record<UnitStatus, number>>;
}

export interface EquipmentInput {
  code: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  folderId?: Guid | null;
  type: EquipmentType;
  isSerialized: boolean;
  stockQuantity: number;
  rentalPrice: number;
  weightKg?: number | null;
  volumeM3?: number | null;
  notes?: string | null;
}

export interface EquipmentLookup {
  id: Guid;
  code: string;
  name: string;
  isSerialized: boolean;
  rentalPrice: number;
}

export interface EquipmentUnit {
  id: Guid;
  equipmentId: Guid;
  equipmentCode: string;
  equipmentName: string;
  internalRef: string;
  serialNumber?: string | null;
  stockLocationId?: Guid | null;
  stockLocationName?: string | null;
  status: UnitStatus;
  currentProjectId?: Guid | null;
  currentProjectNumber?: number | null;
  currentProjectName?: string | null;
  notes?: string | null;
  labelCount: number;
}

export interface Label {
  id: Guid;
  code: string;
  rawValue: string;
  type: LabelType;
  equipmentId: Guid;
  unitId?: Guid | null;
  creationTime: string;
}

export interface ResolveLabelResult {
  found: boolean;
  code: string;
  label?: Label | null;
  equipment?: Equipment | null;
  unit?: EquipmentUnit | null;
}

export interface StockLocation {
  id: Guid;
  name: string;
  type: StockLocationType;
  address?: string | null;
  city?: string | null;
  isActive: boolean;
}

// Customers
export interface Customer {
  id: Guid;
  name: string;
  taxNumber?: string | null;
  taxOffice?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
}

// Projects
export const PROJECT_STATUSES = ['Draft', 'Pending', 'Confirmed', 'Prepped', 'OnLocation', 'Returned', 'Cancelled'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectListItem {
  id: Guid;
  number: number;
  name: string;
  customerId?: Guid | null;
  customerName?: string | null;
  venue?: string | null;
  planStart: string;
  planEnd: string;
  useStart?: string | null;
  useEnd?: string | null;
  status: ProjectStatus;
  color: string;
  projectType?: string | null;
  stockLocationId?: Guid | null;
  stockLocationName?: string | null;
  plannedQuantity: number;
}

export interface ProjectEquipment {
  id: Guid;
  equipmentId: Guid;
  equipmentCode: string;
  equipmentName: string;
  isSerialized: boolean;
  rentalPrice: number;
  quantity: number;
  notes?: string | null;
  stock: number;
  plannedElsewhere: number;
  available: number;
  shortage: number;
  outQuantity: number;
  returnedQuantity: number;
}

export interface Project extends ProjectListItem {
  notes?: string | null;
  rentalDays: number;
  isEditable: boolean;
  allowedStatuses: ProjectStatus[];
  equipment: ProjectEquipment[];
  shortageCount: number;
}

export interface ProjectInput {
  name: string;
  customerId?: Guid | null;
  venue?: string | null;
  planStart: string;
  planEnd: string;
  useStart?: string | null;
  useEnd?: string | null;
  color: string;
  projectType?: string | null;
  stockLocationId?: Guid | null;
  notes?: string | null;
}

// Warehouse
export type ScanDirection = 'Out' | 'In';
export type ScanWarning = 'NotPlanned' | 'OverPlanned';
export const MOVEMENT_ACTIONS = ['CheckOut', 'CheckIn', 'LabelAssigned', 'ProjectStatusChanged'] as const;
export type MovementAction = (typeof MOVEMENT_ACTIONS)[number];

export interface ScanResult {
  direction: ScanDirection;
  labelCode: string;
  equipmentId: Guid;
  equipmentCode: string;
  equipmentName: string;
  unitId?: Guid | null;
  unitInternalRef?: string | null;
  unitSerialNumber?: string | null;
  plannedQuantity: number;
  outQuantity: number;
  alreadyScanned: boolean;
  warnings: ScanWarning[];
}

export interface PackingLine {
  equipmentId: Guid;
  equipmentCode: string;
  equipmentName: string;
  isSerialized: boolean;
  planned: number;
  out: number;
  returned: number;
  unitsOut: string[];
}

export interface PackingList {
  projectId: Guid;
  number: number;
  name: string;
  status: ProjectStatus;
  customerName?: string | null;
  venue?: string | null;
  planStart: string;
  planEnd: string;
  lines: PackingLine[];
  totalPlanned: number;
  totalOut: number;
}

export interface WarehouseBoard {
  date: string;
  confirmed: ProjectListItem[];
  prepped: ProjectListItem[];
  onLocation: ProjectListItem[];
  expectedBack: ProjectListItem[];
  delayed: ProjectListItem[];
}

export interface Movement {
  id: Guid;
  creationTime: string;
  action: MovementAction;
  equipmentId: Guid;
  equipmentCode: string;
  equipmentName: string;
  unitId?: Guid | null;
  unitInternalRef?: string | null;
  unitSerialNumber?: string | null;
  projectId?: Guid | null;
  projectNumber?: number | null;
  projectName?: string | null;
  userFullName?: string | null;
  labelCode?: string | null;
  quantity: number;
}

// Pricing & quotes
export interface RentalFactorStep {
  days: number;
  factor: number;
}

export interface RentalFactorProfile {
  id: Guid;
  name: string;
  isDefault: boolean;
  extraDayFactor: number;
  steps: RentalFactorStep[];
}

export interface RentalFactorProfileInput {
  name: string;
  isDefault: boolean;
  extraDayFactor: number;
  steps: RentalFactorStep[];
}

export interface FactorPreview {
  days: number;
  factor: number;
  isDefinedStep: boolean;
}

export const QUOTE_STATUSES = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Superseded'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_LINE_TYPES = ['Equipment', 'Crew', 'Transport', 'Service'] as const;
export type QuoteLineType = (typeof QUOTE_LINE_TYPES)[number];

export interface QuoteListItem {
  id: Guid;
  number: string;
  revision: number;
  status: QuoteStatus;
  issueDate: string;
  validUntil?: string | null;
  currency: string;
  grandTotal: number;
  projectId: Guid;
  projectNumber: number;
  projectName: string;
  customerName?: string | null;
}

export interface QuoteLine {
  id: Guid;
  sortOrder: number;
  type: QuoteLineType;
  equipmentId?: Guid | null;
  equipmentCode?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  applyFactor: boolean;
  discountPercent: number;
  total: number;
}

export interface Quote extends QuoteListItem {
  rentalFactorProfileId?: Guid | null;
  rentalFactorProfileName?: string | null;
  rentalDays: number;
  factor: number;
  discountPercent: number;
  vatRate: number;
  notes?: string | null;
  subtotal: number;
  discountAmount: number;
  netTotal: number;
  vatAmount: number;
  isEditable: boolean;
  allowedStatuses: QuoteStatus[];
  lines: QuoteLine[];
  venue?: string | null;
  useStart?: string | null;
  useEnd?: string | null;
  customer?: Customer | null;
  company: Company;
}

export interface QuoteHeaderInput {
  issueDate: string;
  validUntil?: string | null;
  discountPercent: number;
  vatRate: number;
  notes?: string | null;
  rentalDays: number;
  rentalFactorProfileId?: Guid | null;
  manualFactor?: number | null;
}

export interface QuoteLineInput {
  type: QuoteLineType;
  equipmentId?: Guid | null;
  description?: string | null;
  quantity: number;
  unitPrice?: number | null;
  applyFactor: boolean;
  discountPercent: number;
}

// Dashboard
export interface ShortageSummary {
  projectId: Guid;
  projectNumber: number;
  projectName: string;
  planStart: string;
  missingQuantity: number;
  lineCount: number;
}

export interface Dashboard {
  projectsByStatus: Partial<Record<ProjectStatus, number>>;
  unitsByStatus: Partial<Record<UnitStatus, number>>;
  upcoming: ProjectListItem[];
  shortages: ShortageSummary[];
  recentMovements: Movement[];
}

// Identity
export interface PermissionDefinition {
  name: string;
  parent?: string | null;
}

export interface PermissionGroup {
  name: string;
  permissions: PermissionDefinition[];
}

export interface Role {
  id: Guid;
  name: string;
  isStatic: boolean;
  userCount: number;
  permissions: string[];
}

export interface User {
  id: Guid;
  userName: string;
  fullName: string;
  email?: string | null;
  isActive: boolean;
  language: string;
  creationTime: string;
  roleIds: Guid[];
  companyIds: Guid[];
}

export interface CreateUserInput {
  userName: string;
  fullName: string;
  email?: string | null;
  password: string;
  language: string;
  roleIds: Guid[];
  companyIds: Guid[];
}

export interface UpdateUserInput {
  fullName: string;
  email?: string | null;
  roleIds: Guid[];
  companyIds: Guid[];
}
