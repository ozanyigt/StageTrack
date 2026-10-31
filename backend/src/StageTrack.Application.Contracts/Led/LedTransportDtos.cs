using StageTrack.Led.Transport;

namespace StageTrack.Led;

// ---------------------------------------------------------------- Vehicle types

/// <summary>A vehicle type of the firm: load space in mm, capacity in kg.</summary>
public sealed record TransportVehicleDto(Guid Id, string Name, int LengthMm, int WidthMm, int HeightMm, int CapacityKg);

/// <param name="Id">An existing type to update; null (or unknown) = a new one.</param>
public sealed record SaveTransportVehicleRequest(Guid? Id, string Name, int LengthMm, int WidthMm, int HeightMm, int CapacityKg);

/// <summary>
/// The firm's Lojistik settings: its vehicle types and the space left between the cases and to the vehicle walls
/// (<paramref name="GapMm"/>; 0 = none).
/// </summary>
public sealed record TransportSettingsDto(IReadOnlyList<TransportVehicleDto> Vehicles, int GapMm);

/// <summary>The whole list, in display order: types left out are deleted. <paramref name="GapMm"/> null = unchanged.</summary>
public sealed record SaveTransportVehiclesRequest(IReadOnlyList<SaveTransportVehicleRequest> Vehicles, int? GapMm = null);

// ---------------------------------------------------------------- Loading plan

/// <summary>One non-LED line of the job to load: an equipment model and how many (lines of the same model add up).</summary>
public sealed record TransportEquipmentRequest(Guid EquipmentId, int Count);

/// <summary>
/// The job's screens (as for the calculation), its non-LED lines (light, sound, truss, scaff) and the vehicle type to
/// use; null = automatic (fewest vehicles).
/// </summary>
public sealed record TransportPlanRequest(IReadOnlyList<EvaluateScreenRequest> Screens, Guid? VehicleId = null, IReadOnlyList<TransportEquipmentRequest>? Equipment = null);

/// <summary>
/// The automatic loading plan: the firm's vehicle types, the cases of every panel model in the job, the vehicles
/// with their stacks (positions in cm) and what fits no vehicle. Models without case data are listed in
/// <paramref name="Missing"/> and left out. <paramref name="GapMm"/> = the space left between the stacks and to the walls.
/// </summary>
public sealed record TransportPlanResponse(
    IReadOnlyList<TransportVehicleDto> VehicleTypes,
    int GapMm,
    IReadOnlyList<TransportGroupDto> Groups,
    IReadOnlyList<TransportMissingDto> Missing,
    IReadOnlyList<PlanVehicleDto> Vehicles,
    IReadOnlyList<PlanStackDto> Unplaced);

/// <summary>
/// One panel model's cases: ⌈panels ÷ per case⌉, every one a whole case (size and weight) even when the last is not full.
/// Case size in cm (height, width, depth); <paramref name="CaseWeightKg"/> null = not entered.
/// </summary>
public sealed record TransportGroupDto(
    Guid EquipmentId, string Code, string Name, TransportKind Kind, int Panels, int PanelsPerCase, int Cases,
    double HeightCm, double WidthCm, double DepthCm, double? CaseWeightKg, int MaxStack);

/// <summary>A model in the job that cannot be planned; <paramref name="Fields"/> = what is missing (casePanelCount / caseDimensionsCm).</summary>
public sealed record TransportMissingDto(Guid EquipmentId, string Code, string Name, int Panels, IReadOnlyList<string> Fields);

public sealed record PlanVehicleDto(Guid TypeId, IReadOnlyList<PlanStackDto> Stacks);

/// <summary>
/// A stack of one model's cases on the floor, in cm: X along the length from the front, Y across from the left; not
/// rotated = the case's depth along the length.
/// </summary>
public sealed record PlanStackDto(string Id, Guid EquipmentId, int Cases, int Panels, double X, double Y, bool Rotated);

/// <summary>The loading plan (Lojistik): the firm's vehicles, the gap around the cases, and a job's plan.</summary>
public interface ILedTransportAppService
{
    Task<TransportSettingsDto> GetVehiclesAsync();

    /// <summary>The whole list in display order; vehicles left out are deleted. GapMm null = unchanged.</summary>
    Task<TransportSettingsDto> SaveVehiclesAsync(SaveTransportVehiclesRequest request);

    Task<TransportPlanResponse> PlanAsync(TransportPlanRequest request);
}
