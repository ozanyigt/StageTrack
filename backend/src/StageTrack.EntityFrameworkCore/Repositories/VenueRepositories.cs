using Microsoft.EntityFrameworkCore;
using StageTrack.EntityFrameworkCore;
using StageTrack.Venues;

namespace StageTrack.Repositories;

public class ProjectVenueRepository(StageTrackDbContext dbContext) : EfRepository<ProjectVenue>(dbContext), IProjectVenueRepository
{
    // The room is part of the venue's own row (an owned type), so there is nothing to include.
    public Task<ProjectVenue?> FindByProjectAsync(Guid projectId, CancellationToken cancellationToken = default) =>
        DbSet.FirstOrDefaultAsync(p => p.ProjectId == projectId, cancellationToken);
}
