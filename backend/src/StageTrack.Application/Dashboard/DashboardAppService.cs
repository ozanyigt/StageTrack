using StageTrack.Authorization;
using StageTrack.Inventory;
using StageTrack.Permissions;
using StageTrack.Projects;
using StageTrack.Warehouse;

namespace StageTrack.Dashboard;

public class DashboardAppService(
    IProjectRepository projectRepository,
    IEquipmentUnitRepository unitRepository,
    IWarehouseMovementRepository movementRepository,
    AvailabilityManager availabilityManager,
    IPermissionChecker permissionChecker) : IDashboardAppService
{
    private const int UpcomingDays = 7;
    private const int ShortageLookAheadDays = 14;

    /// <summary>Each block is only filled when the user may see that module, so the endpoint never leaks data.</summary>
    public async Task<DashboardDto> GetAsync()
    {
        var dashboard = new DashboardDto();

        if (await permissionChecker.IsGrantedAsync(StageTrackPermissions.Projects.Default))
        {
            await FillProjectsAsync(dashboard);
        }

        if (await permissionChecker.IsGrantedAsync(StageTrackPermissions.Equipment.Default))
        {
            dashboard.UnitsByStatus = await unitRepository.GetStatusCountsAsync();
        }

        if (await permissionChecker.IsGrantedAsync(StageTrackPermissions.Warehouse.Default))
        {
            var movements = await movementRepository.GetPagedListAsync(new MovementFilter(), 0, 8);
            dashboard.RecentMovements = movements.Select(x => x.ToDto()).ToList();
        }

        return dashboard;
    }

    private async Task FillProjectsAsync(DashboardDto dashboard)
    {
        var today = DateTime.Today;

        var upcoming = await projectRepository.GetPagedListAsync(new ProjectFilter
        {
            Statuses = [ProjectStatus.Pending, ProjectStatus.Confirmed, ProjectStatus.Prepped],
            From = today,
            To = today.AddDays(UpcomingDays)
        }, null, 0, 10);

        var reservingSoon = await projectRepository.GetPagedListAsync(new ProjectFilter
        {
            Statuses = ProjectStatusRules.Reserving,
            From = today,
            To = today.AddDays(ShortageLookAheadDays)
        }, null, 0, 50);

        var shortages = new List<ShortageSummaryDto>();
        foreach (var item in reservingSoon.Where(x => x.Project.PlanStart >= today.AddDays(-1)))
        {
            var project = await projectRepository.GetAsync(item.Project.Id);
            var missing = await availabilityManager.GetShortagesAsync(project);
            if (missing.Count > 0)
            {
                shortages.Add(new ShortageSummaryDto
                {
                    ProjectId = project.Id,
                    ProjectNumber = project.Number,
                    ProjectName = project.Name,
                    PlanStart = project.PlanStart,
                    MissingQuantity = missing.Sum(m => m.Missing),
                    LineCount = missing.Count
                });
            }
        }

        dashboard.ProjectsByStatus = await projectRepository.GetStatusCountsAsync();
        dashboard.Upcoming = upcoming.Select(x => x.ToDto()).ToList();
        dashboard.Shortages = shortages;
    }
}
