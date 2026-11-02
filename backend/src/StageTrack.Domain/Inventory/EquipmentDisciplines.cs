namespace StageTrack.Inventory;

/// <summary>
/// Which trade a piece of equipment belongs to. The firm tags folders, not products: tagging "Ses" once covers the
/// hundred speakers under it, and a subfolder may still say something else. A product outside any tagged folder
/// belongs to no trade - it is ordinary inventory and the design tabs leave it alone.
/// </summary>
public static class EquipmentDisciplines
{
    /// <summary>The trade of a folder: its own, or the nearest one above it.</summary>
    public static EquipmentDiscipline? Of(IReadOnlyDictionary<Guid, EquipmentFolder> folders, Guid? folderId)
    {
        var seen = 0;
        while (folderId is { } id && folders.TryGetValue(id, out var folder))
        {
            if (folder.Discipline is { } discipline)
            {
                return discipline;
            }

            // A cycle cannot be created through the API, but a walk up a tree should never be the thing that hangs.
            if (++seen > 64)
            {
                return null;
            }

            folderId = folder.ParentId;
        }

        return null;
    }

    /// <summary>Every folder that belongs to the trade, so a list can be filtered by one query.</summary>
    public static HashSet<Guid> FoldersOf(IReadOnlyCollection<EquipmentFolder> folders, EquipmentDiscipline discipline)
    {
        var byId = folders.ToDictionary(f => f.Id);
        return [.. folders.Where(f => Of(byId, f.Id) == discipline).Select(f => f.Id)];
    }
}
