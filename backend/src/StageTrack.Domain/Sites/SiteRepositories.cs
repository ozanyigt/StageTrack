using StageTrack.Repositories;

namespace StageTrack.Sites;

public interface ISitePlanRepository : IRepository<SitePlan>
{
    /// <summary>The job's plan with its items and zones; null when it has none yet.</summary>
    Task<SitePlan?> FindByProjectAsync(Guid projectId, CancellationToken cancellationToken = default);

    /// <summary>Which of the given jobs already have a plan, so a list can show it without loading them.</summary>
    Task<HashSet<Guid>> GetProjectIdsWithPlanAsync(IReadOnlyCollection<Guid> projectIds, CancellationToken cancellationToken = default);
}
