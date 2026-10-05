using StageTrack.Inventory;
using StageTrack.Projects;
using StageTrack.Warehouse;

namespace StageTrack.Dashboard;

public class DashboardDto
{
    public Dictionary<ProjectStatus, int> ProjectsByStatus { get; set; } = [];
    public Dictionary<UnitStatus, int> UnitsByStatus { get; set; } = [];
    public List<ProjectListItemDto> Upcoming { get; set; } = [];
    public List<ShortageSummaryDto> Shortages { get; set; } = [];
    public List<MovementDto> RecentMovements { get; set; } = [];

    /// <summary>Crew members: confirmed projects they are assigned to.</summary>
    public List<ProjectListItemDto> MyProjects { get; set; } = [];

    public int OpenRepairs { get; set; }
    public int OverdueInspections { get; set; }
}

public class ShortageSummaryDto
{
    public Guid ProjectId { get; set; }
    public int ProjectNumber { get; set; }
    public string ProjectName { get; set; } = null!;
    public DateTime PlanStart { get; set; }
    public int MissingQuantity { get; set; }
    public int LineCount { get; set; }
}

public interface IDashboardAppService
{
    Task<DashboardDto> GetAsync();
}
