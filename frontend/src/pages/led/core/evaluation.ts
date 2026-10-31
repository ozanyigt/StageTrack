import type {
  CircuitDto,
  DistributionDto,
  EvaluateRequest,
  EvaluateResponse,
  JobPowerDto,
  JobProcessorDto,
  PhaseDto,
  ProcessorOptionDto,
  ScreenPowerDto,
} from "../../../api/ledTypes";
import type {
  CircuitInfo,
  DistributionRecommendation,
  ExtenderRow,
  HesapModu,
  IslemciRow,
  JobAutoSummary,
  JobPowerSummary,
  PhaseAssignment,
  ProcessorPrefs,
  ProcessorRecommendation,
  ScreenCalcOutputLike,
  WallConfig,
} from "./types";
import { fitShape } from "./simulation/shape";
import { layoutToSend, signalLayoutToSend } from "./simulation/wiring";
import { curveOf } from "./simulation/curve";

// The job calculation runs on the server (POST /api/calc/evaluate). This file builds its request from the
// shared screen list and turns its response into the shapes the result cards, exports and PDF use.

/**
 * The request for the current screens; screens without a panel are sent too (they come back empty). Shape fields
 * go only when set (an unshaped screen's request is exactly what it always was) and cut-outs / corners only with
 * the plan feature (`allowShape`), a power layout only with maps (`allowMaps`): the server would refuse them
 * otherwise. `wiring` asks for the circuit map (Simülasyon).
 */
export function buildEvaluateRequest(
  screens: WallConfig[],
  voltage: number,
  mode: HesapModu,
  prefs: ProcessorPrefs,
  allowShape = true,
  { allowMaps = true, wiring = false }: { allowMaps?: boolean; wiring?: boolean } = {},
): EvaluateRequest {
  return {
    voltage,
    mode: mode === "max" ? "Max" : "Average",
    ...(wiring ? { wiring: true } : {}),
    screens: screens.map((s) => {
      const shape = fitShape(s, allowShape);
      const layout = layoutToSend(s, allowMaps);
      const signalLayout = signalLayoutToSend(s, allowMaps);
      const curve = curveOf(s);
      return {
        id: s.id,
        panelModelId: s.panel?.PanelModelId ?? null,
        columns: s.widthPanels,
        rows: s.heightPanels,
        selectedOption: prefs.perScreenRecommendationChoice[s.id] ?? 0,
        ...(shape.cutouts.length > 0 ? { cutouts: shape.cutouts } : {}),
        ...(shape.corners.length > 0 ? { corners: shape.corners.map((c) => ({ afterColumn: c.afterColumn, panelModelId: c.panel.PanelModelId })) } : {}),
        ...(layout ? { layout } : {}),
        ...(signalLayout ? { signalLayout } : {}),
        ...(curve ? { curve } : {}),
      };
    }),
  };
}

/** The id calculation results use for a processor / extender ("Marka|Model" for fixtures without an API id). */
export function deviceId(row: Pick<IslemciRow, "Id" | "Marka" | "Model">): string {
  return row.Id ?? `${row.Marka}|${row.Model}`;
}

/** The server's result for one screen (undefined while none has arrived, or for an unknown screen). */
export function screenEvaluation(evaluation: EvaluateResponse | undefined, screenId: string) {
  return evaluation?.screens.find((s) => s.id === screenId);
}

function toCircuit(dto: CircuitDto, nameOf: (screenId: string) => string): CircuitInfo {
  return { id: `${dto.screenId}-c${dto.index}`, panelCount: dto.panelCount, currentA: dto.currentA, screenId: dto.screenId, screenName: nameOf(dto.screenId) };
}

function toPhases(phases: PhaseDto[], nameOf: (screenId: string) => string): PhaseAssignment[] {
  return phases.map((p) => ({ phase: p.phase as PhaseAssignment["phase"], circuits: p.circuits.map((c) => toCircuit(c, nameOf)), totalCurrentA: p.totalCurrentA }));
}

function toDistribution(distribution: DistributionDto[]): DistributionRecommendation[] {
  return distribution.map((d) => ({
    option: { id: d.optionId, labelKey: `dist.${d.optionId}`, ampsPerPhase: d.ampsPerPhase, socapexOutputs: d.socapexOutputs },
    unitsNeeded: d.unitsNeeded,
  }));
}

/** A screen's size / power / circuits as the screen card and result blocks show them. */
export function toScreenOutput(dto: ScreenPowerDto, screenName: string): ScreenCalcOutputLike {
  return {
    panelCount: dto.panelCount,
    widthMm: dto.widthMm,
    heightMm: dto.heightMm,
    areaM2: dto.areaM2,
    resolutionX: dto.resolutionX,
    resolutionY: dto.resolutionY,
    totalWeightKg: dto.totalWeightKg,
    totalWattMax: dto.totalWattMax,
    totalWattAvg: dto.totalWattAvg,
    totalPixels: dto.totalPixels,
    panelCurrentA: dto.panelCurrentA,
    panelsPerCircuit: dto.panelsPerCircuit,
    panelsPerCircuitSource: dto.panelsPerCircuitSource === "Fixed" ? "fixed" : "current",
    circuitsNeeded: dto.circuitsNeeded,
    socapexNeeded: dto.socapexNeeded,
    circuits: dto.circuits.map((c) => toCircuit(c, () => screenName)),
    wattMissing: dto.wattMissing,
  };
}

export function toScreenPhases(dto: ScreenPowerDto, screenName: string): { phases: PhaseAssignment[]; perPhaseMaxA: number; distribution: DistributionRecommendation[] } {
  return { phases: toPhases(dto.phases, () => screenName), perPhaseMaxA: dto.perPhaseMaxA, distribution: toDistribution(dto.distribution) };
}

export function toJobPowerSummary(dto: JobPowerDto, nameOf: (screenId: string) => string): JobPowerSummary {
  return {
    totalWattMax: dto.totalWattMax,
    totalWattAvg: dto.totalWattAvg,
    totalCurrentA: dto.totalCurrentA,
    totalCircuits: dto.totalCircuits,
    totalSocapex: dto.totalSocapex,
    phases: toPhases(dto.phases, nameOf),
    perPhaseMaxA: dto.perPhaseMaxA,
    distribution: toDistribution(dto.distribution),
  };
}

/** An option card; null when the inventory no longer lists its processor / extender. */
export function toRecommendation(dto: ProcessorOptionDto, islemciler: IslemciRow[], extenderlar: ExtenderRow[]): ProcessorRecommendation | null {
  const islemci = islemciler.find((i) => deviceId(i) === dto.processorId);
  const extender = dto.extenderId === null ? null : extenderlar.find((e) => deviceId(e) === dto.extenderId);
  if (!islemci || extender === undefined) return null;
  return {
    islemci,
    units: dto.units,
    extender,
    extenderUnits: dto.extenderUnits,
    portsUsed: dto.portsUsed,
    pixelsUsed: dto.pixelsUsed,
    pixelsCapacity: dto.pixelsCapacity,
    utilizationPercent: dto.utilizationPercent,
  };
}

export function toJobAutoSummary(dto: JobProcessorDto, islemciler: IslemciRow[], extenderlar: ExtenderRow[]): JobAutoSummary {
  return {
    totalPixels: dto.totalPixels,
    processors: dto.processors.flatMap((p) => {
      const islemci = islemciler.find((i) => deviceId(i) === p.id);
      return islemci ? [{ islemci, count: p.count }] : [];
    }),
    extenders: dto.extenders.flatMap((e) => {
      const extender = extenderlar.find((x) => deviceId(x) === e.id);
      return extender ? [{ extender, count: e.count }] : [];
    }),
    totalProcessors: dto.totalProcessors,
    totalExtenders: dto.totalExtenders,
    infeasibleScreenCount: dto.infeasibleScreenCount,
  };
}

export const EMPTY_JOB_DEVICES: JobAutoSummary = {
  totalPixels: 0,
  processors: [],
  extenders: [],
  totalProcessors: 0,
  totalExtenders: 0,
  infeasibleScreenCount: 0,
};
