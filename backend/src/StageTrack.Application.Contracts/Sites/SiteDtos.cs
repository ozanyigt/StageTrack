using System.ComponentModel.DataAnnotations;

namespace StageTrack.Sites;

public class SitePlanItemDto
{
    public Guid Id { get; set; }
    public Guid? EquipmentId { get; set; }

    /// <summary>The equipment's code and name, so the map can label an item without a second request.</summary>
    public string? EquipmentCode { get; set; }

    public string? EquipmentName { get; set; }

    /// <summary>Owned pieces of that equipment, against what the plan puts on the ground.</summary>
    public int EquipmentStock { get; set; }

    public string? Label { get; set; }
    public int Quantity { get; set; }
    public double Lat { get; set; }
    public double Lng { get; set; }
    public double RotationDeg { get; set; }
    public string? Layer { get; set; }
    public string? Notes { get; set; }
    public decimal? LightHeightM { get; set; }
    public int? LightIntensity { get; set; }

    /// <summary>What the night view uses: the entered reach, or the one worked out from the height.</summary>
    public decimal? LightRadiusM { get; set; }

    /// <summary>The item carries light data; the night view draws it.</summary>
    public bool IsLight { get; set; }
}

public class SitePlanZoneDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public SiteZoneKind Kind { get; set; }
    public List<double[]> Points { get; set; } = [];
    public string Color { get; set; } = null!;
    public string? Layer { get; set; }

    /// <summary>Ground covered, m² — areas only; a route or a barrier reports its length instead.</summary>
    public double? AreaM2 { get; set; }

    public double? LengthM { get; set; }
}

public class SitePlanDto
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public int ProjectNumber { get; set; }
    public string ProjectName { get; set; } = null!;
    public string? Venue { get; set; }
    public string Name { get; set; } = null!;
    public double CentreLat { get; set; }
    public double CentreLng { get; set; }
    public double Zoom { get; set; }
    public SiteBaseLayer BaseLayer { get; set; }
    public bool NightMode { get; set; }
    public List<SitePlanItemDto> Items { get; set; } = [];
    public List<SitePlanZoneDto> Zones { get; set; } = [];

    /// <summary>Every layer in use, plus the ones a new plan starts with, so the picker is never empty.</summary>
    public List<string> Layers { get; set; } = [];
}

public class CreateSitePlanInput
{
    [Required]
    public Guid ProjectId { get; set; }

    [StringLength(SiteConsts.MaxNameLength)]
    public string? Name { get; set; }

    [Range(-85, 85)]
    public double CentreLat { get; set; }

    [Range(-180, 180)]
    public double CentreLng { get; set; }
}

public class UpdateSitePlanViewInput
{
    [Range(-85, 85)]
    public double CentreLat { get; set; }

    [Range(-180, 180)]
    public double CentreLng { get; set; }

    [Range(1, 22)]
    public double Zoom { get; set; }

    public SiteBaseLayer BaseLayer { get; set; }
    public bool NightMode { get; set; }
}

public class AddSitePlanItemInput
{
    /// <summary>The equipment standing here; null only for a plain marker, which then needs a label.</summary>
    public Guid? EquipmentId { get; set; }

    [StringLength(SiteConsts.MaxLabelLength)]
    public string? Label { get; set; }

    [Range(1, 100_000)]
    public int Quantity { get; set; } = 1;

    [Range(-85, 85)]
    public double Lat { get; set; }

    [Range(-180, 180)]
    public double Lng { get; set; }

    [StringLength(SiteConsts.MaxLayerLength)]
    public string? Layer { get; set; }
}

public class MoveSitePlanItemInput
{
    [Range(-85, 85)]
    public double Lat { get; set; }

    [Range(-180, 180)]
    public double Lng { get; set; }

    [Range(0, 360)]
    public double RotationDeg { get; set; }
}

public class UpdateSitePlanItemInput
{
    [StringLength(SiteConsts.MaxLabelLength)]
    public string? Label { get; set; }

    [Range(1, 100_000)]
    public int Quantity { get; set; } = 1;

    [StringLength(SiteConsts.MaxLayerLength)]
    public string? Layer { get; set; }

    [StringLength(SiteConsts.MaxNotesLength)]
    public string? Notes { get; set; }

    /// <summary>Set to make the item a light; all null turns it back into an ordinary one.</summary>
    [Range(0.1, 200)]
    public decimal? LightHeightM { get; set; }

    [Range(0, 100)]
    public int? LightIntensity { get; set; }

    [Range(0.1, 1000)]
    public decimal? LightRadiusM { get; set; }
}

public class SaveSitePlanZoneInput
{
    [Required, StringLength(SiteConsts.MaxNameLength)]
    public string Name { get; set; } = null!;

    public SiteZoneKind Kind { get; set; } = SiteZoneKind.Area;

    /// <summary>The corners as [lat, lng] pairs; an area needs three, a route or barrier two.</summary>
    [Required]
    public List<double[]> Points { get; set; } = [];

    [StringLength(SiteConsts.MaxColorLength)]
    public string Color { get; set; } = "#1677ff";

    [StringLength(SiteConsts.MaxLayerLength)]
    public string? Layer { get; set; }
}

/// <summary>
/// A job's site plan: what stands where on the real ground. Every item that carries an equipment is inventory,
/// so the plan can be turned into planned equipment on the job.
/// </summary>
public interface ISitePlanAppService
{
    /// <summary>The job's plan, or null when it has none yet.</summary>
    Task<SitePlanDto?> FindByProjectAsync(Guid projectId);

    Task<SitePlanDto> CreateAsync(CreateSitePlanInput input);

    Task<SitePlanDto> UpdateViewAsync(Guid id, UpdateSitePlanViewInput input);

    Task<SitePlanDto> RenameAsync(Guid id, string name);

    Task DeleteAsync(Guid id);

    Task<SitePlanDto> AddItemAsync(Guid id, AddSitePlanItemInput input);

    Task<SitePlanDto> MoveItemAsync(Guid id, Guid itemId, MoveSitePlanItemInput input);

    Task<SitePlanDto> UpdateItemAsync(Guid id, Guid itemId, UpdateSitePlanItemInput input);

    Task<SitePlanDto> RemoveItemAsync(Guid id, Guid itemId);

    Task<SitePlanDto> SaveZoneAsync(Guid id, Guid? zoneId, SaveSitePlanZoneInput input);

    Task<SitePlanDto> RemoveZoneAsync(Guid id, Guid zoneId);
}
