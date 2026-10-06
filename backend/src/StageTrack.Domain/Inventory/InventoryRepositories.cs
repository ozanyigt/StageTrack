using StageTrack.Repositories;

namespace StageTrack.Inventory;

public class EquipmentFilter
{
    public string? Text { get; set; }
    public IReadOnlyCollection<Guid>? FolderIds { get; set; }
    public EquipmentType? Type { get; set; }
    public bool IsArchived { get; set; }
}

public interface IEquipmentRepository : IRepository<Equipment>
{
    Task<bool> CodeExistsAsync(string code, Guid? excludeId = null, CancellationToken cancellationToken = default);

    Task<List<Equipment>> GetPagedListAsync(EquipmentFilter filter, string? sorting, int skip, int take, CancellationToken cancellationToken = default);

    Task<long> GetCountAsync(EquipmentFilter filter, CancellationToken cancellationToken = default);

    /// <summary>Owned stock per equipment: device count for serialized items (repair/lost excluded), StockQuantity otherwise.</summary>
    Task<Dictionary<Guid, int>> GetStockQuantitiesAsync(IReadOnlyCollection<Guid> equipmentIds, CancellationToken cancellationToken = default);

    Task<List<Equipment>> SearchAsync(string? text, int take, CancellationToken cancellationToken = default);

    /// <summary>For each given equipment: the equipment whose default content (case) includes it.</summary>
    Task<Dictionary<Guid, List<(Guid Id, string Code, string Name)>>> GetContainersOfAsync(IReadOnlyCollection<Guid> equipmentIds,
        CancellationToken cancellationToken = default);

    Task<bool> AnyInFolderAsync(Guid folderId, CancellationToken cancellationToken = default);

    Task<Equipment?> FindByCodeAsync(string code, CancellationToken cancellationToken = default);

    /// <summary>Equipment that has <paramref name="equipmentId"/> as default content, with the quantity.</summary>
    Task<List<(Equipment Container, int Quantity)>> GetContainersAsync(Guid equipmentId, CancellationToken cancellationToken = default);

    /// <summary>Equipment (with relations) whose relation lists contain the given ids; used to show reverse links.</summary>
    Task<List<Equipment>> GetListWithRelationsAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken = default);
}

/// <summary>Device count per stock location and status, for the equipment "Stock" tab.</summary>
public record UnitStockRow(Guid? StockLocationId, UnitStatus Status, int Count);

public interface IEquipmentFolderRepository : IRepository<EquipmentFolder>
{
    Task<bool> HasChildrenAsync(Guid folderId, CancellationToken cancellationToken = default);

    Task<int> GetMaxSortOrderAsync(Guid? parentId, CancellationToken cancellationToken = default);

    /// <summary>Active equipment directly in each folder (sub-folders not included).</summary>
    Task<Dictionary<Guid, int>> GetEquipmentCountsAsync(CancellationToken cancellationToken = default);
}

public class EquipmentUnitFilter
{
    public string? Text { get; set; }
    public Guid? EquipmentId { get; set; }
    public UnitStatus? Status { get; set; }
    public Guid? StockLocationId { get; set; }
    public bool IncludeArchived { get; set; }
}

/// <summary>Read model for device lists: the device plus the names needed to display it.</summary>
public class EquipmentUnitListItem
{
    public required EquipmentUnit Unit { get; init; }
    public required string EquipmentCode { get; init; }
    public required string EquipmentName { get; init; }
    public string? StockLocationName { get; init; }
    public int? CurrentProjectNumber { get; init; }
    public string? CurrentProjectName { get; init; }
    public int LabelCount { get; init; }
    public string? SupplierName { get; init; }
    public int? InspectionIntervalMonths { get; init; }
}

public interface IEquipmentUnitRepository : IRepository<EquipmentUnit>
{
    /// <summary>Internal references are unique per equipment (TR-001 of a monitor and TR-001 of a converter may both exist).</summary>
    Task<bool> InternalRefExistsAsync(Guid equipmentId, string internalRef, Guid? excludeId = null, CancellationToken cancellationToken = default);

    /// <summary>Internal references of the equipment's devices (incl. archived), order not guaranteed.</summary>
    Task<List<string>> GetInternalRefsAsync(Guid equipmentId, CancellationToken cancellationToken = default);

    Task<List<EquipmentUnitListItem>> GetPagedListAsync(EquipmentUnitFilter filter, int skip, int take, CancellationToken cancellationToken = default);

    Task<long> GetCountAsync(EquipmentUnitFilter filter, CancellationToken cancellationToken = default);

    Task<EquipmentUnitListItem?> GetListItemAsync(Guid id, CancellationToken cancellationToken = default);

    Task<bool> AnyForEquipmentAsync(Guid equipmentId, CancellationToken cancellationToken = default);

    Task<bool> AnyInStockLocationAsync(Guid stockLocationId, CancellationToken cancellationToken = default);

    Task<int> CountOutOnProjectAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task<Dictionary<UnitStatus, int>> GetStatusCountsAsync(Guid? equipmentId = null, CancellationToken cancellationToken = default);

    /// <summary>Active devices whose periodic inspection (last inspection, else purchase date + interval) is before <paramref name="today"/>.</summary>
    Task<int> CountOverdueInspectionsAsync(DateTime today, CancellationToken cancellationToken = default);

    Task<List<EquipmentUnit>> GetListOutOnProjectAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task<List<UnitStockRow>> GetStockRowsAsync(Guid equipmentId, CancellationToken cancellationToken = default);

    Task<List<EquipmentUnit>> GetListByEquipmentAsync(Guid equipmentId, bool includeArchived, CancellationToken cancellationToken = default);

    Task<EquipmentUnit?> FindByInternalRefAsync(Guid equipmentId, string internalRef, CancellationToken cancellationToken = default);
}

/// <summary>Read model for a resolved label.</summary>
public class LabelTarget
{
    public required EquipmentLabel Label { get; init; }
    public required Equipment Equipment { get; init; }
    public EquipmentUnit? Unit { get; init; }
}

public interface IEquipmentLabelRepository : IRepository<EquipmentLabel>
{
    Task<LabelTarget?> FindTargetByCodeAsync(string code, CancellationToken cancellationToken = default);

    Task<List<EquipmentLabel>> GetListByEquipmentAsync(Guid equipmentId, CancellationToken cancellationToken = default);

    Task<List<EquipmentLabel>> GetListByUnitAsync(Guid unitId, CancellationToken cancellationToken = default);

    Task<List<string>> GetCodesByTypeAsync(LabelType type, CancellationToken cancellationToken = default);

    /// <summary>Labels of many devices at once, for printing.</summary>
    Task<List<EquipmentLabel>> GetListByUnitsAsync(IReadOnlyCollection<Guid> unitIds, CancellationToken cancellationToken = default);
}

public interface IStockLocationRepository : IRepository<StockLocation>
{
    Task<StockLocation?> FindFirstWarehouseAsync(CancellationToken cancellationToken = default);
}
