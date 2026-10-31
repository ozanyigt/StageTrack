using StageTrack.Led.Calculation;

namespace StageTrack.Led;

// ---------------------------------------------------------------- 3D stage

/// <summary>The 3D stage's values in metres; also the save request, which is always the whole set.</summary>
public sealed record LedStageSettingsDto(
    decimal StageWidthM,
    decimal StageDepthM,
    decimal StageHeightM,
    decimal FrontGapM,
    LedStageMount Mount,
    LedStageCarrier Carrier,
    decimal LegDepthM,
    decimal BottomM,
    bool GroundSupport,
    decimal GroundSupportHeightM,
    decimal TrussHeightM,
    decimal HangAllowanceM)
{
    public static LedStageSettingsDto From(LedStageValues v) => new(
        v.StageWidthM, v.StageDepthM, v.StageHeightM, v.FrontGapM, v.Mount, v.Carrier,
        v.LegDepthM, v.BottomM, v.GroundSupport, v.GroundSupportHeightM, v.TrussHeightM, v.HangAllowanceM);

    public LedStageValues ToValues() => new(
        StageWidthM, StageDepthM, StageHeightM, FrontGapM, Mount, Carrier,
        LegDepthM, BottomM, GroundSupport, GroundSupportHeightM, TrussHeightM, HangAllowanceM);
}

/// <summary>The firm location's stage and mounting values; the whole team sees and changes the same ones.</summary>
public interface ILedStageAppService
{
    Task<LedStageSettingsDto> GetAsync();

    Task<LedStageSettingsDto> SaveAsync(LedStageSettingsDto input);
}

// ---------------------------------------------------------------- Stock status

/// <summary>A corner column of a screen and the warehouse its panels come from.</summary>
public sealed record LedStockCornerRequest(int AfterColumn, Guid EquipmentId, Guid? StockLocationId);

/// <summary>A screen of the job: the panel, the warehouse it comes from, its size, cut-outs and corners.</summary>
public sealed record LedStockScreenRequest(
    string Id,
    Guid? EquipmentId,
    Guid? StockLocationId,
    int Columns,
    int Rows,
    IReadOnlyList<CutoutDto>? Cutouts = null,
    IReadOnlyList<LedStockCornerRequest>? Corners = null);

public sealed record LedStockStatusRequest(IReadOnlyList<LedStockScreenRequest> Screens);

/// <summary>
/// One stock line: a panel in a warehouse, what is owned there and how many of it the job's screens use
/// (cut-outs left out). A panel the job uses where nothing is owned shows a quantity of 0.
/// </summary>
public sealed record LedStockLineDto(
    Guid EquipmentId,
    string Code,
    string Name,
    decimal PitchMm,
    LedPanelGroup Group,
    LedPanelType PanelType,
    int WidthMm,
    int HeightMm,
    int Quantity,
    double PanelAreaM2,
    int Used);

/// <summary>
/// A warehouse with its panel lines. The first entry has a null id: quantity-tracked panels are counted for the
/// whole firm location, not per warehouse, so they are listed there.
/// </summary>
public sealed record LedStockLocationDto(Guid? Id, string Name, IReadOnlyList<LedStockLineDto> Lines);

public sealed record LedStockStatusResponse(IReadOnlyList<LedStockLocationDto> Locations);

/// <summary>What the firm owns per warehouse against what the job's screens need. Reads only.</summary>
public interface ILedStockStatusAppService
{
    Task<LedStockStatusResponse> GetAsync(LedStockStatusRequest request);
}
