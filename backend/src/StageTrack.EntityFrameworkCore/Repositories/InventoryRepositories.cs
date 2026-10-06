using Microsoft.EntityFrameworkCore;
using StageTrack.EntityFrameworkCore;
using StageTrack.Inventory;

namespace StageTrack.Repositories;

public class EquipmentRepository(StageTrackDbContext dbContext) : EfRepository<Equipment>(dbContext), IEquipmentRepository
{
    protected override IQueryable<Equipment> WithDetails(IQueryable<Equipment> query) =>
        query.Include(e => e.Relations).Include(e => e.Suppliers);

    public Task<Equipment?> FindByCodeAsync(string code, CancellationToken cancellationToken = default) =>
        WithDetails(DbSet).FirstOrDefaultAsync(e => e.Code == code, cancellationToken);

    public async Task<List<(Equipment Container, int Quantity)>> GetContainersAsync(Guid equipmentId, CancellationToken cancellationToken = default)
    {
        var rows = await (from relation in DbContext.Set<EquipmentRelation>()
                          where relation.RelatedEquipmentId == equipmentId && relation.Kind == EquipmentRelationKind.Content
                          join container in DbSet on relation.EquipmentId equals container.Id
                          select new { container, relation.Quantity })
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        return rows.Select(r => (r.container, r.Quantity)).ToList();
    }

    public Task<List<Equipment>> GetListWithRelationsAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken = default)
    {
        var idList = ids.Distinct().ToList();
        return DbSet.Include(e => e.Relations).Where(e => idList.Contains(e.Id)).ToListAsync(cancellationToken);
    }

    public Task<bool> CodeExistsAsync(string code, Guid? excludeId = null, CancellationToken cancellationToken = default) =>
        DbSet.AnyAsync(e => e.Code == code && (excludeId == null || e.Id != excludeId), cancellationToken);

    public Task<List<Equipment>> GetPagedListAsync(EquipmentFilter filter, string? sorting, int skip, int take, CancellationToken cancellationToken = default) =>
        Sort(ApplyFilter(DbSet, filter), sorting).Skip(skip).Take(take).ToListAsync(cancellationToken);

    public Task<long> GetCountAsync(EquipmentFilter filter, CancellationToken cancellationToken = default) =>
        ApplyFilter(DbSet, filter).LongCountAsync(cancellationToken);

    public async Task<Dictionary<Guid, int>> GetStockQuantitiesAsync(IReadOnlyCollection<Guid> equipmentIds, CancellationToken cancellationToken = default)
    {
        var ids = equipmentIds.Distinct().ToList();
        var equipment = await DbSet
            .Where(e => ids.Contains(e.Id))
            .Select(e => new { e.Id, e.IsSerialized, e.StockQuantity })
            .ToListAsync(cancellationToken);

        var unitCounts = await DbContext.EquipmentUnits
            .Where(u => ids.Contains(u.EquipmentId) && !u.IsArchived && (u.Status == UnitStatus.InStock || u.Status == UnitStatus.OnProject))
            .GroupBy(u => u.EquipmentId)
            .Select(g => new { EquipmentId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.EquipmentId, x => x.Count, cancellationToken);

        // Quantity-tracked equipment: pieces on an open repair cannot be rented out.
        var inRepair = await DbContext.Repairs
            .Where(r => ids.Contains(r.EquipmentId) && r.UnitId == null &&
                        (r.Status == Maintenance.RepairStatus.Open || r.Status == Maintenance.RepairStatus.InProgress))
            .GroupBy(r => r.EquipmentId)
            .Select(g => new { EquipmentId = g.Key, Quantity = g.Sum(r => r.Quantity) })
            .ToDictionaryAsync(x => x.EquipmentId, x => x.Quantity, cancellationToken);

        return equipment.ToDictionary(
            e => e.Id,
            e => e.IsSerialized ? unitCounts.GetValueOrDefault(e.Id) : Math.Max(0, e.StockQuantity - inRepair.GetValueOrDefault(e.Id)));
    }

    public async Task<Dictionary<Guid, List<(Guid Id, string Code, string Name)>>> GetContainersOfAsync(IReadOnlyCollection<Guid> equipmentIds,
        CancellationToken cancellationToken = default)
    {
        var ids = equipmentIds.Distinct().ToList();
        var rows = await (from relation in DbContext.Set<EquipmentRelation>()
                          where relation.Kind == EquipmentRelationKind.Content && ids.Contains(relation.RelatedEquipmentId)
                          join container in DbSet on relation.EquipmentId equals container.Id
                          where !container.IsArchived
                          orderby container.Code
                          select new { relation.RelatedEquipmentId, container.Id, container.Code, container.Name })
            .ToListAsync(cancellationToken);
        return rows.GroupBy(r => r.RelatedEquipmentId)
            .ToDictionary(g => g.Key, g => g.Select(r => (r.Id, r.Code, r.Name)).ToList());
    }

    public Task<List<Equipment>> SearchAsync(string? text, int take, CancellationToken cancellationToken = default) =>
        ApplyFilter(DbSet, new EquipmentFilter { Text = text })
            .OrderBy(e => e.Code)
            .Take(take)
            .ToListAsync(cancellationToken);

    public Task<bool> AnyInFolderAsync(Guid folderId, CancellationToken cancellationToken = default) =>
        DbSet.AnyAsync(e => e.FolderId == folderId, cancellationToken);

    private static IQueryable<Equipment> ApplyFilter(IQueryable<Equipment> query, EquipmentFilter filter)
    {
        query = query.Where(e => e.IsArchived == filter.IsArchived);

        if (!string.IsNullOrWhiteSpace(filter.Text))
        {
            var text = filter.Text.Trim();
            query = query.Where(e => e.Code.Contains(text) || e.Name.Contains(text) ||
                                     (e.Brand != null && e.Brand.Contains(text)) || (e.Model != null && e.Model.Contains(text)));
        }

        if (filter.FolderIds is { Count: > 0 })
        {
            var folderIds = filter.FolderIds.ToList();
            query = query.Where(e => e.FolderId != null && folderIds.Contains(e.FolderId.Value));
        }

        if (filter.Type.HasValue)
        {
            query = query.Where(e => e.Type == filter.Type);
        }

        return query;
    }

    private static IQueryable<Equipment> Sort(IQueryable<Equipment> query, string? sorting) =>
        sorting?.ToLowerInvariant() switch
        {
            "name" => query.OrderBy(e => e.Name),
            "name desc" => query.OrderByDescending(e => e.Name),
            "rentalprice" => query.OrderBy(e => e.RentalPrice),
            "rentalprice desc" => query.OrderByDescending(e => e.RentalPrice),
            "code desc" => query.OrderByDescending(e => e.Code),
            _ => query.OrderBy(e => e.Code)
        };
}

public class EquipmentFolderRepository(StageTrackDbContext dbContext) : EfRepository<EquipmentFolder>(dbContext), IEquipmentFolderRepository
{
    public override Task<List<EquipmentFolder>> GetListAsync(bool includeDetails = false, CancellationToken cancellationToken = default) =>
        DbSet.OrderBy(f => f.SortOrder).ThenBy(f => f.Name).ToListAsync(cancellationToken);

    public Task<bool> HasChildrenAsync(Guid folderId, CancellationToken cancellationToken = default) =>
        DbSet.AnyAsync(f => f.ParentId == folderId, cancellationToken);

    public async Task<int> GetMaxSortOrderAsync(Guid? parentId, CancellationToken cancellationToken = default) =>
        await DbSet.Where(f => f.ParentId == parentId).MaxAsync(f => (int?)f.SortOrder, cancellationToken) ?? 0;

    public Task<Dictionary<Guid, int>> GetEquipmentCountsAsync(CancellationToken cancellationToken = default) =>
        DbContext.Equipment
            .Where(e => !e.IsArchived && e.FolderId != null)
            .GroupBy(e => e.FolderId!.Value)
            .Select(g => new { FolderId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.FolderId, x => x.Count, cancellationToken);
}

public class EquipmentUnitRepository(StageTrackDbContext dbContext) : EfRepository<EquipmentUnit>(dbContext), IEquipmentUnitRepository
{
    public Task<bool> InternalRefExistsAsync(Guid equipmentId, string internalRef, Guid? excludeId = null, CancellationToken cancellationToken = default) =>
        DbSet.AnyAsync(u => u.EquipmentId == equipmentId && u.InternalRef == internalRef && (excludeId == null || u.Id != excludeId), cancellationToken);

    public Task<List<string>> GetInternalRefsAsync(Guid equipmentId, CancellationToken cancellationToken = default) =>
        DbSet.Where(u => u.EquipmentId == equipmentId).OrderBy(u => u.Id).Select(u => u.InternalRef).ToListAsync(cancellationToken);

    public Task<List<EquipmentUnitListItem>> GetPagedListAsync(EquipmentUnitFilter filter, int skip, int take, CancellationToken cancellationToken = default) =>
        ToListItems(ApplyFilter(DbSet, filter))
            .OrderBy(x => x.EquipmentCode).ThenBy(x => x.Unit.InternalRef)
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);

    public Task<EquipmentUnitListItem?> GetListItemAsync(Guid id, CancellationToken cancellationToken = default) =>
        ToListItems(DbSet.Where(u => u.Id == id)).FirstOrDefaultAsync(cancellationToken);

    private IQueryable<EquipmentUnitListItem> ToListItems(IQueryable<EquipmentUnit> units) =>
        (from unit in units
         join equipment in DbContext.Equipment on unit.EquipmentId equals equipment.Id
         join location in DbContext.StockLocations on unit.StockLocationId equals location.Id into locations
         from location in locations.DefaultIfEmpty()
         join project in DbContext.Projects on unit.CurrentProjectId equals project.Id into projects
         from project in projects.DefaultIfEmpty()
         join supplier in DbContext.Suppliers on unit.SupplierId equals supplier.Id into suppliers
         from supplier in suppliers.DefaultIfEmpty()
         select new EquipmentUnitListItem
         {
             Unit = unit,
             EquipmentCode = equipment.Code,
             EquipmentName = equipment.Name,
             StockLocationName = location != null ? location.Name : null,
             CurrentProjectNumber = project != null ? project.Number : null,
             CurrentProjectName = project != null ? project.Name : null,
             LabelCount = DbContext.EquipmentLabels.Count(l => l.UnitId == unit.Id),
             SupplierName = supplier != null ? supplier.Name : null,
             InspectionIntervalMonths = equipment.InspectionIntervalMonths
         })
        .AsNoTracking();

    public Task<long> GetCountAsync(EquipmentUnitFilter filter, CancellationToken cancellationToken = default) =>
        ApplyFilter(DbSet, filter).LongCountAsync(cancellationToken);

    public Task<bool> AnyForEquipmentAsync(Guid equipmentId, CancellationToken cancellationToken = default) =>
        DbSet.AnyAsync(u => u.EquipmentId == equipmentId, cancellationToken);

    public Task<bool> AnyInStockLocationAsync(Guid stockLocationId, CancellationToken cancellationToken = default) =>
        DbSet.AnyAsync(u => u.StockLocationId == stockLocationId && !u.IsArchived, cancellationToken);

    public Task<int> CountOutOnProjectAsync(Guid projectId, CancellationToken cancellationToken = default) =>
        DbSet.CountAsync(u => u.CurrentProjectId == projectId, cancellationToken);

    public Task<Dictionary<UnitStatus, int>> GetStatusCountsAsync(Guid? equipmentId = null, CancellationToken cancellationToken = default) =>
        DbSet.Where(u => !u.IsArchived && (equipmentId == null || u.EquipmentId == equipmentId))
            .GroupBy(u => u.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count, cancellationToken);

    public Task<int> CountOverdueInspectionsAsync(DateTime today, CancellationToken cancellationToken = default) =>
        (from unit in DbSet
         join equipment in DbContext.Equipment on unit.EquipmentId equals equipment.Id
         where !unit.IsArchived && equipment.InspectionIntervalMonths != null &&
               (unit.LastInspectionDate ?? unit.PurchaseDate) != null &&
               (unit.LastInspectionDate ?? unit.PurchaseDate)!.Value.AddMonths(equipment.InspectionIntervalMonths.Value) < today
         select unit.Id).CountAsync(cancellationToken);

    public Task<List<EquipmentUnit>> GetListOutOnProjectAsync(Guid projectId, CancellationToken cancellationToken = default) =>
        DbSet.Where(u => u.CurrentProjectId == projectId).OrderBy(u => u.InternalRef).ToListAsync(cancellationToken);

    public async Task<List<UnitStockRow>> GetStockRowsAsync(Guid equipmentId, CancellationToken cancellationToken = default)
    {
        var rows = await DbSet
            .Where(u => u.EquipmentId == equipmentId && !u.IsArchived)
            .GroupBy(u => new { u.StockLocationId, u.Status })
            .Select(g => new { g.Key.StockLocationId, g.Key.Status, Count = g.Count() })
            .ToListAsync(cancellationToken);
        return rows.Select(r => new UnitStockRow(r.StockLocationId, r.Status, r.Count)).ToList();
    }

    public Task<List<EquipmentUnit>> GetListByEquipmentAsync(Guid equipmentId, bool includeArchived, CancellationToken cancellationToken = default) =>
        DbSet.Where(u => u.EquipmentId == equipmentId && (includeArchived || !u.IsArchived)).OrderBy(u => u.InternalRef).ToListAsync(cancellationToken);

    public Task<EquipmentUnit?> FindByInternalRefAsync(Guid equipmentId, string internalRef, CancellationToken cancellationToken = default) =>
        DbSet.FirstOrDefaultAsync(u => u.EquipmentId == equipmentId && u.InternalRef == internalRef, cancellationToken);

    private IQueryable<EquipmentUnit> ApplyFilter(IQueryable<EquipmentUnit> query, EquipmentUnitFilter filter)
    {
        if (!filter.IncludeArchived)
        {
            query = query.Where(u => !u.IsArchived);
        }

        if (filter.EquipmentId.HasValue)
        {
            query = query.Where(u => u.EquipmentId == filter.EquipmentId);
        }

        if (filter.Status.HasValue)
        {
            query = query.Where(u => u.Status == filter.Status);
        }

        if (filter.StockLocationId.HasValue)
        {
            query = query.Where(u => u.StockLocationId == filter.StockLocationId);
        }

        if (!string.IsNullOrWhiteSpace(filter.Text))
        {
            var text = filter.Text.Trim();
            query = query.Where(u =>
                u.InternalRef.Contains(text) ||
                (u.SerialNumber != null && u.SerialNumber.Contains(text)) ||
                DbContext.Equipment.Any(e => e.Id == u.EquipmentId && (e.Code.Contains(text) || e.Name.Contains(text))) ||
                DbContext.EquipmentLabels.Any(l => l.UnitId == u.Id && l.Code.Contains(text)));
        }

        return query;
    }
}

public class EquipmentLabelRepository(StageTrackDbContext dbContext) : EfRepository<EquipmentLabel>(dbContext), IEquipmentLabelRepository
{
    public async Task<LabelTarget?> FindTargetByCodeAsync(string code, CancellationToken cancellationToken = default)
    {
        var row = await (
                from label in DbSet
                where label.Code == code
                join equipment in DbContext.Equipment on label.EquipmentId equals equipment.Id
                join unit in DbContext.EquipmentUnits on label.UnitId equals unit.Id into units
                from unit in units.DefaultIfEmpty()
                select new { label, equipment, unit })
            .FirstOrDefaultAsync(cancellationToken);

        return row is null ? null : new LabelTarget { Label = row.label, Equipment = row.equipment, Unit = row.unit };
    }

    public Task<List<EquipmentLabel>> GetListByEquipmentAsync(Guid equipmentId, CancellationToken cancellationToken = default) =>
        DbSet.Where(l => l.EquipmentId == equipmentId).OrderBy(l => l.Code).ToListAsync(cancellationToken);

    public Task<List<EquipmentLabel>> GetListByUnitAsync(Guid unitId, CancellationToken cancellationToken = default) =>
        DbSet.Where(l => l.UnitId == unitId).OrderBy(l => l.Code).ToListAsync(cancellationToken);

    public Task<List<string>> GetCodesByTypeAsync(LabelType type, CancellationToken cancellationToken = default) =>
        DbSet.IgnoreQueryFilters().Where(l => l.Type == type).Select(l => l.Code).ToListAsync(cancellationToken);

    public Task<List<EquipmentLabel>> GetListByUnitsAsync(IReadOnlyCollection<Guid> unitIds, CancellationToken cancellationToken = default)
    {
        var ids = unitIds.Distinct().ToList();
        return DbSet.Where(l => l.UnitId != null && ids.Contains(l.UnitId.Value)).OrderBy(l => l.CreationTime).ToListAsync(cancellationToken);
    }
}

public class StockLocationRepository(StageTrackDbContext dbContext) : EfRepository<StockLocation>(dbContext), IStockLocationRepository
{
    public override Task<List<StockLocation>> GetListAsync(bool includeDetails = false, CancellationToken cancellationToken = default) =>
        DbSet.OrderBy(l => l.Name).ToListAsync(cancellationToken);

    public Task<StockLocation?> FindFirstWarehouseAsync(CancellationToken cancellationToken = default) =>
        DbSet.Where(l => l.IsActive && l.Type == StockLocationType.Warehouse).OrderBy(l => l.CreationTime).FirstOrDefaultAsync(cancellationToken);
}
