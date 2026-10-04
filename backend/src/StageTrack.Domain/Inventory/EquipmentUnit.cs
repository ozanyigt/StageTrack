using StageTrack.Entities;

namespace StageTrack.Inventory;

/// <summary>One physical device of a serialized equipment (Rentman "serial number").</summary>
public class EquipmentUnit : CompanyAggregateRoot
{
    public Guid EquipmentId { get; private set; }

    /// <summary>Manufacturer serial number printed on the device.</summary>
    public string? SerialNumber { get; private set; }

    /// <summary>Company's own reference, e.g. "LA-RAK II AVB 001" or "WASH 1200 017".</summary>
    public string InternalRef { get; private set; } = null!;

    public Guid? StockLocationId { get; private set; }
    public UnitStatus Status { get; private set; } = UnitStatus.InStock;

    /// <summary>Project the device is checked out to while <see cref="Status"/> is OnProject.</summary>
    public Guid? CurrentProjectId { get; private set; }

    public string? Notes { get; private set; }
    public bool IsArchived { get; private set; }

    private EquipmentUnit()
    {
    }

    internal EquipmentUnit(Guid id, Guid equipmentId, string internalRef, string? serialNumber, Guid? stockLocationId)
        : base(id)
    {
        EquipmentId = equipmentId;
        InternalRef = internalRef;
        SerialNumber = serialNumber;
        StockLocationId = stockLocationId;
    }

    internal void SetInternalRef(string internalRef) => InternalRef = internalRef;

    public void Update(string? serialNumber, Guid? stockLocationId, string? notes)
    {
        SerialNumber = serialNumber;
        StockLocationId = stockLocationId;
        Notes = notes;
    }

    internal void CheckOut(Guid projectId)
    {
        Status = UnitStatus.OnProject;
        CurrentProjectId = projectId;
    }

    internal void CheckIn()
    {
        Status = UnitStatus.InStock;
        CurrentProjectId = null;
    }

    internal void SetStatus(UnitStatus status) => Status = status;

    internal void Archive() => IsArchived = true;

    /// <summary>Devices in repair or lost are not counted as available stock.</summary>
    public bool CountsAsStock => !IsArchived && Status is UnitStatus.InStock or UnitStatus.OnProject;
}
