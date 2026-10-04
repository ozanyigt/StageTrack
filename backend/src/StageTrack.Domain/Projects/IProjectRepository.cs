using StageTrack.Repositories;

namespace StageTrack.Projects;

public class ProjectFilter
{
    public string? Text { get; set; }
    public IReadOnlyCollection<ProjectStatus>? Statuses { get; set; }

    /// <summary>Projects whose planning period overlaps [From, To].</summary>
    public DateTime? From { get; set; }

    public DateTime? To { get; set; }
    public Guid? CustomerId { get; set; }
    public Guid? StockLocationId { get; set; }
}

public class ProjectListItem
{
    public required Project Project { get; init; }
    public string? CustomerName { get; init; }
    public string? StockLocationName { get; init; }
    public int PlannedQuantity { get; init; }
}

public interface IProjectRepository : IRepository<Project>
{
    Task<int> GetMaxNumberAsync(CancellationToken cancellationToken = default);

    Task<List<ProjectListItem>> GetPagedListAsync(ProjectFilter filter, string? sorting, int skip, int take, CancellationToken cancellationToken = default);

    Task<long> GetCountAsync(ProjectFilter filter, CancellationToken cancellationToken = default);

    Task<bool> IsEquipmentPlannedOnActiveProjectsAsync(Guid equipmentId, CancellationToken cancellationToken = default);

    Task<bool> AnyForCustomerAsync(Guid customerId, CancellationToken cancellationToken = default);

    Task<Dictionary<ProjectStatus, int>> GetStatusCountsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Sum of planned quantities per equipment on reserving projects whose planning period overlaps [start, end].
    /// </summary>
    Task<Dictionary<Guid, int>> GetPlannedQuantitiesAsync(IReadOnlyCollection<Guid> equipmentIds, DateTime start, DateTime end,
        Guid? excludeProjectId, CancellationToken cancellationToken = default);
}
