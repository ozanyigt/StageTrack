using StageTrack.Led.Calculation;

namespace StageTrack.Led;

/// <summary>One non-LED line of the job: an equipment model (null = not picked yet) and how many.</summary>
public sealed record EquipmentLineRequest(string Id, Guid? EquipmentId, int Count);

/// <summary>The non-LED lines (fixture groups, speaker / amplifier groups, truss and scaff material) at a voltage and power mode.</summary>
public sealed record EquipmentPowerRequest(double Voltage, PowerMode Mode, IReadOnlyList<EquipmentLineRequest> Lines);

/// <summary>
/// One line's result. <paramref name="Found"/> false: no model picked, or not in the caller's inventory (zeros).
/// <paramref name="UnitsPerCircuit"/> 0 with circuits = a unit needs more than one circuit (or draws nothing).
/// </summary>
public sealed record EquipmentLineDto(string Id, bool Found, int Count, double WeightKg, double Watt, double UnitCurrentA, double CurrentA, int UnitsPerCircuit, int Circuits);

public sealed record EquipmentTotalsDto(int Count, double WeightKg, double Watt, double CurrentA, int Circuits);

public sealed record EquipmentPowerResponse(IReadOnlyList<EquipmentLineDto> Lines, EquipmentTotalsDto Total);

/// <summary>Screen calculation and the job's non-LED power, on the firm's own inventory.</summary>
public interface ILedCalculationAppService
{
    /// <summary>The fixed constants (power factor, fuse, socapex), so the screens can show them.</summary>
    CalcSettingsDto GetSettings();

    Task<EvaluateResponse> EvaluateAsync(EvaluateRequest request);

    Task<EquipmentPowerResponse> CalculateEquipmentPowerAsync(EquipmentPowerRequest request);
}
