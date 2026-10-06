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
  /** Platform administrator: sees only the platform admin panel. */
  isHost: boolean;
  tenantName?: string | null;
  /** Last day of the firm's subscription (renewal warning). */
  subscriptionEndDate?: string | null;
  /** The firm uploaded a logo (GET /firm/logo). */
  hasFirmLogo: boolean;
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

export const RELATION_KINDS = ['Content', 'Accessory', 'Alternative'] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

export interface EquipmentFolder {
  id: Guid;
  name: string;
  parentId?: Guid | null;
  sortOrder: number;
  equipmentCount: number;
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
  /** Null when the user may not see prices. */
  rentalPrice?: number | null;
  weightKg?: number | null;
  volumeM3?: number | null;
  notes?: string | null;
  isArchived: boolean;
  folderName?: string | null;
  countryOfOrigin?: string | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  powerW?: number | null;
  /** False: office/internal equipment that cannot be planned on projects or quotes. */
  showInQuotes: boolean;
  /** Quantity-tracked equipment: purchase data (devices keep it per device). */
  purchaseDate?: string | null;
  warrantyEndDate?: string | null;
  purchaseSupplierId?: Guid | null;
  purchaseSupplierName?: string | null;
  /** Cases/sets whose default content includes this equipment. */
  containedIn: EquipmentRef[];
}

export interface EquipmentRef {
  id: Guid;
  code: string;
  name: string;
}

export interface EquipmentRelation {
  id: Guid;
  kind: RelationKind;
  equipmentId: Guid;
  equipmentCode: string;
  equipmentName: string;
  quantity: number;
  stock: number;
}

export interface EquipmentSupplierLink {
  id: Guid;
  supplierId: Guid;
  supplierName: string;
  supplierCode?: string | null;
  purchasePrice?: number | null;
  isPreferred: boolean;
}

export interface StockRow {
  stockLocationId?: Guid | null;
  stockLocationName?: string | null;
  status: UnitStatus;
  count: number;
}

export interface EquipmentDetail extends Equipment {
  stockQuantity: number;
  /** Price typed by hand; otherwise a case's price follows its content total. */
  isPriceManual: boolean;
  /** Total price of the default content (null without content or price permission). */
  contentPriceTotal?: number | null;
  countryOfOrigin?: string | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  powerW?: number | null;
  currentA?: number | null;
  packedPer: number;
  imageAttachmentId?: Guid | null;
  inspectionIntervalMonths?: number | null;
  inspectionDescription?: string | null;
  folderPath?: string | null;
  labels: Label[];
  unitStatusCounts: Partial<Record<UnitStatus, number>>;
  relations: EquipmentRelation[];
  suppliers: EquipmentSupplierLink[];
  /** Equipment that contains this one as default content. */
  partOf: EquipmentRelation[];
  stockRows: StockRow[];
}

export interface EquipmentInput {
  code: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  folderId?: Guid | null;
  type: EquipmentType;
  isSerialized: boolean;
  countryOfOrigin?: string | null;
  stockQuantity: number;
  rentalPrice?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  volumeM3?: number | null;
  powerW?: number | null;
  currentA?: number | null;
  packedPer: number;
  inspectionIntervalMonths?: number | null;
  inspectionDescription?: string | null;
  notes?: string | null;
  showInQuotes: boolean;
  purchaseDate?: string | null;
  warrantyEndDate?: string | null;
  purchaseSupplierId?: Guid | null;
}

export interface EquipmentLookup {
  id: Guid;
  code: string;
  name: string;
  isSerialized: boolean;
  rentalPrice?: number | null;
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
  /** Rich text (sanitized HTML). */
  notes?: string | null;
  labelCount: number;
  isArchived: boolean;
  purchaseDate?: string | null;
  warrantyDate?: string | null;
  replacementDate?: string | null;
  supplierId?: Guid | null;
  supplierName?: string | null;
  lastInspectionDate?: string | null;
  nextInspectionDate?: string | null;
  imageAttachmentId?: Guid | null;
}

export interface EquipmentUnitDetail extends EquipmentUnit {
  equipmentBrand?: string | null;
  equipmentModel?: string | null;
  inspectionIntervalMonths?: number | null;
  labels: Label[];
}

export interface UnitInput {
  internalRef: string;
  serialNumber?: string | null;
  stockLocationId?: Guid | null;
  notes?: string | null;
  purchaseDate?: string | null;
  warrantyDate?: string | null;
  replacementDate?: string | null;
  supplierId?: Guid | null;
}

export interface TransferResult {
  targetCompanyId: Guid;
  targetCompanyName: string;
  targetLocationName: string;
  unitCount: number;
}

export interface PrintLabelItem {
  equipmentId: Guid;
  unitId?: Guid | null;
  equipmentCode: string;
  equipmentName: string;
  brand?: string | null;
  model?: string | null;
  internalRef?: string | null;
  serialNumber?: string | null;
  /** Exact text encoded in the QR (Rentman JSON). */
  qrValue: string;
  code: string;
  isNew: boolean;
}

export interface LabelTemplate {
  id: Guid;
  name: string;
  widthMm: number;
  heightMm: number;
  qrSizeMm: number;
  fontSizePt: number;
  showName: boolean;
  showBrand: boolean;
  showModel: boolean;
  showCode: boolean;
  showInternalRef: boolean;
  showSerialNumber: boolean;
  showCompanyName: boolean;
  isDefault: boolean;
}

export type LabelTemplateInput = Omit<LabelTemplate, 'id'>;

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

export interface ProjectSection {
  id: Guid;
  parentId?: Guid | null;
  name: string;
  sortOrder: number;
  depth: number;
  /** "SES / Hoparlör" */
  path: string;
  /** The "added products" section the warehouse created while scanning. */
  isWarehouseExtras: boolean;
}

export interface Alternative {
  equipmentId: Guid;
  code: string;
  name: string;
  available: number;
}

export interface ProjectCrew {
  id: Guid;
  userId: Guid;
  fullName: string;
  jobTitle?: string | null;
  phone?: string | null;
  email?: string | null;
  function?: string | null;
}

export interface ProjectEquipment {
  id: Guid;
  equipmentId: Guid;
  sectionId?: Guid | null;
  sortOrder: number;
  equipmentCode: string;
  equipmentName: string;
  isSerialized: boolean;
  rentalPrice?: number | null;
  quantity: number;
  notes?: string | null;
  stock: number;
  plannedElsewhere: number;
  available: number;
  shortage: number;
  outQuantity: number;
  returnedQuantity: number;
  alternatives: Alternative[];
  /** Content line of a case: the case line it belongs to (shown indented, follows the case). */
  parentLineId?: Guid | null;
  contentQuantity: number;
  /** Added by the warehouse while scanning; not on the quote. */
  isExtra: boolean;
}

export interface Project extends ProjectListItem {
  notes?: string | null;
  rentalDays: number;
  isEditable: boolean;
  allowedStatuses: ProjectStatus[];
  equipment: ProjectEquipment[];
  sections: ProjectSection[];
  crew: ProjectCrew[];
  shortageCount: number;
  accountManagerId?: Guid | null;
  accountManagerName?: string | null;
  paymentTerms?: string | null;
  /** Crew member's read-only, price-free view. */
  isCrewView: boolean;
}

export interface PackingSlipLine {
  code: string;
  name: string;
  quantity: number;
  notes?: string | null;
  content: PackingSlipLine[];
}

export interface PackingSlipSection {
  name?: string | null;
  isWarehouseExtras: boolean;
  depth: number;
  lines: PackingSlipLine[];
}

export interface PackingSlip {
  projectId: Guid;
  projectNumber: number;
  projectName: string;
  customerName?: string | null;
  venue?: string | null;
  accountManagerName?: string | null;
  paymentTerms?: string | null;
  planStart: string;
  planEnd: string;
  useStart?: string | null;
  useEnd?: string | null;
  createdAt: string;
  companyName: string;
  sections: PackingSlipSection[];
  crew: ProjectCrew[];
}

export interface CrewDirectoryEntry {
  userId: Guid;
  fullName: string;
  jobTitle?: string | null;
  phone?: string | null;
  email?: string | null;
  roles: string[];
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
  accountManagerId?: Guid | null;
  paymentTerms?: string | null;
}

// Warehouse
export type ScanDirection = 'Out' | 'In';
export type ScanWarning = 'NotPlanned' | 'OverPlanned';
export const MOVEMENT_ACTIONS = ['CheckOut', 'CheckIn', 'LabelAssigned', 'ProjectStatusChanged', 'TransferOut', 'TransferIn'] as const;
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
  /** Nothing recorded: ask "not on the quote / more than planned — add it?", then scan again with allowUnplanned. */
  requiresConfirmation: boolean;
}

export interface ScanSheetSection {
  id: Guid;
  parentId?: Guid | null;
  name: string;
  depth: number;
  isWarehouseExtras: boolean;
}

export interface ScanSheetUnit {
  unitId: Guid;
  internalRef: string;
  serialNumber?: string | null;
}

export interface ScanSheetLine {
  lineId: Guid;
  parentLineId?: Guid | null;
  sectionId?: Guid | null;
  equipmentId: Guid;
  code: string;
  name: string;
  isSerialized: boolean;
  isExtra: boolean;
  planned: number;
  out: number;
  returned: number;
  /** Devices currently out for this line, e.g. TR-003. */
  unitsOut: ScanSheetUnit[];
  unitsReturned: ScanSheetUnit[];
}

/** Scan screen data: the planned list in the quote's sections with what is out / back. */
export interface ScanSheet {
  projectId: Guid;
  number: number;
  name: string;
  status: ProjectStatus;
  customerName?: string | null;
  venue?: string | null;
  planStart: string;
  planEnd: string;
  /** Statuses the warehouse may set: Prepped, OnLocation, Returned. */
  allowedStatuses: ProjectStatus[];
  sections: ScanSheetSection[];
  lines: ScanSheetLine[];
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
  note?: string | null;
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
  /** Why the customer declined (rejected quotes). */
  rejectionReason?: string | null;
  /** Statuses it can be set to (status drop-down). */
  allowedStatuses: QuoteStatus[];
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
  section?: string | null;
  notes?: string | null;
  /** Content of the case line above it: listed, not priced. */
  isContent: boolean;
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
  lines: QuoteLine[];
  venue?: string | null;
  useStart?: string | null;
  useEnd?: string | null;
  customer?: Customer | null;
  company: Company;
  preparedByName?: string | null;
  paymentTerms?: string | null;
  sectionNames: string[];
  projectStatus: ProjectStatus;
  /** Only the newest revision can be reopened after a rejection. */
  isLatestRevision: boolean;
}

/** Sales list views: waiting for the customer / lost (rejected, cancelled) / everything. */
export const QUOTE_JOB_VIEWS = ['Active', 'Lost', 'All'] as const;
export type QuoteJobView = (typeof QUOTE_JOB_VIEWS)[number];

/** One job on the sales list with its newest quote and all revisions (newest first). */
export interface QuoteJob {
  project: ProjectListItem;
  latestQuote?: QuoteListItem | null;
  quotes: QuoteListItem[];
}

/** Project statuses shown under Projects; earlier (and lost) jobs live under Quotes. */
export const CONFIRMED_PROJECT_STATUSES: ProjectStatus[] = ['Confirmed', 'Prepped', 'OnLocation', 'Returned'];
export const SALES_PROJECT_STATUSES: ProjectStatus[] = ['Draft', 'Pending', 'Cancelled'];

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
  section?: string | null;
  notes?: string | null;
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
  /** Crew members: their confirmed projects. */
  myProjects: ProjectListItem[];
  openRepairs: number;
  overdueInspections: number;
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
  phone?: string | null;
  jobTitle?: string | null;
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
  phone?: string | null;
  jobTitle?: string | null;
  password: string;
  language: string;
  roleIds: Guid[];
  companyIds: Guid[];
}

export interface UpdateUserInput {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  roleIds: Guid[];
  companyIds: Guid[];
}

// Suppliers
export interface Supplier {
  id: Guid;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  website?: string | null;
  notes?: string | null;
}

export type SupplierInput = Omit<Supplier, 'id'>;

// Maintenance
export const REPAIR_STATUSES = ['Open', 'InProgress', 'Completed', 'Cancelled'] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export interface Repair {
  id: Guid;
  number: number;
  equipmentId: Guid;
  equipmentCode: string;
  equipmentName: string;
  unitId?: Guid | null;
  unitInternalRef?: string | null;
  quantity: number;
  title: string;
  description?: string | null;
  status: RepairStatus;
  reportedAt: string;
  completedAt?: string | null;
  supplierId?: Guid | null;
  supplierName?: string | null;
  cost?: number | null;
  allowedStatuses: RepairStatus[];
}

export interface RepairInput {
  equipmentId: Guid;
  unitId?: Guid | null;
  quantity: number;
  title: string;
  description?: string | null;
  supplierId?: Guid | null;
  cost?: number | null;
}

export interface Inspection {
  id: Guid;
  unitId: Guid;
  unitInternalRef: string;
  date: string;
  passed: boolean;
  notes?: string | null;
  inspectorName?: string | null;
}

// Collaboration (notes, tasks, files of equipment, devices and projects)
export type OwnerType = 'Equipment' | 'Unit' | 'Project';

export interface Note {
  id: Guid;
  text: string;
  creationTime: string;
  authorName?: string | null;
  canEdit: boolean;
}

export interface TaskItem {
  id: Guid;
  title: string;
  description?: string | null;
  assignedUserId?: Guid | null;
  assignedUserName?: string | null;
  dueDate?: string | null;
  isCompleted: boolean;
  completedAt?: string | null;
  creationTime: string;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  assignedUserId?: Guid | null;
  dueDate?: string | null;
}

export interface Attachment {
  id: Guid;
  fileName: string;
  contentType: string;
  size: number;
  creationTime: string;
  uploaderName?: string | null;
}

// Excel import
export interface ImportError {
  row: number;
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export interface ImportResult {
  created: number;
  updated: number;
  errors: ImportError[];
}

export interface EquipmentImportRow {
  row: number;
  code?: string | null;
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  folder?: string | null;
  isSerialized?: boolean | null;
  stockQuantity?: number | null;
  rentalPrice?: number | null;
  weightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  powerW?: number | null;
  notes?: string | null;
}

export interface UnitImportRow {
  row: number;
  equipmentCode?: string | null;
  internalRef?: string | null;
  serialNumber?: string | null;
  stockLocation?: string | null;
  purchaseDate?: string | null;
  labelCode?: string | null;
}

export interface CustomerImportRow {
  row: number;
  name?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
}

// Platform administration (customer firms / subscriptions)
export const TENANT_STATUSES = ['Active', 'Suspended', 'Expired', 'NotStarted'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export interface Tenant {
  id: Guid;
  name: string;
  code: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  isActive: boolean;
  status: TenantStatus;
  planName: string;
  startDate: string;
  endDate?: string | null;
  maxUsers?: number | null;
  maxLocations?: number | null;
  userCount: number;
  locationCount: number;
  creationTime: string;
  daysLeft?: number | null;
}

export interface TenantLocation extends Company {
  rentmanWorkspaceId?: number | null;
}

export interface TenantUser {
  id: Guid;
  userName: string;
  fullName: string;
  email?: string | null;
  isActive: boolean;
  roles: string[];
  creationTime: string;
}

export interface TenantDetail extends Tenant {
  locations: TenantLocation[];
  users: TenantUser[];
}

export interface HostSummary {
  total: number;
  active: number;
  suspended: number;
  expired: number;
  expiringSoon: number;
}

export interface TenantInput {
  name: string;
  code: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  planName: string;
  startDate: string;
  endDate?: string | null;
  maxUsers?: number | null;
  maxLocations?: number | null;
}

export interface TenantLocationInput {
  name: string;
  code: string;
  currency: string;
  vatRate: number;
  countryCode: string;
  rentmanWorkspaceId?: number | null;
  warehouseName?: string | null;
}

export interface TenantAdminInput {
  userName: string;
  fullName: string;
  email?: string | null;
  password: string;
  language: string;
}

// Audit log (sensitive operations such as deleting equipment)
export interface AuditLog {
  id: Guid;
  creationTime: string;
  action: string;
  entityType: string;
  entityId?: Guid | null;
  description: string;
  userName?: string | null;
  userFullName?: string | null;
  impersonatorName?: string | null;
}
