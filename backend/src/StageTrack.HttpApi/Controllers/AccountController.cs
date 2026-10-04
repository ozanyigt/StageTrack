using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StageTrack.Account;
using StageTrack.Dashboard;
using StageTrack.Permissions;

namespace StageTrack.Controllers;

[ApiController]
[Route("api/account")]
public class AccountController(IAccountAppService accountAppService) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("login")]
    public Task<LoginResultDto> LoginAsync(LoginInput input) => accountAppService.LoginAsync(input);

    [Authorize]
    [HttpGet("me")]
    public Task<CurrentUserDto> GetCurrentAsync() => accountAppService.GetCurrentAsync();

    [Authorize]
    [HttpPut("language")]
    public Task SetLanguageAsync(SetLanguageInput input) => accountAppService.SetLanguageAsync(input);

    [Authorize(StageTrackPermissions.Identity.Impersonate)]
    [HttpPost("impersonate/{userId:guid}")]
    public Task<LoginResultDto> ImpersonateAsync(Guid userId) => accountAppService.ImpersonateAsync(userId);

    /// <summary>Only needs a valid token: the impersonated user usually lacks admin permissions.</summary>
    [Authorize]
    [HttpPost("end-impersonation")]
    public Task<LoginResultDto> EndImpersonationAsync() => accountAppService.EndImpersonationAsync();
}

[ApiController]
[Authorize]
[Route("api/dashboard")]
public class DashboardController(IDashboardAppService dashboardAppService) : ControllerBase
{
    [HttpGet]
    public Task<DashboardDto> GetAsync() => dashboardAppService.GetAsync();
}
