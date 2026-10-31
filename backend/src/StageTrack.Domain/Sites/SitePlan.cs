using StageTrack.Entities;
using StageTrack.Inventory;

namespace StageTrack.Sites;

/// <summary>
/// Where a job's equipment will actually stand, on the real ground. One plan per job, like its quote: the views a
/// festival needs (setup, event day, emergency) are layers of the same plan rather than separate drawings, so the
/// equipment on them can never disagree.
///
/// What makes this more than a drawing: an item on the map is a real <see cref="Equipment"/> record, so the plan
/// can be planned onto the job, reserved, quoted and scanned out of the warehouse.
/// </summary>
public class SitePlan : CompanyAggregateRoot
{
    public Guid ProjectId { get; private set; }
    public string Name { get; private set; } = null!;

    /// <summary>Where the map opens; kept so everyone who opens the plan sees the same ground.</summary>
    public double CentreLat { get; private set; }

    public double CentreLng { get; private set; }
    public double Zoom { get; private set; } = 17;

    public SiteBaseLayer BaseLayer { get; private set; } = SiteBaseLayer.Satellite;

    /// <summary>The plan was last looked at after dark; stored so the night view opens as the user left it.</summary>
    public bool NightMode { get; private set; }

    public ICollection<SitePlanItem> Items { get; private set; } = new List<SitePlanItem>();
    public ICollection<SitePlanZone> Zones { get; private set; } = new List<SitePlanZone>();

    private SitePlan()
    {
    }

    public SitePlan(Guid id, Guid projectId, string name, double centreLat, double centreLng) : base(id)
    {
        ProjectId = projectId;
        Name = name.Trim();
        SetView(centreLat, centreLng, 17, SiteBaseLayer.Satellite, false);
    }

    public void Rename(string name) => Name = name.Trim();

    public void SetView(double centreLat, double centreLng, double zoom, SiteBaseLayer baseLayer, bool nightMode)
    {
        CentreLat = Math.Clamp(centreLat, -85, 85);
        CentreLng = Math.Clamp(centreLng, -180, 180);
        Zoom = Math.Clamp(zoom, 1, 22);
        BaseLayer = baseLayer;
        NightMode = nightMode;
    }

    public SitePlanItem AddItem(Guid? equipmentId, string? label, int quantity, double lat, double lng, string? layer)
    {
        if (Items.Count >= SiteConsts.MaxItemsPerPlan)
        {
            throw new BusinessException(StageTrackErrorCodes.SitePlanTooManyItems).WithData("limit", SiteConsts.MaxItemsPerPlan);
        }

        if (equipmentId is null && string.IsNullOrWhiteSpace(label))
        {
            throw new BusinessException(StageTrackErrorCodes.SiteItemNeedsEquipmentOrLabel);
        }

        var item = new SitePlanItem(Guid.CreateVersion7(), Id, equipmentId, label, quantity, lat, lng, layer);
        Items.Add(item);
        return item;
    }

    public SitePlanItem GetItem(Guid itemId) =>
        Items.FirstOrDefault(i => i.Id == itemId) ?? throw new EntityNotFoundException(typeof(SitePlanItem), itemId);

    public void RemoveItem(Guid itemId) => Items.Remove(GetItem(itemId));

    public SitePlanZone AddZone(string name, SiteZoneKind kind, IReadOnlyList<SitePoint> points, string color, string? layer)
    {
        var zone = new SitePlanZone(Guid.CreateVersion7(), Id, name, kind, points, color, layer);
        Zones.Add(zone);
        return zone;
    }

    public SitePlanZone GetZone(Guid zoneId) =>
        Zones.FirstOrDefault(z => z.Id == zoneId) ?? throw new EntityNotFoundException(typeof(SitePlanZone), zoneId);

    public void RemoveZone(Guid zoneId) => Zones.Remove(GetZone(zoneId));

    /// <summary>What the job takes from the plan: each equipment once, with everything standing on the map added up.</summary>
    public IReadOnlyDictionary<Guid, int> EquipmentTotals() =>
        Items.Where(i => i.EquipmentId.HasValue)
            .GroupBy(i => i.EquipmentId!.Value)
            .ToDictionary(g => g.Key, g => g.Sum(i => i.Quantity));
}

/// <summary>A point on the ground.</summary>
public readonly record struct SitePoint(double Lat, double Lng);

/// <summary>
/// One thing standing on the site. With an equipment it is inventory — it can be reserved, quoted and scanned;
/// without one it is a plain marker ("gate", "ambulance here") that costs nothing and plans nothing.
/// </summary>
public class SitePlanItem : Entity
{
    public Guid SitePlanId { get; private set; }

    /// <summary>The real equipment standing here; null for a plain marker.</summary>
    public Guid? EquipmentId { get; private set; }

    /// <summary>Shown instead of the equipment's name when set; the only text a plain marker has.</summary>
    public string? Label { get; private set; }

    /// <summary>How many of it stand at this spot (six barriers in one run, two towers side by side).</summary>
    public int Quantity { get; private set; } = 1;

    public double Lat { get; private set; }
    public double Lng { get; private set; }

    /// <summary>Which way it faces; a stage or a screen is not symmetrical.</summary>
    public double RotationDeg { get; private set; }

    public string? Layer { get; private set; }
    public string? Notes { get; private set; }

    /// <summary>
    /// Set when this item lights the site. Height drives how far the light reaches, intensity how bright it is
    /// after dark. Null means it lights nothing and the night view ignores it.
    /// </summary>
    public decimal? LightHeightM { get; private set; }

    public int? LightIntensity { get; private set; }

    /// <summary>Overrides the reach worked out from the height, for a fixture whose throw is known.</summary>
    public decimal? LightRadiusM { get; private set; }

    private SitePlanItem()
    {
    }

    internal SitePlanItem(Guid id, Guid sitePlanId, Guid? equipmentId, string? label, int quantity, double lat, double lng, string? layer)
        : base(id)
    {
        SitePlanId = sitePlanId;
        EquipmentId = equipmentId;
        Label = Clean(label);
        Quantity = Math.Clamp(quantity, 1, 100_000);
        Layer = Clean(layer);
        MoveTo(lat, lng, 0);
    }

    public void MoveTo(double lat, double lng, double rotationDeg)
    {
        Lat = Math.Clamp(lat, -85, 85);
        Lng = Math.Clamp(lng, -180, 180);
        RotationDeg = ((rotationDeg % 360) + 360) % 360;
    }

    public void Update(string? label, int quantity, string? layer, string? notes)
    {
        Label = Clean(label);
        Quantity = Math.Clamp(quantity, 1, 100_000);
        Layer = Clean(layer);
        Notes = Clean(notes);
    }

    /// <summary>Makes this item a light, or (all null) an ordinary one again.</summary>
    public void SetLight(decimal? heightM, int? intensity, decimal? radiusM)
    {
        LightHeightM = heightM is > 0 ? Math.Min(heightM.Value, 200) : null;
        LightIntensity = LightHeightM is null ? null : Math.Clamp(intensity ?? 70, 0, 100);
        LightRadiusM = LightHeightM is null ? null : radiusM is > 0 ? Math.Min(radiusM.Value, 1000) : null;
    }

    /// <summary>How far this light reaches: what was entered, or roughly three times its height.</summary>
    public decimal? EffectiveRadiusM =>
        LightHeightM is null ? null : LightRadiusM ?? LightHeightM.Value * SiteConsts.LightRadiusPerMetre;

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

/// <summary>An area, a route or a barrier drawn on the plan.</summary>
public class SitePlanZone : Entity
{
    public Guid SitePlanId { get; private set; }
    public string Name { get; private set; } = null!;
    public SiteZoneKind Kind { get; private set; }

    /// <summary>The corners, as "lat,lng" pairs separated by semicolons — a shape is read and written whole.</summary>
    public string Points { get; private set; } = string.Empty;

    public string Color { get; private set; } = "#1677ff";
    public string? Layer { get; private set; }

    private SitePlanZone()
    {
    }

    internal SitePlanZone(Guid id, Guid sitePlanId, string name, SiteZoneKind kind, IReadOnlyList<SitePoint> points, string color, string? layer)
        : base(id)
    {
        SitePlanId = sitePlanId;
        Kind = kind;
        Update(name, points, color, layer);
    }

    public void Update(string name, IReadOnlyList<SitePoint> points, string color, string? layer)
    {
        Name = name.Trim();
        SetPoints(points);
        Color = string.IsNullOrWhiteSpace(color) ? "#1677ff" : color.Trim();
        Layer = string.IsNullOrWhiteSpace(layer) ? null : layer.Trim();
    }

    public void SetPoints(IReadOnlyList<SitePoint> points)
    {
        var needed = Kind == SiteZoneKind.Area ? 3 : 2;
        if (points.Count < needed || points.Count > SiteConsts.MaxZonePoints)
        {
            throw new BusinessException(StageTrackErrorCodes.SiteZoneInvalidShape).WithData("needed", needed);
        }

        Points = string.Join(';', points.Select(p => $"{p.Lat.ToString(System.Globalization.CultureInfo.InvariantCulture)},{p.Lng.ToString(System.Globalization.CultureInfo.InvariantCulture)}"));
    }

    public IReadOnlyList<SitePoint> GetPoints() =>
        Points.Split(';', StringSplitOptions.RemoveEmptyEntries)
            .Select(pair => pair.Split(','))
            .Where(parts => parts.Length == 2)
            .Select(parts => new SitePoint(
                double.Parse(parts[0], System.Globalization.CultureInfo.InvariantCulture),
                double.Parse(parts[1], System.Globalization.CultureInfo.InvariantCulture)))
            .ToList();
}
