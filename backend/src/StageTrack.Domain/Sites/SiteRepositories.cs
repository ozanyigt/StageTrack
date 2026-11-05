using StageTrack.Repositories;

namespace StageTrack.Sites;

public interface ISitePlanRepository : IRepository<SitePlan>
{
    /// <summary>The job's room; null when nobody has entered one yet.</summary>
    Task<SitePlan?> FindByProjectAsync(Guid projectId, CancellationToken cancellationToken = default);
}
