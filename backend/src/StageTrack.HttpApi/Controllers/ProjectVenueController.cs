using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StageTrack.Permissions;
using StageTrack.Venues;

namespace StageTrack.Controllers;

/// <summary>
/// A job's venue: its measurements, the clear height the rig has to pass under, and the venue's own drawing
/// laid on the floor to scale. One per job, addressed through the job, made the moment somebody enters a
/// measurement.
/// </summary>
[ApiController]
[Route("api/projects/{projectId:guid}/venue")]
[Authorize(StageTrackPermissions.Projects.Default)]
public class ProjectVenueController(IProjectVenueAppService appService) : ControllerBase
{
    [HttpGet]
    public Task<ProjectVenueDto?> FindAsync(Guid projectId) => appService.FindByProjectAsync(projectId);

    [HttpPut("room")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<ProjectVenueDto> SetRoomAsync(Guid projectId, SetVenueRoomInput input) => appService.SetRoomAsync(projectId, input);

    [HttpPut("plan")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<ProjectVenueDto> SetPlanAsync(Guid projectId, SetVenuePlanInput input) => appService.SetPlanAsync(projectId, input);

    [HttpDelete("room")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<ProjectVenueDto> RemoveRoomAsync(Guid projectId) => appService.RemoveRoomAsync(projectId);
}
