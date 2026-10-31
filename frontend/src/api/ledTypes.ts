// Mirrors StageTrack.Application.Contracts/Led. Enums are sent as strings.
import type { Guid } from './types';

export const LED_ROLES = ['Panel', 'Processor', 'Extender'] as const;
export type LedRole = (typeof LED_ROLES)[number];

export const LED_PANEL_TYPES = ['Flat', 'Curve', 'SuperCurve', 'CurveCorner', 'Corner', 'Flexi', 'Floor'] as const;
export type LedPanelType = (typeof LED_PANEL_TYPES)[number];

export const LED_PANEL_GROUPS = ['Indoor', 'Outdoor', 'Poster', 'Other'] as const;
export type LedPanelGroup = (typeof LED_PANEL_GROUPS)[number];

export const LED_TRANSPORT_KINDS = ['Case', 'Dolly'] as const;
export type LedTransportKind = (typeof LED_TRANSPORT_KINDS)[number];

export const LED_STAGE_MOUNTS = ['Ground', 'Flown'] as const;
export type LedStageMount = (typeof LED_STAGE_MOUNTS)[number];

export const LED_STAGE_CARRIERS = ['Scaff', 'LedFrame'] as const;
export type LedStageCarrier = (typeof LED_STAGE_CARRIERS)[number];

/** Max power uses the panels' maximum watt, Average the average one. */
export const POWER_MODES = ['Max', 'Average'] as const;
export type PowerMode = (typeof POWER_MODES)[number];

export type WiringDirection = 'Columns' | 'Rows';
export type WiringStart = 'BottomLeft' | 'BottomRight' | 'TopLeft' | 'TopRight';
export type CurveMode = 'Arc' | 'Radius';
export type CurveDirection = 'Concave' | 'Convex';
/** Where panels-per-circuit came from: the panel's own figure, or worked out from its current. */
export type LinkSource = 'Fixed' | 'Current';

// ---------------------------------------------------------------- Inventory

export interface LedItem {
  equipmentId: Guid;
  role: LedRole;
  code: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  folderName?: string | null;
  weightKg?: number | null;
  isArchived: boolean;
  /** Owned pieces: devices for serial-tracked equipment, the stock count otherwise. */
  stock: number;
}

export interface LedPanel extends LedItem {
  pitchMm: number;
  widthMm: number;
  heightMm: number;
  pixelWidth: number;
  pixelHeight: number;
  wattMax?: number | null;
  wattAvg?: number | null;
  maxLink?: number | null;
  avgLink?: number | null;
  panelType: LedPanelType;
  group: LedPanelGroup;
  angleMin?: number | null;
  angleMax?: number | null;
  angleStep?: number | null;
  casePanelCount?: number | null;
  caseDimensionsCm?: string | null;
  caseWeightKg?: number | null;
  transportKind: LedTransportKind;
  maxStack?: number | null;
  receivingCard?: string | null;
  pwmHz?: number | null;
  hasExclusiveProcessors: boolean;
  compatibleProcessorIds: Guid[];
  isFavorite: boolean;
}

export interface LedProcessor extends LedItem {
  totalPixels: number;
  ethernetPorts: number;
  pixelsPerPort?: number | null;
  optPorts: number;
}

export interface LedExtender extends LedItem {
  ethernetPorts: number;
  fiberPorts: number;
  maxPixels: number;
}

export type LedPanelInput = Omit<LedPanel, keyof LedItem | 'isFavorite'>;
export type LedProcessorInput = Omit<LedProcessor, keyof LedItem>;
export type LedExtenderInput = Omit<LedExtender, keyof LedItem>;

export interface LedCatalogFilter {
  text?: string;
  group?: LedPanelGroup;
  folderId?: Guid;
  includeArchived?: boolean;
}

// ---------------------------------------------------------------- Calculation

export interface CutoutDto {
  width: number;
  height: number;
  left: number;
  bottom: number;
}

export interface CornerDto {
  afterColumn: number;
  panelModelId: Guid;
}

export interface CircuitLayoutDto {
  direction: WiringDirection;
  start: WiringStart;
  keepLinesWhole: boolean;
  serpentine?: boolean;
}

export interface SignalLayoutDto {
  direction: WiringDirection;
  start: WiringStart;
  serpentine?: boolean;
}

export interface CurveDto {
  mode: CurveMode;
  value: number;
  direction: CurveDirection;
}

/** One screen of the job; `panelModelId` is a StageTrack equipment id. */
export interface EvaluateScreenRequest {
  id: string;
  panelModelId?: Guid | null;
  columns: number;
  rows: number;
  selectedOption?: number;
  cutouts?: CutoutDto[] | null;
  corners?: CornerDto[] | null;
  layout?: CircuitLayoutDto | null;
  curve?: CurveDto | null;
  signalLayout?: SignalLayoutDto | null;
}

export interface EvaluateRequest {
  voltage: number;
  mode: PowerMode;
  screens: EvaluateScreenRequest[];
  wiring?: boolean;
}

export interface CircuitDto {
  screenId: string;
  index: number;
  panelCount: number;
  currentA: number;
}

export interface PhaseDto {
  phase: string;
  circuits: CircuitDto[];
  totalCurrentA: number;
}

export interface DistributionDto {
  optionId: string;
  ampsPerPhase: number;
  socapexOutputs: number;
  unitsNeeded: number;
}

export interface ScreenPowerDto {
  panelCount: number;
  widthMm: number;
  heightMm: number;
  resolutionX: number;
  resolutionY: number;
  totalWeightKg: number;
  totalWattMax: number;
  totalWattAvg: number;
  totalPixels: number;
  panelCurrentA: number;
  panelsPerCircuit: number;
  panelsPerCircuitSource: LinkSource;
  circuitsNeeded: number;
  socapexNeeded: number;
  circuits: CircuitDto[];
  wattMissing: boolean;
  phases: PhaseDto[];
  perPhaseMaxA: number;
  distribution: DistributionDto[];
  areaM2: number;
}

export interface ProcessorOptionDto {
  processorId: Guid;
  units: number;
  extenderId?: Guid | null;
  extenderUnits: number;
  portsUsed: number;
  pixelsUsed: number;
  pixelsCapacity: number;
  utilizationPercent: number;
}

export interface ScreenProcessorDto {
  options: ProcessorOptionDto[];
  selectedIndex: number;
}

export interface WiredCircuitDto {
  index: number;
  phase: string;
  socapex: number;
  cells: number[];
}

export interface ScreenWiringDto {
  locked: boolean;
  tooLarge: boolean;
  circuits: WiredCircuitDto[];
}

export interface PortChainDto {
  index: number;
  device: number;
  cvt?: number | null;
  cells: number[];
  pixels: number;
}

export interface ScreenSignalDto {
  locked: boolean;
  tooLarge: boolean;
  processorId?: Guid | null;
  extenderId?: Guid | null;
  portsNeeded: number;
  pixelsPerPort: number;
  ports: PortChainDto[];
}

export interface ScreenCurveDto {
  jointAnglesDeg: number[];
  targetJointDeg: number;
  appliedJointDeg: number;
  achievedArcDeg: number;
  achievedRadiusM?: number | null;
}

export interface ScreenEvaluationDto {
  id: string;
  panelFound: boolean;
  power?: ScreenPowerDto | null;
  processor?: ScreenProcessorDto | null;
  warnings: string[];
  wiring?: ScreenWiringDto | null;
  curve?: ScreenCurveDto | null;
  signal?: ScreenSignalDto | null;
}

export interface DeviceCountDto {
  id: Guid;
  count: number;
}

export interface JobPowerDto {
  totalWattMax: number;
  totalWattAvg: number;
  totalCurrentA: number;
  totalCircuits: number;
  totalSocapex: number;
  phases: PhaseDto[];
  perPhaseMaxA: number;
  distribution: DistributionDto[];
}

export interface JobProcessorDto {
  totalPixels: number;
  processors: DeviceCountDto[];
  extenders: DeviceCountDto[];
  totalProcessors: number;
  totalExtenders: number;
  infeasibleScreenCount: number;
}

export interface EvaluateResponse {
  screens: ScreenEvaluationDto[];
  job: { power?: JobPowerDto | null; processor: JobProcessorDto };
}

export interface CalcSettings {
  powerFactor: number;
  fuseAmpere: number;
  deratingPercent: number;
  circuitsPerSocapex: number;
  distributionOptions: { id: string; ampsPerPhase: number; socapexOutputs: number }[];
}

// ---------------------------------------------------------------- Non-LED power

export interface EquipmentLineRequest {
  id: string;
  equipmentId?: Guid | null;
  count: number;
}

export interface EquipmentPowerRequest {
  voltage: number;
  mode: PowerMode;
  lines: EquipmentLineRequest[];
}

export interface EquipmentLineDto {
  id: string;
  found: boolean;
  count: number;
  weightKg: number;
  watt: number;
  unitCurrentA: number;
  currentA: number;
  unitsPerCircuit: number;
  circuits: number;
}

export interface EquipmentPowerResponse {
  lines: EquipmentLineDto[];
  total: { count: number; weightKg: number; watt: number; currentA: number; circuits: number };
}

// ---------------------------------------------------------------- Transport

export interface TransportVehicle {
  id: Guid;
  name: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  capacityKg: number;
}

export type SaveTransportVehicle = Omit<TransportVehicle, 'id'> & { id?: Guid | null };

export interface TransportSettings {
  vehicles: TransportVehicle[];
  gapMm: number;
}

export interface TransportPlanRequest {
  screens: EvaluateScreenRequest[];
  vehicleId?: Guid | null;
  equipment?: { equipmentId: Guid; count: number }[] | null;
}

export interface TransportGroupDto {
  equipmentId: Guid;
  code: string;
  name: string;
  kind: LedTransportKind;
  panels: number;
  panelsPerCase: number;
  cases: number;
  heightCm: number;
  widthCm: number;
  depthCm: number;
  caseWeightKg?: number | null;
  maxStack: number;
}

export interface TransportMissingDto {
  equipmentId: Guid;
  code: string;
  name: string;
  panels: number;
  fields: string[];
}

export interface PlanStackDto {
  id: string;
  equipmentId: Guid;
  cases: number;
  panels: number;
  x: number;
  y: number;
  rotated: boolean;
}

export interface TransportPlanResponse {
  vehicleTypes: TransportVehicle[];
  gapMm: number;
  groups: TransportGroupDto[];
  missing: TransportMissingDto[];
  vehicles: { typeId: Guid; stacks: PlanStackDto[] }[];
  unplaced: PlanStackDto[];
}

// ---------------------------------------------------------------- 3D stage

export interface LedStageSettings {
  stageWidthM: number;
  stageDepthM: number;
  stageHeightM: number;
  frontGapM: number;
  mount: LedStageMount;
  carrier: LedStageCarrier;
  legDepthM: number;
  bottomM: number;
  groundSupport: boolean;
  groundSupportHeightM: number;
  trussHeightM: number;
  hangAllowanceM: number;
}

// ---------------------------------------------------------------- Stock status

export interface LedStockScreenRequest {
  id: string;
  equipmentId?: Guid | null;
  stockLocationId?: Guid | null;
  columns: number;
  rows: number;
  cutouts?: CutoutDto[] | null;
  corners?: { afterColumn: number; equipmentId: Guid; stockLocationId?: Guid | null }[] | null;
}

export interface LedStockLine {
  equipmentId: Guid;
  code: string;
  name: string;
  pitchMm: number;
  group: LedPanelGroup;
  panelType: LedPanelType;
  widthMm: number;
  heightMm: number;
  quantity: number;
  panelAreaM2: number;
  used: number;
}

export interface LedStockStatusResponse {
  locations: { id?: Guid | null; name: string; lines: LedStockLine[] }[];
}

// ---------------------------------------------------------------- Job transfer

export type LedJobLineSource = 'Panel' | 'Processor' | 'Extender' | 'Equipment';

export interface LedToJobInput {
  screens: LedStockScreenRequest[];
  processors?: { equipmentId: Guid; count: number }[];
  extenders?: { equipmentId: Guid; count: number }[];
  equipment?: { equipmentId: Guid; count: number }[];
  sectionId?: Guid | null;
  sectionName?: string | null;
  append?: boolean;
}

export interface LedJobLine {
  source: LedJobLineSource;
  equipmentId: Guid;
  code: string;
  name: string;
  quantity: number;
  added: boolean;
  problem?: string | null;
}

export interface LedToJobResult {
  projectId: Guid;
  sectionId?: Guid | null;
  sectionName: string;
  lines: LedJobLine[];
}
