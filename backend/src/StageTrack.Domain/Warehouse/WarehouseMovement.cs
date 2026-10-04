using StageTrack.Entities;
using StageTrack.Repositories;

namespace StageTrack.Warehouse;

/// <summary>
/// Immutable log line for every warehouse action (Rentman "warehouse tracking log").
/// Check-out/check-in rows are also the source of truth for how many items are out on a project.
/// </summary>
public class WarehouseMovement : AggregateRoot, IMultiCompany, IHasCreationTime
{
    public Guid CompanyId { get; set; }
    public DateTime CreationTime { get; set; }
    public MovementAction Action { get; private set; }
    public Guid EquipmentId { get; private set; }
    public Guid? UnitId { get; private set; }
    public Guid? ProjectId { get; private set; }
    public int Quantity { get; private set; }
    public string? LabelCode { get; private set; }
    public Guid? UserId { get; private set; }

    private WarehouseMovement()
    {
    }

    internal WarehouseMovement(Guid id, MovementAction action, Guid equipmentId, Guid? unitId, Guid? projectId,
        int quantity, string? labelCode, Guid? userId) : base(id)
    {
        Action = action;
        EquipmentId = equipmentId;
        UnitId = unitId;
        ProjectId = projectId;
        Quantity = quantity;
        LabelCode = labelCode;
        UserId = userId;
    }
}

public record ProjectEquipmentBalance(Guid EquipmentId, int CheckedOut, int CheckedIn)
{
    public int Out => CheckedOut - CheckedIn;
}

public class MovementFilter
{
    public string? Text { get; set; }
    public Guid? ProjectId { get; set; }
    public Guid? EquipmentId { get; set; }
    public Guid? UnitId { get; set; }
    public MovementAction? Action { get; set; }
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
}

public class MovementListItem
{
    public required WarehouseMovement Movement { get; init; }
    public required string EquipmentCode { get; init; }
    public required string EquipmentName { get; init; }
    public string? UnitInternalRef { get; init; }
    public string? UnitSerialNumber { get; init; }
    public int? ProjectNumber { get; init; }
    public string? ProjectName { get; init; }
    public string? UserFullName { get; init; }
}

public interface IWarehouseMovementRepository : IRepository<WarehouseMovement>
{
    Task<List<ProjectEquipmentBalance>> GetBalancesAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task<List<MovementListItem>> GetPagedListAsync(MovementFilter filter, int skip, int take, CancellationToken cancellationToken = default);

    Task<long> GetCountAsync(MovementFilter filter, CancellationToken cancellationToken = default);
}
