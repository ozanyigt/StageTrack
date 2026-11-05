using StageTrack.Projects;
using StageTrack.Repositories;

namespace StageTrack.Sites;

/// <summary>
/// The job's room. One record per job, created the moment somebody enters a measurement, and from then on read
/// by every design screen: the 3D stage stands inside it, the sightline plan is bounded by it, and the printed
/// drawing is scaled against it.
/// </summary>
public class SitePlanAppService(
    ISitePlanRepository planRepository,
    IProjectRepository projectRepository,
    IUnitOfWork unitOfWork) : ISitePlanAppService
{
    public async Task<SitePlanDto?> FindByProjectAsync(Guid projectId)
    {
        var plan = await planRepository.FindByProjectAsync(projectId);
        return plan is null ? null : await ToDtoAsync(plan);
    }

    public async Task<SitePlanDto> CreateAsync(CreateSitePlanInput input)
    {
        var project = await projectRepository.GetAsync(input.ProjectId, includeDetails: false);
        if (await planRepository.FindByProjectAsync(project.Id) is not null)
        {
            throw new BusinessException(StageTrackErrorCodes.SitePlanAlreadyExists);
        }

        var name = string.IsNullOrWhiteSpace(input.Name) ? project.Venue ?? project.Name : input.Name;
        var plan = new SitePlan(Guid.CreateVersion7(), project.Id, name);
        await planRepository.InsertAsync(plan);
        await unitOfWork.SaveChangesAsync();
        return await ToDtoAsync(plan);
    }

    public Task<SitePlanDto> SetVenueAsync(Guid id, SetSiteVenueInput input) =>
        MutateAsync(id, plan => plan.SetVenue(input.WidthM, input.DepthM, input.ClearHeightM, input.StageOffsetXM, input.BehindStageM, input.RakeDeg));

    public Task<SitePlanDto> SetVenuePlanAsync(Guid id, SetSiteVenuePlanInput input) =>
        MutateAsync(id, plan => plan.VenueOrThrow()
            .SetPlan(input.PlanAttachmentId, input.PlanMetresPerPixel, input.PlanOriginXM, input.PlanOriginZM, input.PlanRotationDeg));

    public Task<SitePlanDto> RemoveVenueAsync(Guid id) => MutateAsync(id, plan => plan.RemoveVenue());

    private async Task<SitePlanDto> MutateAsync(Guid id, Action<SitePlan> change)
    {
        var plan = await planRepository.GetAsync(id);
        change(plan);
        await unitOfWork.SaveChangesAsync();
        return await ToDtoAsync(plan);
    }

    private async Task<SitePlanDto> ToDtoAsync(SitePlan plan)
    {
        var project = await projectRepository.GetAsync(plan.ProjectId, includeDetails: false);
        return new SitePlanDto
        {
            Id = plan.Id,
            ProjectId = plan.ProjectId,
            ProjectNumber = project.Number,
            ProjectName = project.Name,
            VenueName = project.Venue,
            Name = plan.Name,
            Venue = plan.Venue is not { } venue
                ? null
                : new SiteVenueDto
                {
                    WidthM = venue.WidthM,
                    DepthM = venue.DepthM,
                    ClearHeightM = venue.ClearHeightM,
                    StageOffsetXM = venue.StageOffsetXM,
                    BehindStageM = venue.BehindStageM,
                    RakeDeg = venue.RakeDeg,
                    PlanAttachmentId = venue.PlanAttachmentId,
                    PlanMetresPerPixel = venue.PlanMetresPerPixel,
                    PlanOriginXM = venue.PlanOriginXM,
                    PlanOriginZM = venue.PlanOriginZM,
                    PlanRotationDeg = venue.PlanRotationDeg
                }
        };
    }
}
