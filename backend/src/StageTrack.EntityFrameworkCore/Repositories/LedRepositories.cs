using Microsoft.EntityFrameworkCore;
using StageTrack.EntityFrameworkCore;
using StageTrack.Inventory;
using StageTrack.Led;

namespace StageTrack.Repositories;

public class EquipmentLedSpecRepository(StageTrackDbContext dbContext)
    : EfRepository<EquipmentLedSpec>(dbContext), IEquipmentLedSpecRepository
{
    public Task<EquipmentLedSpec?> FindByEquipmentAsync(Guid equipmentId, CancellationToken cancellationToken = default) =>
        DbSet.FirstOrDefaultAsync(s => s.EquipmentId == equipmentId, cancellationToken);

    public Task<List<EquipmentLedSpec>> GetListByEquipmentAsync(IReadOnlyCollection<Guid> equipmentIds, CancellationToken cancellationToken = default)
    {
        var ids = equipmentIds.Distinct().ToList();
        return DbSet.Where(s => ids.Contains(s.EquipmentId)).ToListAsync(cancellationToken);
    }

    public Task<List<LedItem<LedPanelSpec>>> GetPanelsAsync(LedCatalogFilter filter, CancellationToken cancellationToken = default) =>
        Join(DbSet.OfType<LedPanelSpec>().Where(s => filter.Group == null || s.Group == filter.Group), filter)
            .ToListAsync(cancellationToken);

    public Task<List<LedItem<LedProcessorSpec>>> GetProcessorsAsync(LedCatalogFilter filter, CancellationToken cancellationToken = default) =>
        Join(DbSet.OfType<LedProcessorSpec>(), filter).ToListAsync(cancellationToken);

    public Task<List<LedItem<LedExtenderSpec>>> GetExtendersAsync(LedCatalogFilter filter, CancellationToken cancellationToken = default) =>
        Join(DbSet.OfType<LedExtenderSpec>(), filter).ToListAsync(cancellationToken);

    public Task<List<LedItem<EquipmentLedSpec>>> GetItemsAsync(IReadOnlyCollection<Guid> equipmentIds, CancellationToken cancellationToken = default)
    {
        var ids = equipmentIds.Distinct().ToList();
        return (from spec in DbSet.Where(s => ids.Contains(s.EquipmentId))
                join equipment in DbContext.Equipment on spec.EquipmentId equals equipment.Id
                select new LedItem<EquipmentLedSpec>(equipment, spec))
            .ToListAsync(cancellationToken);
    }

    public async Task<Dictionary<Guid, List<Guid>>> GetCompatibleProcessorsAsync(IReadOnlyCollection<Guid> panelEquipmentIds,
        CancellationToken cancellationToken = default)
    {
        var ids = panelEquipmentIds.Distinct().ToList();
        var rows = await DbContext.Set<EquipmentRelation>()
            .Where(r => r.Kind == EquipmentRelationKind.CompatibleProcessor && ids.Contains(r.EquipmentId))
            .Select(r => new { r.EquipmentId, r.RelatedEquipmentId })
            .ToListAsync(cancellationToken);
        return rows.GroupBy(r => r.EquipmentId).ToDictionary(g => g.Key, g => g.Select(r => r.RelatedEquipmentId).ToList());
    }

    /// <summary>Specs with their equipment, filtered and ordered the same way for every role.</summary>
    private IQueryable<LedItem<TSpec>> Join<TSpec>(IQueryable<TSpec> specs, LedCatalogFilter filter) where TSpec : EquipmentLedSpec
    {
        var query = from spec in specs
                    join equipment in DbContext.Equipment on spec.EquipmentId equals equipment.Id
                    select new { spec, equipment };

        if (!filter.IncludeArchived)
        {
            query = query.Where(x => !x.equipment.IsArchived);
        }

        if (filter.FolderIds is { Count: > 0 })
        {
            var folderIds = filter.FolderIds.ToList();
            query = query.Where(x => x.equipment.FolderId != null && folderIds.Contains(x.equipment.FolderId.Value));
        }

        if (!string.IsNullOrWhiteSpace(filter.Text))
        {
            var text = filter.Text.Trim();
            query = query.Where(x => x.equipment.Code.Contains(text) || x.equipment.Name.Contains(text)
                                     || (x.equipment.Brand != null && x.equipment.Brand.Contains(text))
                                     || (x.equipment.Model != null && x.equipment.Model.Contains(text)));
        }

        return query.OrderBy(x => x.equipment.Code).Select(x => new LedItem<TSpec>(x.equipment, x.spec));
    }
}

public class LedStageSettingsRepository(StageTrackDbContext dbContext)
    : EfRepository<LedStageSettings>(dbContext), ILedStageSettingsRepository
{
    public Task<LedStageSettings?> FindForCompanyAsync(CancellationToken cancellationToken = default) =>
        DbSet.FirstOrDefaultAsync(cancellationToken);
}

public class LedTransportSettingsRepository(StageTrackDbContext dbContext)
    : EfRepository<LedTransportSettings>(dbContext), ILedTransportSettingsRepository
{
    public Task<LedTransportSettings?> FindForCompanyAsync(CancellationToken cancellationToken = default) =>
        DbSet.FirstOrDefaultAsync(cancellationToken);
}

public class LedTransportVehicleRepository(StageTrackDbContext dbContext)
    : EfRepository<LedTransportVehicle>(dbContext), ILedTransportVehicleRepository
{
    public Task<List<LedTransportVehicle>> GetListOrderedAsync(CancellationToken cancellationToken = default) =>
        DbSet.OrderBy(v => v.SortOrder).ThenBy(v => v.Name).ToListAsync(cancellationToken);

    public async Task<int> GetNextSortOrderAsync(CancellationToken cancellationToken = default) =>
        await DbSet.Select(v => (int?)v.SortOrder).MaxAsync(cancellationToken) + 1 ?? 1;
}

public class LedPanelFavoriteRepository(StageTrackDbContext dbContext)
    : EfRepository<LedPanelFavorite>(dbContext), ILedPanelFavoriteRepository
{
    public Task<List<Guid>> GetEquipmentIdsAsync(Guid userId, CancellationToken cancellationToken = default) =>
        DbSet.Where(f => f.UserId == userId).Select(f => f.EquipmentId).ToListAsync(cancellationToken);

    public Task<LedPanelFavorite?> FindAsync(Guid userId, Guid equipmentId, CancellationToken cancellationToken = default) =>
        DbSet.FirstOrDefaultAsync(f => f.UserId == userId && f.EquipmentId == equipmentId, cancellationToken);
}
