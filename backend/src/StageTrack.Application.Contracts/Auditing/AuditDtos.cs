using StageTrack.Dtos;

namespace StageTrack.Auditing;

public class AuditLogDto
{
    public Guid Id { get; set; }
    public DateTime CreationTime { get; set; }
    public string Action { get; set; } = null!;
    public string EntityType { get; set; } = null!;
    public Guid? EntityId { get; set; }
    public string Description { get; set; } = null!;
    public string? UserName { get; set; }
    public string? UserFullName { get; set; }

    /// <summary>The admin who was signed in as the user, if any.</summary>
    public string? ImpersonatorName { get; set; }
}

public class GetAuditLogListInput : PagedRequestDto
{
    public string? Text { get; set; }
}

public interface IAuditLogAppService
{
    Task<PagedResultDto<AuditLogDto>> GetListAsync(GetAuditLogListInput input);
}
