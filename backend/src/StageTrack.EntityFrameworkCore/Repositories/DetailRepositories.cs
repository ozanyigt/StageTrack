using Microsoft.EntityFrameworkCore;
using StageTrack.Collaboration;
using StageTrack.EntityFrameworkCore;
using StageTrack.Inventory;
using StageTrack.Maintenance;
using StageTrack.Suppliers;

namespace StageTrack.Repositories;

public class SupplierRepository(StageTrackDbContext dbContext) : EfRepository<Supplier>(dbContext), ISupplierRepository
{
    public Task<bool> NameExistsAsync(string name, Guid? excludeId = null, CancellationToken cancellationToken = default) =>
        DbSet.AnyAsync(s => s.Name == name && (excludeId == null || s.Id != excludeId), cancellationToken);

    public Task<List<Supplier>> GetPagedListAsync(string? text, int skip, int take, CancellationToken cancellationToken = default) =>
        ApplyFilter(text).OrderBy(s => s.Name).Skip(skip).Take(take).ToListAsync(cancellationToken);

    public Task<long> GetCountAsync(string? text, CancellationToken cancellationToken = default) =>
        ApplyFilter(text).LongCountAsync(cancellationToken);

    public async Task<bool> IsInUseAsync(Guid supplierId, CancellationToken cancellationToken = default) =>
        await DbContext.Set<EquipmentSupplier>().AnyAsync(s => s.SupplierId == supplierId, cancellationToken) ||
        await DbContext.EquipmentUnits.AnyAsync(u => u.SupplierId == supplierId, cancellationToken) ||
        await DbContext.Repairs.AnyAsync(r => r.SupplierId == supplierId, cancellationToken);

    private IQueryable<Supplier> ApplyFilter(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return DbSet;
        }

        text = text.Trim();
        return DbSet.Where(s => s.Name.Contains(text) || (s.ContactPerson != null && s.ContactPerson.Contains(text)) ||
                                (s.City != null && s.City.Contains(text)) || (s.TaxNumber != null && s.TaxNumber.Contains(text)));
    }
}

public class RepairRepository(StageTrackDbContext dbContext) : EfRepository<Repair>(dbContext), IRepairRepository
{
    public async Task<int> GetMaxNumberAsync(CancellationToken cancellationToken = default) =>
        await DbSet.MaxAsync(r => (int?)r.Number, cancellationToken) ?? 4000;

    public Task<List<RepairListItem>> GetPagedListAsync(RepairFilter filter, int skip, int take, CancellationToken cancellationToken = default) =>
        (from repair in ApplyFilter(filter)
         join equipment in DbContext.Equipment on repair.EquipmentId equals equipment.Id
         join unit in DbContext.EquipmentUnits on repair.UnitId equals unit.Id into units
         from unit in units.DefaultIfEmpty()
         join supplier in DbContext.Suppliers on repair.SupplierId equals supplier.Id into suppliers
         from supplier in suppliers.DefaultIfEmpty()
         orderby repair.Number descending
         select new RepairListItem
         {
             Repair = repair,
             EquipmentCode = equipment.Code,
             EquipmentName = equipment.Name,
             UnitInternalRef = unit != null ? unit.InternalRef : null,
             SupplierName = supplier != null ? supplier.Name : null
         })
        .Skip(skip)
        .Take(take)
        .AsNoTracking()
        .ToListAsync(cancellationToken);

    public Task<long> GetCountAsync(RepairFilter filter, CancellationToken cancellationToken = default) =>
        ApplyFilter(filter).LongCountAsync(cancellationToken);

    private IQueryable<Repair> ApplyFilter(RepairFilter filter)
    {
        IQueryable<Repair> query = DbSet;
        if (filter.EquipmentId.HasValue)
        {
            query = query.Where(r => r.EquipmentId == filter.EquipmentId);
        }

        if (filter.UnitId.HasValue)
        {
            query = query.Where(r => r.UnitId == filter.UnitId);
        }

        if (filter.Status.HasValue)
        {
            query = query.Where(r => r.Status == filter.Status);
        }

        if (filter.OnlyOpen)
        {
            query = query.Where(r => r.Status == RepairStatus.Open || r.Status == RepairStatus.InProgress);
        }

        if (!string.IsNullOrWhiteSpace(filter.Text))
        {
            var text = filter.Text.Trim();
            var isNumber = int.TryParse(text, out var number);
            query = query.Where(r => r.Title.Contains(text) || (isNumber && r.Number == number) ||
                                     DbContext.Equipment.Any(e => e.Id == r.EquipmentId && (e.Code.Contains(text) || e.Name.Contains(text))) ||
                                     DbContext.EquipmentUnits.Any(u => u.Id == r.UnitId && u.InternalRef.Contains(text)));
        }

        return query;
    }
}

public class UnitInspectionRepository(StageTrackDbContext dbContext) : EfRepository<UnitInspection>(dbContext), IUnitInspectionRepository
{
    public Task<List<InspectionListItem>> GetListAsync(Guid? equipmentId, Guid? unitId, int take, CancellationToken cancellationToken = default) =>
        (from inspection in DbSet
         where (equipmentId == null || inspection.EquipmentId == equipmentId) && (unitId == null || inspection.UnitId == unitId)
         join unit in DbContext.EquipmentUnits on inspection.UnitId equals unit.Id
         join user in DbContext.Users on inspection.CreatorId equals user.Id into users
         from user in users.DefaultIfEmpty()
         orderby inspection.Date descending
         select new InspectionListItem
         {
             Inspection = inspection,
             UnitInternalRef = unit.InternalRef,
             InspectorName = user != null ? user.FullName : null
         })
        .Take(take)
        .AsNoTracking()
        .ToListAsync(cancellationToken);
}

public class LabelTemplateRepository(StageTrackDbContext dbContext) : EfRepository<LabelTemplate>(dbContext), ILabelTemplateRepository
{
    public override Task<List<LabelTemplate>> GetListAsync(bool includeDetails = false, CancellationToken cancellationToken = default) =>
        DbSet.OrderByDescending(t => t.IsDefault).ThenBy(t => t.Name).ToListAsync(cancellationToken);

    public Task<LabelTemplate?> FindDefaultAsync(CancellationToken cancellationToken = default) =>
        DbSet.FirstOrDefaultAsync(t => t.IsDefault, cancellationToken);
}

public class AttachmentRepository(StageTrackDbContext dbContext) : EfRepository<Attachment>(dbContext), IAttachmentRepository
{
    public Task<List<AttachmentInfo>> GetInfoListAsync(OwnerType ownerType, Guid ownerId, CancellationToken cancellationToken = default) =>
        DbSet.Where(a => a.OwnerType == ownerType && a.OwnerId == ownerId)
            .OrderByDescending(a => a.CreationTime)
            .Select(a => new AttachmentInfo(a.Id, a.FileName, a.ContentType, a.Size, a.CreationTime, a.CreatorId))
            .ToListAsync(cancellationToken);
}

public class NoteRepository(StageTrackDbContext dbContext) : EfRepository<Note>(dbContext), INoteRepository
{
    public Task<List<Note>> GetListAsync(OwnerType ownerType, Guid ownerId, CancellationToken cancellationToken = default) =>
        DbSet.Where(n => n.OwnerType == ownerType && n.OwnerId == ownerId).OrderByDescending(n => n.CreationTime).ToListAsync(cancellationToken);
}

public class TaskItemRepository(StageTrackDbContext dbContext) : EfRepository<TaskItem>(dbContext), ITaskItemRepository
{
    public Task<List<TaskItem>> GetListAsync(OwnerType ownerType, Guid ownerId, CancellationToken cancellationToken = default) =>
        DbSet.Where(t => t.OwnerType == ownerType && t.OwnerId == ownerId)
            .OrderBy(t => t.IsCompleted).ThenBy(t => t.DueDate == null).ThenBy(t => t.DueDate).ThenByDescending(t => t.CreationTime)
            .ToListAsync(cancellationToken);
}
