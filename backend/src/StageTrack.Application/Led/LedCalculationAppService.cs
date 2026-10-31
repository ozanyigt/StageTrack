using StageTrack.Inventory;
using StageTrack.Led.Calculation;

namespace StageTrack.Led;

/// <summary>
/// Runs a job's screen calculation on the firm's own LED inventory. Panelyze gated features behind its Demo/Pro/Team
/// plans; here the module and the user's permissions have already decided that, so what is left is sanity bounds —
/// a request asking for a million columns is a bug, not a business case.
/// </summary>
public class LedCalculationAppService(
    LedCatalogLoader catalog,
    IEquipmentRepository equipmentRepository,
    CalcSettings settings) : ILedCalculationAppService
{
    public CalcSettingsDto GetSettings() => CalcSettingsDto.From(settings);

    public async Task<EvaluateResponse> EvaluateAsync(EvaluateRequest request)
    {
        LedRequestGuard.Validate(request);
        return LedCalculationEvaluator.Evaluate(request, await catalog.LoadAsync(), settings);
    }

    /// <summary>
    /// The non-LED lines of the same job (fixtures, speakers, truss): weight, watt, current and circuits with the
    /// LED constants, so one job's power is added up the same way everywhere.
    /// </summary>
    public async Task<EquipmentPowerResponse> CalculateEquipmentPowerAsync(EquipmentPowerRequest request)
    {
        LedRequestGuard.Validate(request);

        var ids = request.Lines.Where(l => l.EquipmentId is not null).Select(l => l.EquipmentId!.Value).Distinct().ToList();
        // Equipment of another firm or location is simply "not found", never an error that reveals it exists.
        var byId = (await equipmentRepository.GetListByIdsAsync(ids)).ToDictionary(e => e.Id);

        var lines = request.Lines.Select(line =>
        {
            if (line.EquipmentId is not { } id || !byId.TryGetValue(id, out var equipment))
            {
                return new EquipmentLineDto(line.Id, false, line.Count, 0, 0, 0, 0, 0, 0);
            }

            var spec = new EquipmentPowerSpec((double)(equipment.WeightKg ?? 0), (double?)equipment.PowerW, (double?)equipment.PowerW);
            var result = EquipmentPowerCalculator.Line(spec, line.Count, request.Mode, request.Voltage, settings);
            return new EquipmentLineDto(line.Id, true, result.Count, result.WeightKg, result.Watt, result.UnitCurrentA,
                result.CurrentA, result.UnitsPerCircuit, result.Circuits);
        }).ToList();

        var found = lines.Where(l => l.Found).ToList();
        return new EquipmentPowerResponse(
            lines,
            new EquipmentTotalsDto(found.Sum(l => l.Count), found.Sum(l => l.WeightKg), found.Sum(l => l.Watt),
                found.Sum(l => l.CurrentA), found.Sum(l => l.Circuits)));
    }
}

/// <summary>
/// Bounds that keep a malformed request from turning into a huge allocation. Deliberately generous: these are
/// sanity limits, not rules anybody should ever meet.
/// </summary>
internal static class LedRequestGuard
{
    public const int MaxPanelsPerSide = 1000;
    public const int MaxScreens = 200;
    public const int MaxCutouts = 50;
    public const int MaxCorners = 20;
    public const int MaxEquipmentLines = 500;
    public const double MaxCurveRadiusM = 10_000;

    public static void Validate(EvaluateRequest request)
    {
        Require(request.Voltage is > 0 and <= 1000);
        Require(Enum.IsDefined(request.Mode));
        Require(request.Screens is not null);

        if (request.Screens.Count > MaxScreens)
        {
            throw new BusinessException(StageTrackErrorCodes.LedTooManyScreens).WithData("limit", MaxScreens);
        }

        Require(request.Screens.Select(s => s.Id).Distinct(StringComparer.Ordinal).Count() == request.Screens.Count);

        foreach (var screen in request.Screens)
        {
            Require(!string.IsNullOrWhiteSpace(screen.Id) && screen.Id.Length <= 100);
            Require(screen.Columns is >= 0 and <= MaxPanelsPerSide);
            Require(screen.Rows is >= 0 and <= MaxPanelsPerSide);
            Require(screen.SelectedOption >= 0);
            Require(screen.Cutouts is null || screen.Cutouts.Count <= MaxCutouts);
            Require(screen.Corners is null || screen.Corners.Count <= MaxCorners);
            Require(screen.Layout is null || (Enum.IsDefined(screen.Layout.Direction) && Enum.IsDefined(screen.Layout.Start)));
            Require(screen.SignalLayout is null || (Enum.IsDefined(screen.SignalLayout.Direction) && Enum.IsDefined(screen.SignalLayout.Start)));
            if (screen.Curve is { } curve)
            {
                Require(Enum.IsDefined(curve.Mode) && Enum.IsDefined(curve.Direction));
                Require(curve.Value > 0 && curve.Value <= (curve.Mode == CurveMode.Arc ? 360 : MaxCurveRadiusM));
            }
        }
    }

    public static void Validate(EquipmentPowerRequest request)
    {
        Require(request.Voltage is > 0 and <= 1000);
        Require(Enum.IsDefined(request.Mode));
        Require(request.Lines is { } lines && lines.Count <= MaxEquipmentLines);
        foreach (var line in request.Lines)
        {
            Require(!string.IsNullOrWhiteSpace(line.Id) && line.Id.Length <= 100);
            Require(line.Count is >= 0 and <= 100_000);
        }
    }

    private static void Require(bool condition)
    {
        if (!condition)
        {
            throw new BusinessException(StageTrackErrorCodes.LedInvalidRequest);
        }
    }
}
