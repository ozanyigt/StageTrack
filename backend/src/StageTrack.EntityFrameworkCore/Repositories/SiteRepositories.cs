using Microsoft.EntityFrameworkCore;
using StageTrack.EntityFrameworkCore;
using StageTrack.Sites;

namespace StageTrack.Repositories;

public class SitePlanRepository(StageTrackDbContext dbContext) : EfRepository<SitePlan>(dbContext), ISitePlanRepository
{
    protected override IQueryable<SitePlan> WithDetails(IQueryable<SitePlan> query) =>
        query.Include(p => p.Items).Include(p => p.Zones);

    public Task<SitePlan?> FindByProjectAsync(Guid projectId, CancellationToken cancellationToken = default) =>
        WithDetails(DbSet).FirstOrDefaultAsync(p => p.ProjectId == projectId, cancellationToken);

    public async Task<HashSet<Guid>> GetProjectIdsWithPlanAsync(IReadOnlyCollection<Guid> projectIds, CancellationToken cancellationToken = default)
    {
        var ids = projectIds.Distinct().ToList();
        var found = await DbSet.Where(p => ids.Contains(p.ProjectId)).Select(p => p.ProjectId).ToListAsync(cancellationToken);
        return found.ToHashSet();
    }
}
