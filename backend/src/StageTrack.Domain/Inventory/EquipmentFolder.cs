using StageTrack.Entities;

namespace StageTrack.Inventory;

/// <summary>Folder tree used to group equipment (Audio / Light / Video &gt; Display ...).</summary>
public class EquipmentFolder : CompanyAggregateRoot
{
    public string Name { get; private set; } = null!;
    public Guid? ParentId { get; private set; }
    public int SortOrder { get; private set; }

    private EquipmentFolder()
    {
    }

    internal EquipmentFolder(Guid id, string name, Guid? parentId, int sortOrder) : base(id)
    {
        Name = name;
        ParentId = parentId;
        SortOrder = sortOrder;
    }

    public void Rename(string name) => Name = name;

    public void SetSortOrder(int sortOrder) => SortOrder = sortOrder;

    internal void SetParent(Guid? parentId) => ParentId = parentId;
}
