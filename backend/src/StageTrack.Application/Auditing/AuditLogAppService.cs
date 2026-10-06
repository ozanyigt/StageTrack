using StageTrack.Dtos;
using StageTrack.Identity;

namespace StageTrack.Auditing;

public class AuditLogAppService(IAuditLogRepository auditLogRepository, IUserRepository userRepository) : IAuditLogAppService
{
    public async Task<PagedResultDto<AuditLogDto>> GetListAsync(GetAuditLogListInput input)
    {
        var total = await auditLogRepository.GetCountAsync(input.Text);
        var items = await auditLogRepository.GetPagedListAsync(input.Text, input.SkipCount, input.MaxResultCount);
        var userIds = items.SelectMany(x => new[] { x.UserId, x.ImpersonatorId }).Where(x => x.HasValue).Select(x => x!.Value).Distinct();
        var names = (await userRepository.GetListByIdsAsync(userIds)).ToDictionary(u => u.Id, u => u.FullName);
        return new PagedResultDto<AuditLogDto>(total, items.Select(x => new AuditLogDto
        {
            Id = x.Id,
            CreationTime = x.CreationTime,
            Action = x.Action,
            EntityType = x.EntityType,
            EntityId = x.EntityId,
            Description = x.Description,
            UserName = x.UserName,
            UserFullName = x.UserId.HasValue ? names.GetValueOrDefault(x.UserId.Value) : null,
            ImpersonatorName = x.ImpersonatorId.HasValue ? names.GetValueOrDefault(x.ImpersonatorId.Value) : null
        }).ToList());
    }
}
