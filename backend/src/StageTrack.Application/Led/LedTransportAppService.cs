using StageTrack.Inventory;
using StageTrack.Led.Calculation;
using StageTrack.Led.Transport;
using StageTrack.Repositories;

namespace StageTrack.Led;

/// <summary>
/// The loading plan: the firm's vehicles, the gap left around the cases, and where the job's cases go.
/// Panelyze had to plan LED panels and other equipment separately because they were different records; here they
/// are all <see cref="Equipment"/>, so one pass covers a screen's panels and the truss that travels with it.
/// </summary>
public class LedTransportAppService(
    ILedTransportVehicleRepository vehicleRepository,
    ILedTransportSettingsRepository settingsRepository,
    IEquipmentLedSpecRepository specRepository,
    IEquipmentRepository equipmentRepository,
    IUnitOfWork unitOfWork) : ILedTransportAppService
{
    public const int MaxVehicles = 20;
    private const int MaxLengthMm = 30_000;
    private const int MaxSideMm = 5_000;
    private const int MaxCapacityKg = 100_000;

    public async Task<TransportSettingsDto> GetVehiclesAsync() =>
        new((await LoadVehiclesAsync()).Select(ToDto).ToList(), await GetGapAsync());

    public async Task<TransportSettingsDto> SaveVehiclesAsync(SaveTransportVehiclesRequest request)
    {
        Validate(request);
        var existing = await LoadVehiclesAsync();
        var kept = new HashSet<Guid>();
        var result = new List<LedTransportVehicle>();

        for (var i = 0; i < request.Vehicles.Count; i++)
        {
            var wanted = request.Vehicles[i];
            var vehicle = existing.FirstOrDefault(v => v.Id == wanted.Id && !kept.Contains(v.Id));
            if (vehicle is null)
            {
                vehicle = new LedTransportVehicle(Guid.CreateVersion7(), wanted.Name, wanted.LengthMm, wanted.WidthMm, wanted.HeightMm, wanted.CapacityKg, i);
                await vehicleRepository.InsertAsync(vehicle);
            }
            else
            {
                vehicle.Update(wanted.Name, wanted.LengthMm, wanted.WidthMm, wanted.HeightMm, wanted.CapacityKg);
                vehicle.SetSortOrder(i);
            }

            kept.Add(vehicle.Id);
            result.Add(vehicle);
        }

        foreach (var gone in existing.Where(v => !kept.Contains(v.Id)))
        {
            await vehicleRepository.DeleteAsync(gone);
        }

        var gap = await GetGapAsync();
        if (request.GapMm is { } gapMm)
        {
            var settings = await settingsRepository.FindForCompanyAsync();
            if (settings is null)
            {
                settings = new LedTransportSettings(Guid.CreateVersion7());
                await settingsRepository.InsertAsync(settings);
            }

            settings.SetGap(gapMm);
            gap = settings.GapMm;
        }

        await unitOfWork.SaveChangesAsync();
        return new TransportSettingsDto(result.Select(ToDto).ToList(), gap);
    }

    public async Task<TransportPlanResponse> PlanAsync(TransportPlanRequest request)
    {
        Validate(request);
        var vehicles = await LoadVehiclesAsync();
        if (request.VehicleId is { } chosen && vehicles.All(v => v.Id != chosen))
        {
            throw new EntityNotFoundException(typeof(LedTransportVehicle), chosen);
        }

        // What the job carries: the screens' panels, plus whatever else was put on the line list.
        var pieces = PanelsByEquipment(request.Screens);
        foreach (var line in request.Equipment ?? [])
        {
            if (line.Count > 0)
            {
                pieces[line.EquipmentId] = pieces.GetValueOrDefault(line.EquipmentId) + line.Count;
            }
        }

        var ids = pieces.Keys.ToList();
        var equipment = (await equipmentRepository.GetListByIdsAsync(ids)).ToDictionary(e => e.Id);
        var specs = (await specRepository.GetListByEquipmentAsync(ids)).OfType<LedPanelSpec>().ToDictionary(s => s.EquipmentId);

        var groups = new List<TransportGroupDto>();
        var missing = new List<TransportMissingDto>();
        var caseGroups = new List<CaseGroup>();

        foreach (var (equipmentId, count) in pieces.OrderBy(p => equipment.GetValueOrDefault(p.Key)?.Code))
        {
            if (!equipment.TryGetValue(equipmentId, out var item))
            {
                continue;
            }

            // Only LED panels carry case data; anything else in the job is reported as missing rather than guessed at.
            var spec = specs.GetValueOrDefault(equipmentId);
            var size = spec is null ? null : CaseSize.Parse(spec.CaseDimensionsCm);
            if (spec is null || spec.CasePanelCount is not { } perCase || size is null)
            {
                var fields = new List<string>();
                if (spec?.CasePanelCount is null)
                {
                    fields.Add("casePanelCount");
                }

                if (size is null)
                {
                    fields.Add("caseDimensionsCm");
                }

                missing.Add(new TransportMissingDto(equipmentId, item.Code, item.Name, count, fields));
                continue;
            }

            var group = CaseGroup.For(equipmentId, spec.TransportKind, size, (double?)spec.CaseWeightKg, spec.MaxStack, count, perCase);
            caseGroups.Add(group);
            groups.Add(new TransportGroupDto(
                equipmentId, item.Code, item.Name, group.Kind, count, perCase, group.Cases,
                group.Size.HeightCm, group.Size.WidthCm, group.Size.DepthCm, group.CaseWeightKg, group.MaxStack));
        }

        var gapMm = await GetGapAsync();
        var plan = LoadPlanner.Plan(caseGroups, vehicles.Select(LedSpecMapper.ToVehicleSpec).ToList(), request.VehicleId, gapMm / 10.0);

        return new TransportPlanResponse(
            vehicles.Select(ToDto).ToList(),
            gapMm,
            groups,
            missing,
            plan.Vehicles.Select(v => new PlanVehicleDto(v.Vehicle.Id, v.Stacks.Select(ToDto).ToList())).ToList(),
            plan.Unplaced.Select(ToDto).ToList());
    }

    /// <summary>
    /// Panels of every model in the job: the used cells of each column (cut-outs left out), a corner column counting
    /// towards its own corner model. Screens without a panel count nothing.
    /// </summary>
    public static Dictionary<Guid, int> PanelsByEquipment(IEnumerable<EvaluateScreenRequest> screens)
    {
        var panels = new Dictionary<Guid, int>();
        foreach (var screen in screens)
        {
            if (screen.PanelModelId is not { } main || screen.Columns <= 0 || screen.Rows <= 0)
            {
                continue;
            }

            var cutouts = (screen.Cutouts ?? []).Select(c => new Cutout(c.Width, c.Height, c.Left, c.Bottom)).ToList();
            var used = ScreenGeometry.UsedCells(screen.Columns, screen.Rows, cutouts);
            var corners = (screen.Corners ?? []).GroupBy(c => c.AfterColumn).ToDictionary(g => g.Key, g => g.First().PanelModelId);

            for (var column = 0; column < screen.Columns; column++)
            {
                var model = corners.TryGetValue(column, out var corner) ? corner : main;
                var count = 0;
                for (var row = 0; row < screen.Rows; row++)
                {
                    if (used[column, row])
                    {
                        count++;
                    }
                }

                if (count > 0)
                {
                    panels[model] = panels.GetValueOrDefault(model) + count;
                }
            }
        }

        return panels;
    }

    /// <summary>The firm's vehicles; a firm that has none gets the defaults, saved so they keep their ids.</summary>
    private async Task<List<LedTransportVehicle>> LoadVehiclesAsync()
    {
        var list = await vehicleRepository.GetListOrderedAsync();
        if (list.Count > 0)
        {
            return list;
        }

        var defaults = LedTransportVehicle.Defaults
            .Select((d, i) => new LedTransportVehicle(Guid.CreateVersion7(), d.Name, d.LengthMm, d.WidthMm, d.HeightMm, d.CapacityKg, i))
            .ToList();
        foreach (var vehicle in defaults)
        {
            await vehicleRepository.InsertAsync(vehicle);
        }

        await unitOfWork.SaveChangesAsync();
        return defaults;
    }

    private async Task<int> GetGapAsync() => (await settingsRepository.FindForCompanyAsync())?.GapMm ?? LedConsts.DefaultTransportGapMm;

    private static TransportVehicleDto ToDto(LedTransportVehicle v) => new(v.Id, v.Name, v.LengthMm, v.WidthMm, v.HeightMm, v.CapacityKg);

    private static PlanStackDto ToDto(PlacedStack s) => new(s.Id, s.ModelId, s.Cases, s.Panels, s.X, s.Y, s.Rotated);

    private static void Validate(SaveTransportVehiclesRequest request)
    {
        var vehicles = request.Vehicles ?? [];
        var names = vehicles.Select(v => v.Name?.Trim().ToLowerInvariant()).ToList();
        var ok = vehicles.Count is >= 1 and <= MaxVehicles
                 && names.Distinct().Count() == vehicles.Count
                 && request.GapMm is null or (>= 0 and <= 1000)
                 && vehicles.All(v => !string.IsNullOrWhiteSpace(v.Name) && v.Name.Length <= LedConsts.MaxVehicleNameLength
                                      && v.LengthMm is >= 100 and <= MaxLengthMm
                                      && v.WidthMm is >= 100 and <= MaxSideMm
                                      && v.HeightMm is >= 100 and <= MaxSideMm
                                      && v.CapacityKg is >= 1 and <= MaxCapacityKg);
        if (!ok)
        {
            throw new BusinessException(StageTrackErrorCodes.LedInvalidRequest);
        }
    }

    private static void Validate(TransportPlanRequest request)
    {
        var ok = request.Screens is { } screens
                 && screens.Count <= LedRequestGuard.MaxScreens
                 && screens.All(s => !string.IsNullOrWhiteSpace(s.Id) && s.Id.Length <= 100
                                     && s.Columns is >= 0 and <= LedRequestGuard.MaxPanelsPerSide
                                     && s.Rows is >= 0 and <= LedRequestGuard.MaxPanelsPerSide
                                     && (s.Cutouts is null || s.Cutouts.Count <= LedRequestGuard.MaxCutouts)
                                     && (s.Corners is null || s.Corners.Count <= LedRequestGuard.MaxCorners))
                 && (request.Equipment is null || (request.Equipment.Count <= 500 && request.Equipment.All(e => e.Count is >= 0 and <= 100_000)));
        if (!ok)
        {
            throw new BusinessException(StageTrackErrorCodes.LedInvalidRequest);
        }
    }
}
