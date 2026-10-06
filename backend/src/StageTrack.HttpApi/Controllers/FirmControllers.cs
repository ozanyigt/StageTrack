using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using StageTrack.Account;
using StageTrack.Permissions;

namespace StageTrack.Controllers;

[ApiController]
[Route("api/firm")]
[Authorize]
public class FirmController(IFirmAppService appService) : ControllerBase
{
    [HttpGet("logo")]
    public async Task<IActionResult> GetLogoAsync()
    {
        var logo = await appService.GetLogoAsync();
        return logo is null ? NoContent() : File(logo.Content, logo.ContentType);
    }

    [HttpPut("logo")]
    [Authorize(StageTrackPermissions.Settings.Firm)]
    [RequestSizeLimit(3 * 1024 * 1024)]
    public async Task SetLogoAsync(IFormFile file) => await appService.SetLogoAsync(await file.ToUploadAsync());

    [HttpDelete("logo")]
    [Authorize(StageTrackPermissions.Settings.Firm)]
    public Task RemoveLogoAsync() => appService.RemoveLogoAsync();
}
