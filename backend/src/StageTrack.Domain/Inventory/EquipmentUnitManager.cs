namespace StageTrack.Inventory;

public class EquipmentUnitManager(IEquipmentUnitRepository unitRepository)
{
    /// <param name="internalRef">Empty: the next number is used (1, 2, 3… or TR-004 after TR-003).</param>
    public async Task<EquipmentUnit> CreateAsync(Equipment equipment, string? internalRef, string? serialNumber, Guid? stockLocationId)
    {
        if (!equipment.IsSerialized)
        {
            throw new BusinessException(StageTrackErrorCodes.EquipmentNotSerialized);
        }

        internalRef = string.IsNullOrWhiteSpace(internalRef) ? await SuggestInternalRefAsync(equipment.Id) : internalRef.Trim();
        await EnsureInternalRefIsUniqueAsync(equipment.Id, internalRef, null);
        return new EquipmentUnit(Guid.CreateVersion7(), equipment.Id, internalRef, serialNumber?.Trim(), stockLocationId);
    }

    public async Task ChangeInternalRefAsync(EquipmentUnit unit, string internalRef)
    {
        internalRef = internalRef.Trim();
        if (unit.InternalRef == internalRef)
        {
            return;
        }

        await EnsureInternalRefIsUniqueAsync(unit.EquipmentId, internalRef, unit.Id);
        unit.SetInternalRef(internalRef);
    }

    /// <summary>
    /// Next internal reference for a new device: continues the numbering of the last device keeping its prefix and
    /// zero padding (TR-003 → TR-004, 7 → 8); 1 for the first device.
    /// </summary>
    public async Task<string> SuggestInternalRefAsync(Guid equipmentId)
    {
        var refs = await unitRepository.GetInternalRefsAsync(equipmentId);
        var taken = refs.ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Continue from the highest number in use (TR-003 after 1 and 2 → TR-004); 1 for the first device.
        var numbered = refs
            .Select(r => System.Text.RegularExpressions.Regex.Match(r, @"^(.*?)(\d+)$"))
            .Where(m => m.Success && m.Groups[2].Value.Length <= 18)
            .Select(m => (Prefix: m.Groups[1].Value, Number: long.Parse(m.Groups[2].Value), Width: m.Groups[2].Value.Length))
            .OrderByDescending(x => x.Number)
            .ThenByDescending(x => x.Prefix.Length)
            .ToList();
        var (prefix, number, width) = numbered.Count > 0 ? numbered[0] : (string.Empty, (long)refs.Count, 1);

        string candidate;
        do
        {
            number++;
            candidate = prefix + number.ToString().PadLeft(width, '0');
        } while (taken.Contains(candidate));

        return candidate;
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

    public void Restore(EquipmentUnit unit) => unit.Restore();

    public void Archive(EquipmentUnit unit)
    {
        if (unit.Status == UnitStatus.OnProject)
        {
            throw new BusinessException(StageTrackErrorCodes.UnitNotInStock);
        }

        unit.Archive();
    }

    private async Task EnsureInternalRefIsUniqueAsync(Guid equipmentId, string internalRef, Guid? excludeId)
    {
        if (await unitRepository.InternalRefExistsAsync(equipmentId, internalRef, excludeId))
        {
            throw new BusinessException(StageTrackErrorCodes.UnitInternalRefAlreadyExists).WithData("reference", internalRef);
        }
    }
}
