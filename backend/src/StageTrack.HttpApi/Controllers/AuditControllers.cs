using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StageTrack.Auditing;
using StageTrack.Dtos;
using StageTrack.Permissions;

namespace StageTrack.Controllers;

[ApiController]
[Route("api/audit-logs")]
[Authorize(StageTrackPermissions.Settings.AuditLog)]
public class AuditLogsController(IAuditLogAppService appService) : ControllerBase
{
    [HttpGet]
    public Task<PagedResultDto<AuditLogDto>> GetListAsync([FromQuery] GetAuditLogListInput input) => appService.GetListAsync(input);
}
