using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StageTrack.Permissions;
using StageTrack.Sites;

namespace StageTrack.Controllers;

/// <summary>
/// A job's site plan. Reading it needs the same permission as seeing the job; changing it needs the one that
/// changes the job's equipment, because that is what the plan becomes.
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

    [HttpPut("{id:guid}/view")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<SitePlanDto> UpdateViewAsync(Guid id, UpdateSitePlanViewInput input) => appService.UpdateViewAsync(id, input);

    [HttpPut("{id:guid}/name")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<SitePlanDto> RenameAsync(Guid id, RenameSitePlanInput input) => appService.RenameAsync(id, input.Name);

    [HttpDelete("{id:guid}")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task DeleteAsync(Guid id) => appService.DeleteAsync(id);

    [HttpPost("{id:guid}/items")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<SitePlanDto> AddItemAsync(Guid id, AddSitePlanItemInput input) => appService.AddItemAsync(id, input);

    [HttpPut("{id:guid}/items/{itemId:guid}/position")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<SitePlanDto> MoveItemAsync(Guid id, Guid itemId, MoveSitePlanItemInput input) => appService.MoveItemAsync(id, itemId, input);

    [HttpPut("{id:guid}/items/{itemId:guid}")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<SitePlanDto> UpdateItemAsync(Guid id, Guid itemId, UpdateSitePlanItemInput input) => appService.UpdateItemAsync(id, itemId, input);

    [HttpDelete("{id:guid}/items/{itemId:guid}")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<SitePlanDto> RemoveItemAsync(Guid id, Guid itemId) => appService.RemoveItemAsync(id, itemId);

    [HttpGet("{id:guid}/power")]
    public Task<SitePowerDto> GetPowerAsync(Guid id, [FromQuery] double voltage = 220) => appService.GetPowerAsync(id, voltage);

    [HttpPost("{id:guid}/zones")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<SitePlanDto> AddZoneAsync(Guid id, SaveSitePlanZoneInput input) => appService.SaveZoneAsync(id, null, input);

    [HttpPut("{id:guid}/zones/{zoneId:guid}")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<SitePlanDto> UpdateZoneAsync(Guid id, Guid zoneId, SaveSitePlanZoneInput input) => appService.SaveZoneAsync(id, zoneId, input);

    [HttpDelete("{id:guid}/zones/{zoneId:guid}")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<SitePlanDto> RemoveZoneAsync(Guid id, Guid zoneId) => appService.RemoveZoneAsync(id, zoneId);
}

/// <summary>The bridge: a site plan becomes planned equipment on its job, and from there the quote and the warehouse.</summary>
[ApiController]
[Route("api/site-plans/{planId:guid}/job")]
[Authorize(StageTrackPermissions.Projects.Manage)]
public class SiteJobController(ISiteJobAppService appService) : ControllerBase
{
    [HttpPost("preview")]
    public Task<SiteToJobResultDto> PreviewAsync(Guid planId, SiteToJobInput input) => appService.PreviewAsync(planId, input);

    [HttpPost("transfer")]
    public Task<SiteToJobResultDto> TransferAsync(Guid planId, SiteToJobInput input) => appService.TransferAsync(planId, input);
}

public class RenameSitePlanInput
{
    public string Name { get; set; } = null!;
}
