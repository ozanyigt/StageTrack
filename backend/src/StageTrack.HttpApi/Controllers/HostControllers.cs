using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StageTrack.Account;
using StageTrack.Dtos;
using StageTrack.Host;
using StageTrack.Permissions;

namespace StageTrack.Controllers;

/// <summary>Platform administration: customer firms (tenants), subscriptions, locations and firm users.</summary>
[ApiController]
[Route("api/host/tenants")]
[Authorize(StageTrackPermissions.Host.Tenants)]
public class HostTenantsController(ITenantAppService appService, IAccountAppService accountAppService) : ControllerBase
{
    [HttpGet("summary")]
    public Task<HostSummaryDto> GetSummaryAsync() => appService.GetSummaryAsync();

    [HttpGet]
    public Task<PagedResultDto<TenantDto>> GetListAsync([FromQuery] GetTenantListInput input) => appService.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<TenantDetailDto> GetAsync(Guid id) => appService.GetAsync(id);

    [HttpPost]
    public Task<TenantDetailDto> CreateAsync(CreateTenantInput input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<TenantDetailDto> UpdateAsync(Guid id, UpdateTenantInput input) => appService.UpdateAsync(id, input);

    [HttpPost("{id:guid}/active")]
    public Task<TenantDetailDto> SetActiveAsync(Guid id, SetTenantActiveInput input) => appService.SetActiveAsync(id, input);

    [HttpPost("{id:guid}/locations")]
    public Task<TenantDetailDto> AddLocationAsync(Guid id, TenantLocationInput input) => appService.AddLocationAsync(id, input);

    [HttpPut("{id:guid}/locations/{locationId:guid}")]
    public Task<TenantDetailDto> UpdateLocationAsync(Guid id, Guid locationId, TenantLocationInput input) =>
        appService.UpdateLocationAsync(id, locationId, input);

    [HttpPost("{id:guid}/users/{userId:guid}/reset-password")]
    public Task ResetUserPasswordAsync(Guid id, Guid userId, ResetTenantUserPasswordInput input) =>
        appService.ResetUserPasswordAsync(id, userId, input);

    /// <summary>Sign in as a user of the firm (e.g. its administrator) to set it up during a presentation.</summary>
    [HttpPost("users/{userId:guid}/impersonate")]
    [Authorize(StageTrackPermissions.Host.Impersonate)]
    public Task<LoginResultDto> ImpersonateAsync(Guid userId) => accountAppService.ImpersonateFromHostAsync(userId);
}
