using StageTrack.Entities;

namespace StageTrack.Led;

/// <summary>
/// The 3D stage values of one firm location, in metres. One row per company, written on the first save;
/// until then <see cref="Defaults"/> applies.
/// </summary>
public class LedStageSettings : CompanyAggregateRoot
{
    public decimal StageWidthM { get; private set; }
    public decimal StageDepthM { get; private set; }
    public decimal StageHeightM { get; private set; }
    public decimal FrontGapM { get; private set; }
    public LedStageMount Mount { get; private set; }
    public LedStageCarrier Carrier { get; private set; }
    public decimal LegDepthM { get; private set; }
    public decimal BottomM { get; private set; }
    public bool GroundSupport { get; private set; }
    public decimal GroundSupportHeightM { get; private set; }
    public decimal TrussHeightM { get; private set; }
    public decimal HangAllowanceM { get; private set; }

    private LedStageSettings()
    {
    }

    public LedStageSettings(Guid id) : base(id) => Apply(Defaults);

    /// <summary>What a firm sees before it saves its own values.</summary>
    public static LedStageValues Defaults { get; } = new(
        StageWidthM: 12, StageDepthM: 8, StageHeightM: 1.2m, FrontGapM: 0.5m,
        Mount: LedStageMount.Ground, Carrier: LedStageCarrier.Scaff,
        LegDepthM: 1, BottomM: 0, GroundSupport: false, GroundSupportHeightM: 1,
        TrussHeightM: 8, HangAllowanceM: 0.5m);

    public LedStageValues Values => new(
        StageWidthM, StageDepthM, StageHeightM, FrontGapM, Mount, Carrier,
        LegDepthM, BottomM, GroundSupport, GroundSupportHeightM, TrussHeightM, HangAllowanceM);

    /// <summary>Negative metres make no sense anywhere here, so values are clamped rather than refused.</summary>
    public void Apply(LedStageValues v)
    {
        StageWidthM = NotNegative(v.StageWidthM);
        StageDepthM = NotNegative(v.StageDepthM);
        StageHeightM = NotNegative(v.StageHeightM);
        FrontGapM = NotNegative(v.FrontGapM);
        Mount = v.Mount;
        Carrier = v.Carrier;
        LegDepthM = NotNegative(v.LegDepthM);
        BottomM = NotNegative(v.BottomM);
        GroundSupport = v.GroundSupport;
        GroundSupportHeightM = NotNegative(v.GroundSupportHeightM);
        TrussHeightM = NotNegative(v.TrussHeightM);
        HangAllowanceM = NotNegative(v.HangAllowanceM);
    }

    private static decimal NotNegative(decimal value) => Math.Max(0, value);
}

/// <summary>The 3D stage values as one value, so defaults and a save can be handled alike.</summary>
public record LedStageValues(
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
    decimal HangAllowanceM);

/// <summary>The loading plan's settings of one firm location: the space left between cases and to the walls.</summary>
public class LedTransportSettings : CompanyAggregateRoot
{
    public int GapMm { get; private set; } = LedConsts.DefaultTransportGapMm;

    private LedTransportSettings()
    {
    }

    public LedTransportSettings(Guid id) : base(id)
    {
    }

    public void SetGap(int gapMm) => GapMm = Math.Clamp(gapMm, 0, 1000);
}

/// <summary>A vehicle of the loading plan: its load space in millimetres and how much it may carry.</summary>
public class LedTransportVehicle : CompanyAggregateRoot
{
    public string Name { get; private set; } = null!;
    public int LengthMm { get; private set; }
    public int WidthMm { get; private set; }
    public int HeightMm { get; private set; }
    public int CapacityKg { get; private set; }
    public int SortOrder { get; private set; }

    private LedTransportVehicle()
    {
    }

    public LedTransportVehicle(Guid id, string name, int lengthMm, int widthMm, int heightMm, int capacityKg, int sortOrder) : base(id)
    {
        Update(name, lengthMm, widthMm, heightMm, capacityKg);
        SortOrder = sortOrder;
    }

    public void Update(string name, int lengthMm, int widthMm, int heightMm, int capacityKg)
    {
        Name = name.Trim();
        LengthMm = Math.Max(1, lengthMm);
        WidthMm = Math.Max(1, widthMm);
        HeightMm = Math.Max(1, heightMm);
        CapacityKg = Math.Max(1, capacityKg);
    }

    public void SetSortOrder(int sortOrder) => SortOrder = sortOrder;
}

/// <summary>
/// A panel starred in the picker. Kept per user so one person's shortcuts are not forced on the rest of the firm.
/// </summary>
public class LedPanelFavorite : CompanyAggregateRoot
{
    public Guid UserId { get; private set; }
    public Guid EquipmentId { get; private set; }

    private LedPanelFavorite()
    {
    }

    public LedPanelFavorite(Guid id, Guid userId, Guid equipmentId) : base(id)
    {
        UserId = userId;
        EquipmentId = equipmentId;
    }
}
