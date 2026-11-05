using System.ComponentModel.DataAnnotations;

namespace StageTrack.Sites;

/// <summary>The room the job is built in, as the design screens need it.</summary>
public class SiteVenueDto
{
    public double WidthM { get; set; }
    public double DepthM { get; set; }

    /// <summary>What the rig has to clear; 0 = nobody entered one.</summary>
    public double ClearHeightM { get; set; }

    public double StageOffsetXM { get; set; }
    public double BehindStageM { get; set; }
    public double RakeDeg { get; set; }

    /// <summary>The venue's own layout drawing, and what one of its pixels is worth on the ground.</summary>
    public Guid? PlanAttachmentId { get; set; }

    public double? PlanMetresPerPixel { get; set; }
    public double PlanOriginXM { get; set; }
    public double PlanOriginZM { get; set; }
    public double PlanRotationDeg { get; set; }
}

public class SetSiteVenueInput
{
    [Range(SiteConsts.MinVenueM, SiteConsts.MaxVenueM)]
    public double WidthM { get; set; }

    [Range(SiteConsts.MinVenueM, SiteConsts.MaxVenueM)]
    public double DepthM { get; set; }

    [Range(0, SiteConsts.MaxVenueHeightM)]
    public double ClearHeightM { get; set; }

    [Range(-SiteConsts.MaxVenueM, SiteConsts.MaxVenueM)]
    public double StageOffsetXM { get; set; }

    [Range(0, SiteConsts.MaxVenueM)]
    public double BehindStageM { get; set; } = 2;

    [Range(0, 45)]
    public double RakeDeg { get; set; }
}

/// <summary>The drawing's place and scale; the image itself is an attachment of the job.</summary>
public class SetSiteVenuePlanInput
{
    public Guid? PlanAttachmentId { get; set; }

    [Range(0.0001, 10)]
    public double? PlanMetresPerPixel { get; set; }

    [Range(-SiteConsts.MaxVenueM, SiteConsts.MaxVenueM)]
    public double PlanOriginXM { get; set; }

    [Range(-SiteConsts.MaxVenueM, SiteConsts.MaxVenueM)]
    public double PlanOriginZM { get; set; }

    [Range(-360, 360)]
    public double PlanRotationDeg { get; set; }
}

public class SitePlanDto
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public int ProjectNumber { get; set; }
    public string ProjectName { get; set; } = null!;

    /// <summary>The job's venue as text ("Ankara Congresium"); the room itself is <see cref="Venue"/>.</summary>
    public string? VenueName { get; set; }

    public string Name { get; set; } = null!;

    /// <summary>The room, when the job is indoors; null on an open field.</summary>
    public SiteVenueDto? Venue { get; set; }
}

public class CreateSitePlanInput
{
    [Required]
    public Guid ProjectId { get; set; }

    [StringLength(SiteConsts.MaxNameLength)]
    public string? Name { get; set; }
}

/// <summary>
/// A job's room: what it measures, how much clear height it has, and the venue's own drawing laid on its floor.
/// </summary>
public interface ISitePlanAppService
{
    /// <summary>The job's room record, or null when it has none yet.</summary>
    Task<SitePlanDto?> FindByProjectAsync(Guid projectId);

    Task<SitePlanDto> CreateAsync(CreateSitePlanInput input);

    /// <summary>The room's measurements; the first call creates it.</summary>
    Task<SitePlanDto> SetVenueAsync(Guid id, SetSiteVenueInput input);

    Task<SitePlanDto> SetVenuePlanAsync(Guid id, SetSiteVenuePlanInput input);

    Task<SitePlanDto> RemoveVenueAsync(Guid id);
}
