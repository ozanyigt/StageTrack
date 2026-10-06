using Microsoft.EntityFrameworkCore;
using StageTrack.Auditing;
using StageTrack.EntityFrameworkCore;

namespace StageTrack.Repositories;

public class AuditLogRepository(StageTrackDbContext dbContext) : EfRepository<AuditLog>(dbContext), IAuditLogRepository
{
    public Task<List<AuditLog>> GetPagedListAsync(string? text, int skip, int take, CancellationToken cancellationToken = default) =>
        ApplyFilter(text).OrderByDescending(x => x.CreationTime).Skip(skip).Take(take).AsNoTracking().ToListAsync(cancellationToken);

    public Task<long> GetCountAsync(string? text, CancellationToken cancellationToken = default) =>
        ApplyFilter(text).LongCountAsync(cancellationToken);

    private IQueryable<AuditLog> ApplyFilter(string? text)
    {
        var query = DbSet.AsQueryable();
        if (!string.IsNullOrWhiteSpace(text))
        {
            text = text.Trim();
            query = query.Where(x => x.Description.Contains(text) || (x.UserName != null && x.UserName.Contains(text)));
        }

        return query;
    }
}
