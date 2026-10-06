using StageTrack.Entities;
using StageTrack.Repositories;
using StageTrack.Session;

namespace StageTrack.Auditing;

/// <summary>
/// A record of a sensitive operation (e.g. deleting equipment): who did what, when, in which location.
/// Kept even when the affected record is gone; never edited.
/// </summary>
public class AuditLog : AggregateRoot, IMultiCompany, IHasCreationTime
{
    public Guid CompanyId { get; set; }
    public DateTime CreationTime { get; set; }

    /// <summary>e.g. "EquipmentDeleted".</summary>
    public string Action { get; private set; } = null!;

    public string EntityType { get; private set; } = null!;
    public Guid? EntityId { get; private set; }

    /// <summary>Human-readable summary, e.g. "VID-010 SDI TO HDMI (3 devices)".</summary>
    public string Description { get; private set; } = null!;

    public Guid? UserId { get; private set; }
    public string? UserName { get; private set; }

    /// <summary>Set when a platform/firm admin did it while signed in as another user.</summary>
    public Guid? ImpersonatorId { get; private set; }

    private AuditLog()
    {
    }

    internal AuditLog(Guid id, string action, string entityType, Guid? entityId, string description, Guid? userId, string? userName,
        Guid? impersonatorId) : base(id)
    {
        Action = action;
        EntityType = entityType;
        EntityId = entityId;
        Description = description.Length > AuditLogConsts.MaxDescriptionLength ? description[..AuditLogConsts.MaxDescriptionLength] : description;
        UserId = userId;
        UserName = userName;
        ImpersonatorId = impersonatorId;
    }
}

public static class AuditLogConsts
{
    public const int MaxActionLength = 64;
    public const int MaxEntityTypeLength = 64;
    public const int MaxDescriptionLength = 1000;

    public const string EquipmentDeleted = "EquipmentDeleted";
}

public interface IAuditLogRepository : IRepository<AuditLog>
{
    Task<List<AuditLog>> GetPagedListAsync(string? text, int skip, int take, CancellationToken cancellationToken = default);

    Task<long> GetCountAsync(string? text, CancellationToken cancellationToken = default);
}

public class AuditLogManager(IAuditLogRepository auditLogRepository, ICurrentUser currentUser)
{
    public async Task<AuditLog> LogAsync(string action, string entityType, Guid? entityId, string description)
    {
        var log = new AuditLog(Guid.CreateVersion7(), action, entityType, entityId, description, currentUser.Id, currentUser.UserName,
            currentUser.ImpersonatorId)
        {
            CreationTime = DateTime.UtcNow
        };
        await auditLogRepository.InsertAsync(log);
        return log;
    }
}
