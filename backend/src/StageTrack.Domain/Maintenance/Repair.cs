using StageTrack.Entities;
using StageTrack.Inventory;
using StageTrack.Repositories;

namespace StageTrack.Maintenance;

/// <summary>A repair of one device (or of some pieces of quantity-tracked equipment).</summary>
public class Repair : CompanyAggregateRoot
{
    public int Number { get; private set; }
    public Guid EquipmentId { get; private set; }
    public Guid? UnitId { get; private set; }
    public int Quantity { get; private set; } = 1;
    public string Title { get; private set; } = null!;
    public string? Description { get; private set; }
    public RepairStatus Status { get; private set; } = RepairStatus.Open;
    public DateTime ReportedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    /// <summary>External repair shop, when the device is sent out.</summary>
    public Guid? SupplierId { get; private set; }

    public decimal? Cost { get; private set; }

    private Repair()
    {
    }

    internal Repair(Guid id, int number, Guid equipmentId, Guid? unitId, int quantity, string title, DateTime reportedAt) : base(id)
    {
        Number = number;
        EquipmentId = equipmentId;
        UnitId = unitId;
        Quantity = Math.Max(1, quantity);
        Title = title;
        ReportedAt = reportedAt;
    }

    public bool IsClosed => Status is RepairStatus.Completed or RepairStatus.Cancelled;

    public void Update(string title, string? description, Guid? supplierId, decimal? cost)
    {
        Title = title;
        Description = description;
        SupplierId = supplierId;
        Cost = cost is null ? null : Math.Max(0, cost.Value);
    }

    internal void SetStatus(RepairStatus status, DateTime now)
    {
        Status = status;
        CompletedAt = status is RepairStatus.Completed or RepairStatus.Cancelled ? now : null;
    }
}

public class RepairFilter
{
    public string? Text { get; set; }
    public Guid? EquipmentId { get; set; }
    public Guid? UnitId { get; set; }
    public RepairStatus? Status { get; set; }
    public bool OnlyOpen { get; set; }
}

public class RepairListItem
{
    public required Repair Repair { get; init; }
    public required string EquipmentCode { get; init; }
    public required string EquipmentName { get; init; }
    public string? UnitInternalRef { get; init; }
    public string? SupplierName { get; init; }
}

public interface IRepairRepository : IRepository<Repair>
{
    Task<int> GetMaxNumberAsync(CancellationToken cancellationToken = default);

    Task<List<RepairListItem>> GetPagedListAsync(RepairFilter filter, int skip, int take, CancellationToken cancellationToken = default);

    Task<long> GetCountAsync(RepairFilter filter, CancellationToken cancellationToken = default);
}

/// <summary>
/// Opening a repair takes the device out of available stock (status InRepair); completing or cancelling
/// it puts the device back in stock. Repair numbers continue per location, like the Rentman "Repairs" list.
/// </summary>
public class RepairManager(IRepairRepository repairRepository, IEquipmentUnitRepository unitRepository)
{
    private static readonly Dictionary<RepairStatus, RepairStatus[]> Transitions = new()
    {
        [RepairStatus.Open] = [RepairStatus.InProgress, RepairStatus.Completed, RepairStatus.Cancelled],
        [RepairStatus.InProgress] = [RepairStatus.Open, RepairStatus.Completed, RepairStatus.Cancelled],
        [RepairStatus.Completed] = [],
        [RepairStatus.Cancelled] = []
    };

    public static IReadOnlyList<RepairStatus> GetAllowedTargets(RepairStatus from) => Transitions[from];

    public async Task<Repair> CreateAsync(Equipment equipment, EquipmentUnit? unit, int quantity, string title, DateTime reportedAt)
    {
        if (equipment.IsSerialized && unit is null)
        {
            throw new BusinessException(StageTrackErrorCodes.RepairUnitRequired);
        }

        if (unit is not null)
        {
            if (unit.Status != UnitStatus.InStock)
            {
                throw new BusinessException(StageTrackErrorCodes.UnitNotInStock);
            }

            unit.SetStatus(UnitStatus.InRepair);
        }

        var number = await repairRepository.GetMaxNumberAsync() + 1;
        return new Repair(Guid.CreateVersion7(), number, equipment.Id, unit?.Id, unit is null ? quantity : 1, title.Trim(), reportedAt);
    }

    public async Task ChangeStatusAsync(Repair repair, RepairStatus status, DateTime now)
    {
        if (repair.Status == status)
        {
            return;
        }

        if (!Transitions[repair.Status].Contains(status))
        {
            throw new BusinessException(StageTrackErrorCodes.RepairInvalidStatusTransition)
                .WithData("from", repair.Status)
                .WithData("to", status);
        }

        repair.SetStatus(status, now);

        if (repair.IsClosed && repair.UnitId is { } unitId)
        {
            var unit = await unitRepository.GetAsync(unitId);
            if (unit.Status == UnitStatus.InRepair)
            {
                unit.SetStatus(UnitStatus.InStock);
            }
        }
    }
}
