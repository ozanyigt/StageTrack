using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StageTrack.Permissions;
using StageTrack.Sites;

namespace StageTrack.Controllers;

/// <summary>
/// A job's room: its measurements, the clear height the rig has to pass under, and the venue's own drawing
/// laid on the floor to scale. One record per job, made the moment somebody enters a measurement.
/// </summary>
[ApiController]
[Route("api/site-plans")]
[Authorize(StageTrackPermissions.Projects.Default)]
public class SitePlanController(ISitePlanAppService appService) : ControllerBase
{
    [HttpGet("by-project/{projectId:guid}")]
    public Task<SitePlanDto?> FindByProjectAsync(Guid projectId) => appService.FindByProjectAsync(projectId);

    [HttpPost]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<SitePlanDto> CreateAsync(CreateSitePlanInput input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}/venue")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<SitePlanDto> SetVenueAsync(Guid id, SetSiteVenueInput input) => appService.SetVenueAsync(id, input);

    [HttpPut("{id:guid}/venue/plan")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<SitePlanDto> SetVenuePlanAsync(Guid id, SetSiteVenuePlanInput input) => appService.SetVenuePlanAsync(id, input);

    [HttpDelete("{id:guid}/venue")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<SitePlanDto> RemoveVenueAsync(Guid id) => appService.RemoveVenueAsync(id);
}
