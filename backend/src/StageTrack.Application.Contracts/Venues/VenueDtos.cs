using System.ComponentModel.DataAnnotations;

namespace StageTrack.Venues;

/// <summary>The room the job is built in, as the design screens need it.</summary>
public class VenueRoomDto
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

public class SetVenueRoomInput
{
    [Range(VenueConsts.MinRoomM, VenueConsts.MaxRoomM)]
    public double WidthM { get; set; }

    [Range(VenueConsts.MinRoomM, VenueConsts.MaxRoomM)]
    public double DepthM { get; set; }

    [Range(0, VenueConsts.MaxHeightM)]
    public double ClearHeightM { get; set; }

    [Range(-VenueConsts.MaxRoomM, VenueConsts.MaxRoomM)]
    public double StageOffsetXM { get; set; }

    [Range(0, VenueConsts.MaxRoomM)]
    public double BehindStageM { get; set; } = 2;

    [Range(0, 45)]
    public double RakeDeg { get; set; }
}

/// <summary>The drawing's place and scale; the image itself is an attachment of the job.</summary>
public class SetVenuePlanInput
{
    public Guid? PlanAttachmentId { get; set; }

    [Range(0.0001, 10)]
    public double? PlanMetresPerPixel { get; set; }

    [Range(-VenueConsts.MaxRoomM, VenueConsts.MaxRoomM)]
    public double PlanOriginXM { get; set; }

    [Range(-VenueConsts.MaxRoomM, VenueConsts.MaxRoomM)]
    public double PlanOriginZM { get; set; }

    [Range(-360, 360)]
    public double PlanRotationDeg { get; set; }
}

public class ProjectVenueDto
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public int ProjectNumber { get; set; }
    public string ProjectName { get; set; } = null!;

    /// <summary>The job's venue as text ("Ankara Congresium"); the room itself is <see cref="Room"/>.</summary>
    public string? VenueName { get; set; }

    public string Name { get; set; } = null!;

    /// <summary>The room, when the job is indoors; null on an open field.</summary>
    public VenueRoomDto? Room { get; set; }
}

/// <summary>
/// A job's venue: what the room measures, how much clear height it has, and the venue's own drawing laid on its
/// floor. There is at most one per job and it is addressed by the job, so no caller ever has to know its id;
/// the record comes into being the moment somebody enters a measurement.
/// </summary>
public interface IProjectVenueAppService
{
    /// <summary>The job's venue record, or null when it has none yet.</summary>
    Task<ProjectVenueDto?> FindByProjectAsync(Guid projectId);

    /// <summary>The room's measurements; the first call creates the record.</summary>
    Task<ProjectVenueDto> SetRoomAsync(Guid projectId, SetVenueRoomInput input);

    /// <summary>Where the venue's drawing lies and what it is worth; the room has to exist first.</summary>
    Task<ProjectVenueDto> SetPlanAsync(Guid projectId, SetVenuePlanInput input);

    Task<ProjectVenueDto> RemoveRoomAsync(Guid projectId);
}
