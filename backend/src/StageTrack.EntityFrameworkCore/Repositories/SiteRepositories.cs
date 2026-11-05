using Microsoft.EntityFrameworkCore;
using StageTrack.EntityFrameworkCore;
using StageTrack.Sites;

namespace StageTrack.Repositories;

public class SitePlanRepository(StageTrackDbContext dbContext) : EfRepository<SitePlan>(dbContext), ISitePlanRepository
{
    // The room is part of the plan's own row (an owned type), so there is nothing to include.
    public Task<SitePlan?> FindByProjectAsync(Guid projectId, CancellationToken cancellationToken = default) =>
        DbSet.FirstOrDefaultAsync(p => p.ProjectId == projectId, cancellationToken);
}
