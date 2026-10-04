namespace StageTrack.Inventory;

public class EquipmentUnitManager(IEquipmentUnitRepository unitRepository)
{
    public async Task<EquipmentUnit> CreateAsync(Equipment equipment, string internalRef, string? serialNumber, Guid? stockLocationId)
    {
        if (!equipment.IsSerialized)
        {
            throw new BusinessException(StageTrackErrorCodes.EquipmentNotSerialized);
        }

        internalRef = internalRef.Trim();
        await EnsureInternalRefIsUniqueAsync(internalRef, null);
        return new EquipmentUnit(Guid.CreateVersion7(), equipment.Id, internalRef, serialNumber?.Trim(), stockLocationId);
    }

    public async Task ChangeInternalRefAsync(EquipmentUnit unit, string internalRef)
    {
        internalRef = internalRef.Trim();
        if (unit.InternalRef == internalRef)
        {
            return;
        }

        await EnsureInternalRefIsUniqueAsync(internalRef, unit.Id);
        unit.SetInternalRef(internalRef);
    }

    /// <summary>
    /// Moves a device between InStock, InRepair and Lost. Devices out on a project must be
    /// checked in through the warehouse scan first, so the movement log stays complete.
    /// </summary>
    public void ChangeStatus(EquipmentUnit unit, UnitStatus status)
    {
        if (status == UnitStatus.OnProject || unit.Status == UnitStatus.OnProject)
        {
            throw new BusinessException(StageTrackErrorCodes.UnitNotInStock);
        }

        unit.SetStatus(status);
    }

    public void Archive(EquipmentUnit unit)
    {
        if (unit.Status == UnitStatus.OnProject)
        {
            throw new BusinessException(StageTrackErrorCodes.UnitNotInStock);
        }

        unit.Archive();
    }

    private async Task EnsureInternalRefIsUniqueAsync(string internalRef, Guid? excludeId)
    {
        if (await unitRepository.InternalRefExistsAsync(internalRef, excludeId))
        {
            throw new BusinessException(StageTrackErrorCodes.UnitInternalRefAlreadyExists).WithData("reference", internalRef);
        }
    }
}
