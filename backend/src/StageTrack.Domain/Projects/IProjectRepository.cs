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

    /// <summary>Only projects this user is on the crew of (crew members' own view).</summary>
    public Guid? CrewUserId { get; set; }
}

/// <summary>Planned quantity of one equipment on another project, with that project's planning period.</summary>
public record EquipmentReservation(Guid EquipmentId, int Quantity, DateTime Start, DateTime End);

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

    /// <summary>Reservations of reserving projects whose planning period overlaps [start, end].</summary>
    Task<List<EquipmentReservation>> GetReservationsAsync(IReadOnlyCollection<Guid> equipmentIds, DateTime start, DateTime end,
        Guid? excludeProjectId, CancellationToken cancellationToken = default);
}
