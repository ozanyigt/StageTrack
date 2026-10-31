using Microsoft.Extensions.Localization;
using StageTrack.Inventory;
using StageTrack.Localization;
using StageTrack.Led.Calculation;
using StageTrack.Repositories;

namespace StageTrack.Led;

public class LedStageAppService(ILedStageSettingsRepository repository, IUnitOfWork unitOfWork) : ILedStageAppService
{
    public async Task<LedStageSettingsDto> GetAsync() =>
        LedStageSettingsDto.From((await repository.FindForCompanyAsync())?.Values ?? LedStageSettings.Defaults);

    public async Task<LedStageSettingsDto> SaveAsync(LedStageSettingsDto input)
    {
        var settings = await repository.FindForCompanyAsync();
        if (settings is null)
        {
            settings = new LedStageSettings(Guid.CreateVersion7());
            await repository.InsertAsync(settings);
        }

        settings.Apply(input.ToValues());
        await unitOfWork.SaveChangesAsync();
        return LedStageSettingsDto.From(settings.Values);
    }
}

/// <summary>
/// What the firm owns against what the job needs, warehouse by warehouse. Quantity-tracked panels are not kept per
/// warehouse in StageTrack, so they are listed once under the firm location itself.
/// </summary>
public class LedStockStatusAppService(
    IEquipmentLedSpecRepository specRepository,
    IStockLocationRepository locationRepository,
    IStringLocalizer<StageTrackResource> localizer) : ILedStockStatusAppService
{
    public async Task<LedStockStatusResponse> GetAsync(LedStockStatusRequest request)
    {
        Validate(request);

        var used = StockUsage.Count(request.Screens
            .Where(s => s.EquipmentId is not null)
            .Select(s => new StockScreenUse(
                Key(s.EquipmentId!.Value, s.StockLocationId),
                s.Columns,
                s.Rows,
                (s.Cutouts ?? []).Select(c => new Cutout(c.Width, c.Height, c.Left, c.Bottom)).ToList(),
                (s.Corners ?? []).Select(c => new StockCornerUse(c.AfterColumn, Key(c.EquipmentId, c.StockLocationId))).ToList())));

        var panels = await specRepository.GetPanelsAsync(new LedCatalogFilter());
        var stock = await specRepository.GetStockByLocationAsync(panels.Select(p => p.Equipment.Id).ToList());
        var warehouses = (await locationRepository.GetListAsync()).OrderBy(l => l.Name).ToList();

        // The "no warehouse" bucket first: quantity-tracked panels and devices nobody filed into a warehouse.
        var places = new List<(Guid? Id, string Name)> { (null, localizer["Led.NoWarehouse"].Value) };
        places.AddRange(warehouses.Select(w => ((Guid?)w.Id, w.Name)));

        return new LedStockStatusResponse(places.Select(place => new LedStockLocationDto(
            place.Id,
            place.Name,
            panels
                .Where(p => stock.ContainsKey((p.Equipment.Id, place.Id)) || used.ContainsKey(Key(p.Equipment.Id, place.Id)))
                .OrderBy(p => p.Spec.Group).ThenBy(p => p.Spec.PitchMm).ThenBy(p => p.Equipment.Code)
                .Select(p => new LedStockLineDto(
                    p.Equipment.Id,
                    p.Equipment.Code,
                    p.Equipment.Name,
                    p.Spec.PitchMm,
                    p.Spec.Group,
                    p.Spec.PanelType,
                    p.Spec.WidthMm,
                    p.Spec.HeightMm,
                    stock.GetValueOrDefault((p.Equipment.Id, place.Id)),
                    p.Spec.WidthMm * p.Spec.HeightMm / 1_000_000.0,
                    used.GetValueOrDefault(Key(p.Equipment.Id, place.Id))))
                .ToList()))
            .Where(l => l.Lines.Count > 0)
            .ToList());
    }

    /// <summary>StockUsage keys on two Guids; "no warehouse" is Guid.Empty there and null everywhere else.</summary>
    private static StockKey Key(Guid equipmentId, Guid? stockLocationId) => new(equipmentId, stockLocationId ?? Guid.Empty);

    private static void Validate(LedStockStatusRequest request)
    {
        var ok = request.Screens is { } screens
                 && screens.Count <= LedRequestGuard.MaxScreens
                 && screens.All(s => !string.IsNullOrWhiteSpace(s.Id) && s.Id.Length <= 100
                                     && s.Columns is >= 0 and <= LedRequestGuard.MaxPanelsPerSide
                                     && s.Rows is >= 0 and <= LedRequestGuard.MaxPanelsPerSide
                                     && (s.Cutouts is null || s.Cutouts.Count <= LedRequestGuard.MaxCutouts)
                                     && (s.Corners is null || s.Corners.Count <= LedRequestGuard.MaxCorners));
        if (!ok)
        {
            throw new BusinessException(StageTrackErrorCodes.LedInvalidRequest);
        }
    }
}
