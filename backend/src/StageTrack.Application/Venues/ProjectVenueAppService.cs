using StageTrack.Projects;
using StageTrack.Repositories;

namespace StageTrack.Venues;

/// <summary>
/// The job's venue. One record per job, created the moment somebody enters a measurement, and from then on read
/// by every design screen: the 3D stage stands inside it, the sightline plan is bounded by it, and the printed
/// drawing is scaled against it.
/// </summary>
public class ProjectVenueAppService(
    IProjectVenueRepository venueRepository,
    IProjectRepository projectRepository,
    IUnitOfWork unitOfWork) : IProjectVenueAppService
{
    public async Task<ProjectVenueDto?> FindByProjectAsync(Guid projectId)
    {
        var venue = await venueRepository.FindByProjectAsync(projectId);
        return venue is null ? null : await ToDtoAsync(venue);
    }

    public Task<ProjectVenueDto> SetRoomAsync(Guid projectId, SetVenueRoomInput input) =>
        MutateAsync(projectId, venue => venue.SetRoom(
            input.WidthM, input.DepthM, input.ClearHeightM, input.StageOffsetXM, input.BehindStageM, input.RakeDeg));

    public Task<ProjectVenueDto> SetPlanAsync(Guid projectId, SetVenuePlanInput input) =>
        MutateAsync(projectId, venue => venue.RoomOrThrow()
            .SetPlan(input.PlanAttachmentId, input.PlanMetresPerPixel, input.PlanOriginXM, input.PlanOriginZM, input.PlanRotationDeg));

    public Task<ProjectVenueDto> RemoveRoomAsync(Guid projectId) => MutateAsync(projectId, venue => venue.RemoveRoom());

    /// <summary>
    /// Every change goes through here, and the record is made on first use: a job always has a venue to write to,
    /// so no screen has to create one before it can save a number.
    /// </summary>
    private async Task<ProjectVenueDto> MutateAsync(Guid projectId, Action<ProjectVenue> change)
    {
        var project = await projectRepository.GetAsync(projectId, includeDetails: false);
        var venue = await venueRepository.FindByProjectAsync(project.Id);
        if (venue is null)
        {
            var name = string.IsNullOrWhiteSpace(project.VenueName) ? project.Name : project.VenueName!;
            venue = new ProjectVenue(Guid.CreateVersion7(), project.Id, name);
            await venueRepository.InsertAsync(venue);
        }

        change(venue);
        await unitOfWork.SaveChangesAsync();
        return await ToDtoAsync(venue);
    }

    private async Task<ProjectVenueDto> ToDtoAsync(ProjectVenue venue)
    {
        var project = await projectRepository.GetAsync(venue.ProjectId, includeDetails: false);
        return new ProjectVenueDto
        {
            Id = venue.Id,
            ProjectId = venue.ProjectId,
            ProjectNumber = project.Number,
            ProjectName = project.Name,
            VenueName = project.VenueName,
            Name = venue.Name,
            Room = venue.Room is not { } room
                ? null
                : new VenueRoomDto
                {
                    WidthM = room.WidthM,
                    DepthM = room.DepthM,
                    ClearHeightM = room.ClearHeightM,
                    StageOffsetXM = room.StageOffsetXM,
                    BehindStageM = room.BehindStageM,
                    RakeDeg = room.RakeDeg,
                    PlanAttachmentId = room.PlanAttachmentId,
                    PlanMetresPerPixel = room.PlanMetresPerPixel,
                    PlanOriginXM = room.PlanOriginXM,
                    PlanOriginZM = room.PlanOriginZM,
                    PlanRotationDeg = room.PlanRotationDeg
                }
        };
    }
}
