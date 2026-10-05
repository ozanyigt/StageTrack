using Microsoft.EntityFrameworkCore;
using StageTrack.Customers;
using StageTrack.EntityFrameworkCore;
using StageTrack.Pricing;
using StageTrack.Projects;
using StageTrack.Quotes;
using StageTrack.Warehouse;

namespace StageTrack.Repositories;

public class CustomerRepository(StageTrackDbContext dbContext) : EfRepository<Customer>(dbContext), ICustomerRepository
{
    public Task<bool> TaxNumberExistsAsync(string taxNumber, Guid? excludeId = null, CancellationToken cancellationToken = default) =>
        DbSet.AnyAsync(c => c.TaxNumber == taxNumber && (excludeId == null || c.Id != excludeId), cancellationToken);

    public Task<List<Customer>> GetPagedListAsync(string? text, string? sorting, int skip, int take, CancellationToken cancellationToken = default)
    {
        var query = ApplyFilter(text);
        query = sorting?.ToLowerInvariant() switch
        {
            "name desc" => query.OrderByDescending(c => c.Name),
            "city" => query.OrderBy(c => c.City).ThenBy(c => c.Name),
            _ => query.OrderBy(c => c.Name)
        };

        return query.Skip(skip).Take(take).ToListAsync(cancellationToken);
    }

    public Task<long> GetCountAsync(string? text, CancellationToken cancellationToken = default) =>
        ApplyFilter(text).LongCountAsync(cancellationToken);

    public Task<Customer?> FindByTaxNumberAsync(string taxNumber, CancellationToken cancellationToken = default) =>
        DbSet.FirstOrDefaultAsync(c => c.TaxNumber == taxNumber, cancellationToken);

    public Task<Customer?> FindByNameAsync(string name, CancellationToken cancellationToken = default) =>
        DbSet.FirstOrDefaultAsync(c => c.Name == name, cancellationToken);

    private IQueryable<Customer> ApplyFilter(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return DbSet;
        }

        text = text.Trim();
        return DbSet.Where(c => c.Name.Contains(text) || (c.TaxNumber != null && c.TaxNumber.Contains(text)) ||
                                (c.City != null && c.City.Contains(text)) || (c.ContactPerson != null && c.ContactPerson.Contains(text)));
    }
}

public class ProjectRepository(StageTrackDbContext dbContext) : EfRepository<Project>(dbContext), IProjectRepository
{
    protected override IQueryable<Project> WithDetails(IQueryable<Project> query) =>
        query.Include(p => p.Equipment).Include(p => p.Sections).Include(p => p.Crew).AsSplitQuery();

    public async Task<int> GetMaxNumberAsync(CancellationToken cancellationToken = default) =>
        await DbSet.MaxAsync(p => (int?)p.Number, cancellationToken) ?? 0;

    public Task<List<ProjectListItem>> GetPagedListAsync(ProjectFilter filter, string? sorting, int skip, int take, CancellationToken cancellationToken = default)
    {
        var query =
            from project in ApplyFilter(DbSet, filter)
            join customer in DbContext.Customers on project.CustomerId equals customer.Id into customers
            from customer in customers.DefaultIfEmpty()
            join location in DbContext.StockLocations on project.StockLocationId equals location.Id into locations
            from location in locations.DefaultIfEmpty()
            select new { project, customer, location };

        query = sorting?.ToLowerInvariant() switch
        {
            "number" => query.OrderBy(x => x.project.Number),
            "number desc" => query.OrderByDescending(x => x.project.Number),
            "name" => query.OrderBy(x => x.project.Name),
            "planstart desc" => query.OrderByDescending(x => x.project.PlanStart),
            _ => query.OrderBy(x => x.project.PlanStart).ThenBy(x => x.project.Number)
        };

        return query
            .Skip(skip)
            .Take(take)
            .Select(x => new ProjectListItem
            {
                Project = x.project,
                CustomerName = x.customer != null ? x.customer.Name : null,
                StockLocationName = x.location != null ? x.location.Name : null,
                PlannedQuantity = x.project.Equipment.Sum(e => e.Quantity)
            })
            .AsNoTracking()
            .ToListAsync(cancellationToken);
    }

    public Task<long> GetCountAsync(ProjectFilter filter, CancellationToken cancellationToken = default) =>
        ApplyFilter(DbSet, filter).LongCountAsync(cancellationToken);

    public Task<bool> IsEquipmentPlannedOnActiveProjectsAsync(Guid equipmentId, CancellationToken cancellationToken = default)
    {
        var reserving = ProjectStatusRules.Reserving.ToList();
        return DbSet.AnyAsync(p => reserving.Contains(p.Status) && p.Equipment.Any(e => e.EquipmentId == equipmentId), cancellationToken);
    }

    public Task<bool> AnyForCustomerAsync(Guid customerId, CancellationToken cancellationToken = default) =>
        DbSet.AnyAsync(p => p.CustomerId == customerId, cancellationToken);

    public Task<Dictionary<ProjectStatus, int>> GetStatusCountsAsync(CancellationToken cancellationToken = default) =>
        DbSet.GroupBy(p => p.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count, cancellationToken);

    public Task<List<EquipmentReservation>> GetReservationsAsync(IReadOnlyCollection<Guid> equipmentIds, DateTime start, DateTime end,
        Guid? excludeProjectId, CancellationToken cancellationToken = default)
    {
        var ids = equipmentIds.Distinct().ToList();
        var reserving = ProjectStatusRules.Reserving.ToList();

        return (from project in DbSet
                where reserving.Contains(project.Status)
                      && project.PlanStart <= end && project.PlanEnd >= start
                      && (excludeProjectId == null || project.Id != excludeProjectId)
                from line in project.Equipment
                where ids.Contains(line.EquipmentId)
                select new EquipmentReservation(line.EquipmentId, line.Quantity, project.PlanStart, project.PlanEnd))
            .ToListAsync(cancellationToken);
    }

    private static IQueryable<Project> ApplyFilter(IQueryable<Project> query, ProjectFilter filter)
    {
        if (!string.IsNullOrWhiteSpace(filter.Text))
        {
            var text = filter.Text.Trim();
            var isNumber = int.TryParse(text, out var number);
            query = query.Where(p => p.Name.Contains(text) || (p.Venue != null && p.Venue.Contains(text)) || (isNumber && p.Number == number));
        }

        if (filter.Statuses is { Count: > 0 })
        {
            var statuses = filter.Statuses.ToList();
            query = query.Where(p => statuses.Contains(p.Status));
        }

        if (filter.From.HasValue)
        {
            query = query.Where(p => p.PlanEnd >= filter.From);
        }

        if (filter.To.HasValue)
        {
            query = query.Where(p => p.PlanStart <= filter.To);
        }

        if (filter.CustomerId.HasValue)
        {
            query = query.Where(p => p.CustomerId == filter.CustomerId);
        }

        if (filter.StockLocationId.HasValue)
        {
            query = query.Where(p => p.StockLocationId == filter.StockLocationId);
        }

        if (filter.CrewUserId.HasValue)
        {
            query = query.Where(p => p.Crew.Any(c => c.UserId == filter.CrewUserId));
        }

        return query;
    }
}

public class WarehouseMovementRepository(StageTrackDbContext dbContext) : EfRepository<WarehouseMovement>(dbContext), IWarehouseMovementRepository
{
    public async Task<List<ProjectEquipmentBalance>> GetBalancesAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        var rows = await DbSet
            .Where(m => m.ProjectId == projectId && (m.Action == MovementAction.CheckOut || m.Action == MovementAction.CheckIn))
            .GroupBy(m => m.EquipmentId)
            .Select(g => new
            {
                EquipmentId = g.Key,
                Out = g.Sum(m => m.Action == MovementAction.CheckOut ? m.Quantity : 0),
                In = g.Sum(m => m.Action == MovementAction.CheckIn ? m.Quantity : 0)
            })
            .ToListAsync(cancellationToken);

        return rows.Select(r => new ProjectEquipmentBalance(r.EquipmentId, r.Out, r.In)).ToList();
    }

    public Task<List<MovementListItem>> GetPagedListAsync(MovementFilter filter, int skip, int take, CancellationToken cancellationToken = default) =>
        (from movement in ApplyFilter(filter)
         join equipment in DbContext.Equipment on movement.EquipmentId equals equipment.Id
         join unit in DbContext.EquipmentUnits on movement.UnitId equals unit.Id into units
         from unit in units.DefaultIfEmpty()
         join project in DbContext.Projects on movement.ProjectId equals project.Id into projects
         from project in projects.DefaultIfEmpty()
         join user in DbContext.Users on movement.UserId equals user.Id into users
         from user in users.DefaultIfEmpty()
         orderby movement.CreationTime descending
         select new MovementListItem
         {
             Movement = movement,
             EquipmentCode = equipment.Code,
             EquipmentName = equipment.Name,
             UnitInternalRef = unit != null ? unit.InternalRef : null,
             UnitSerialNumber = unit != null ? unit.SerialNumber : null,
             ProjectNumber = project != null ? project.Number : null,
             ProjectName = project != null ? project.Name : null,
             UserFullName = user != null ? user.FullName : null
         })
        .Skip(skip)
        .Take(take)
        .AsNoTracking()
        .ToListAsync(cancellationToken);

    public Task<long> GetCountAsync(MovementFilter filter, CancellationToken cancellationToken = default) =>
        ApplyFilter(filter).LongCountAsync(cancellationToken);

    private IQueryable<WarehouseMovement> ApplyFilter(MovementFilter filter)
    {
        IQueryable<WarehouseMovement> query = DbSet;

        if (filter.ProjectId.HasValue)
        {
            query = query.Where(m => m.ProjectId == filter.ProjectId);
        }

        if (filter.EquipmentId.HasValue)
        {
            query = query.Where(m => m.EquipmentId == filter.EquipmentId);
        }

        if (filter.UnitId.HasValue)
        {
            query = query.Where(m => m.UnitId == filter.UnitId);
        }

        if (filter.Action.HasValue)
        {
            query = query.Where(m => m.Action == filter.Action);
        }

        if (filter.From.HasValue)
        {
            query = query.Where(m => m.CreationTime >= filter.From);
        }

        if (filter.To.HasValue)
        {
            query = query.Where(m => m.CreationTime <= filter.To);
        }

        if (!string.IsNullOrWhiteSpace(filter.Text))
        {
            var text = filter.Text.Trim();
            query = query.Where(m =>
                (m.LabelCode != null && m.LabelCode.Contains(text)) ||
                DbContext.Equipment.Any(e => e.Id == m.EquipmentId && (e.Code.Contains(text) || e.Name.Contains(text))) ||
                DbContext.EquipmentUnits.Any(u => u.Id == m.UnitId && u.InternalRef.Contains(text)));
        }

        return query;
    }
}

public class RentalFactorProfileRepository(StageTrackDbContext dbContext) : EfRepository<RentalFactorProfile>(dbContext), IRentalFactorProfileRepository
{
    protected override IQueryable<RentalFactorProfile> WithDetails(IQueryable<RentalFactorProfile> query) => query.Include(p => p.Steps);

    public override Task<List<RentalFactorProfile>> GetListAsync(bool includeDetails = false, CancellationToken cancellationToken = default) =>
        Query(includeDetails).OrderByDescending(p => p.IsDefault).ThenBy(p => p.Name).ToListAsync(cancellationToken);

    public Task<RentalFactorProfile?> FindDefaultAsync(CancellationToken cancellationToken = default) =>
        WithDetails(DbSet).FirstOrDefaultAsync(p => p.IsDefault, cancellationToken);
}

public class QuoteRepository(StageTrackDbContext dbContext) : EfRepository<Quote>(dbContext), IQuoteRepository
{
    protected override IQueryable<Quote> WithDetails(IQueryable<Quote> query) => query.Include(q => q.Lines);

    public async Task<int> GetLastSequenceForYearAsync(int year, CancellationToken cancellationToken = default)
    {
        var prefix = $"TKL-{year}-";
        var numbers = await DbSet
            .Where(q => q.Number.StartsWith(prefix))
            .Select(q => q.Number)
            .Distinct()
            .ToListAsync(cancellationToken);

        return numbers
            .Select(n => int.TryParse(n[prefix.Length..], out var sequence) ? sequence : 0)
            .DefaultIfEmpty(0)
            .Max();
    }

    public Task<List<QuoteListItem>> GetPagedListAsync(QuoteFilter filter, int skip, int take, CancellationToken cancellationToken = default) =>
        (from quote in ApplyFilter(filter)
         join project in DbContext.Projects on quote.ProjectId equals project.Id
         join customer in DbContext.Customers on project.CustomerId equals customer.Id into customers
         from customer in customers.DefaultIfEmpty()
         orderby quote.IssueDate descending, quote.Number descending, quote.Revision descending
         select new QuoteListItem
         {
             Quote = quote,
             ProjectNumber = project.Number,
             ProjectName = project.Name,
             CustomerName = customer != null ? customer.Name : null
         })
        .Skip(skip)
        .Take(take)
        .AsNoTracking()
        .ToListAsync(cancellationToken);

    public Task<long> GetCountAsync(QuoteFilter filter, CancellationToken cancellationToken = default) =>
        ApplyFilter(filter).LongCountAsync(cancellationToken);

    public Task<List<Quote>> GetListByProjectAsync(Guid projectId, CancellationToken cancellationToken = default) =>
        DbSet.Where(q => q.ProjectId == projectId).ToListAsync(cancellationToken);

    public Task<List<QuoteListItem>> GetListByProjectIdsAsync(IReadOnlyCollection<Guid> projectIds, CancellationToken cancellationToken = default) =>
        (from quote in DbSet.Where(q => projectIds.Contains(q.ProjectId))
         join project in DbContext.Projects on quote.ProjectId equals project.Id
         join customer in DbContext.Customers on project.CustomerId equals customer.Id into customers
         from customer in customers.DefaultIfEmpty()
         orderby quote.Number descending, quote.Revision descending
         select new QuoteListItem
         {
             Quote = quote,
             ProjectNumber = project.Number,
             ProjectName = project.Name,
             CustomerName = customer != null ? customer.Name : null
         })
        .AsNoTracking()
        .ToListAsync(cancellationToken);

    private IQueryable<Quote> ApplyFilter(QuoteFilter filter)
    {
        IQueryable<Quote> query = DbSet;

        if (filter.ProjectId.HasValue)
        {
            query = query.Where(q => q.ProjectId == filter.ProjectId);
        }

        if (filter.Status.HasValue)
        {
            query = query.Where(q => q.Status == filter.Status);
        }

        if (!string.IsNullOrWhiteSpace(filter.Text))
        {
            var text = filter.Text.Trim();
            query = query.Where(q => q.Number.Contains(text) ||
                                     DbContext.Projects.Any(p => p.Id == q.ProjectId && p.Name.Contains(text)));
        }

        return query;
    }
}
