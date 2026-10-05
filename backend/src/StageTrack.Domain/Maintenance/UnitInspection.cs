using StageTrack.Entities;
using StageTrack.Inventory;
using StageTrack.Repositories;

namespace StageTrack.Maintenance;

/// <summary>A periodic inspection result of one device (e.g. yearly rigging check of a chain hoist).</summary>
public class UnitInspection : CompanyAggregateRoot
{
    public Guid EquipmentId { get; private set; }
    public Guid UnitId { get; private set; }
    public DateTime Date { get; private set; }
    public bool Passed { get; private set; }
    public string? Notes { get; private set; }

    private UnitInspection()
    {
    }

    internal UnitInspection(Guid id, Guid equipmentId, Guid unitId, DateTime date, bool passed, string? notes) : base(id)
    {
        EquipmentId = equipmentId;
        UnitId = unitId;
        Date = date;
        Passed = passed;
        Notes = notes;
    }
}

public class InspectionListItem
{
    public required UnitInspection Inspection { get; init; }
    public required string UnitInternalRef { get; init; }
    public string? InspectorName { get; init; }
}

public interface IUnitInspectionRepository : IRepository<UnitInspection>
{
    Task<List<InspectionListItem>> GetListAsync(Guid? equipmentId, Guid? unitId, int take, CancellationToken cancellationToken = default);
}

public class InspectionManager
{
    /// <summary>
    /// Records the result; a failed inspection takes the device out of stock (InRepair) so it cannot
    /// be scanned out until it is fixed.
    /// </summary>
    public UnitInspection Record(Equipment equipment, EquipmentUnit unit, DateTime date, bool passed, string? notes)
    {
        if (equipment.InspectionIntervalMonths is null)
        {
            throw new BusinessException(StageTrackErrorCodes.InspectionNotConfigured);
        }

        unit.RecordInspection(date);
        if (!passed && unit.Status == UnitStatus.InStock)
        {
            unit.SetStatus(UnitStatus.InRepair);
        }

        return new UnitInspection(Guid.CreateVersion7(), equipment.Id, unit.Id, date, passed, notes);
    }
}
