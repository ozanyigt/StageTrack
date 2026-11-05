using StageTrack.Repositories;

namespace StageTrack.Venues;

public interface IProjectVenueRepository : IRepository<ProjectVenue>
{
    /// <summary>The job's venue record; null when nobody has entered one yet.</summary>
    Task<ProjectVenue?> FindByProjectAsync(Guid projectId, CancellationToken cancellationToken = default);
}
