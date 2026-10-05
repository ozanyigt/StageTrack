using Microsoft.EntityFrameworkCore;
using StageTrack.Companies;
using StageTrack.EntityFrameworkCore;
using StageTrack.Identity;
using StageTrack.Permissions;

namespace StageTrack.Repositories;

public class CompanyRepository(StageTrackDbContext dbContext) : EfRepository<Company>(dbContext), ICompanyRepository
{
    public Task<bool> CodeExistsAsync(Guid tenantId, string code, CancellationToken cancellationToken = default) =>
        DbSet.AnyAsync(c => c.TenantId == tenantId && c.Code == code, cancellationToken);

    public Task<List<Company>> GetListByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        DbSet.Where(c => c.TenantId == tenantId).OrderBy(c => c.Id).ToListAsync(cancellationToken);
}

public class TenantRepository(StageTrackDbContext dbContext) : EfRepository<Tenants.Tenant>(dbContext), Tenants.ITenantRepository
{
    public Task<bool> CodeExistsAsync(string code, Guid? excludeId = null, CancellationToken cancellationToken = default) =>
        DbSet.AnyAsync(t => t.Code == code && (excludeId == null || t.Id != excludeId), cancellationToken);

    public Task<List<Tenants.TenantListItem>> GetPagedListAsync(string? text, int skip, int take, CancellationToken cancellationToken = default) =>
        ApplyFilter(text)
            .OrderBy(t => t.Name)
            .Skip(skip)
            .Take(take)
            .Select(t => new Tenants.TenantListItem
            {
                Tenant = t,
                UserCount = DbContext.Users.Count(u => u.TenantId == t.Id),
                LocationCount = DbContext.Companies.Count(c => c.TenantId == t.Id)
            })
            .AsNoTracking()
            .ToListAsync(cancellationToken);

    public Task<long> GetCountAsync(string? text, CancellationToken cancellationToken = default) =>
        ApplyFilter(text).LongCountAsync(cancellationToken);

    public Task<int> GetUserCountAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        DbContext.Users.CountAsync(u => u.TenantId == tenantId, cancellationToken);

    public Task<int> GetLocationCountAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        DbContext.Companies.CountAsync(c => c.TenantId == tenantId, cancellationToken);

    private IQueryable<Tenants.Tenant> ApplyFilter(string? text)
    {
        var query = DbSet.AsQueryable();
        if (!string.IsNullOrWhiteSpace(text))
        {
            text = text.Trim();
            query = query.Where(t => t.Name.Contains(text) || t.Code.Contains(text) || (t.ContactName != null && t.ContactName.Contains(text)));
        }

        return query;
    }
}

public class UserRepository(StageTrackDbContext dbContext) : EfRepository<AppUser>(dbContext), IUserRepository
{
    protected override IQueryable<AppUser> WithDetails(IQueryable<AppUser> query) =>
        query.Include(u => u.Roles).Include(u => u.Companies);

    public Task<AppUser?> FindByUserNameAsync(string userName, CancellationToken cancellationToken = default)
    {
        var normalized = AppUser.Normalize(userName);
        return WithDetails(DbSet).FirstOrDefaultAsync(u => u.NormalizedUserName == normalized, cancellationToken);
    }

    public Task<bool> UserNameExistsAsync(string userName, Guid? excludeId = null, CancellationToken cancellationToken = default)
    {
        var normalized = AppUser.Normalize(userName);
        return DbSet.AnyAsync(u => u.NormalizedUserName == normalized && (excludeId == null || u.Id != excludeId), cancellationToken);
    }

    public async Task<List<string>> GetPermissionsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var roles = DbContext.Set<UserRole>().Where(ur => ur.UserId == userId).Select(ur => ur.RoleId);
        var staticRole = await DbContext.Roles
            .Where(r => r.IsStatic && roles.Contains(r.Id))
            .Select(r => new { r.TenantId })
            .FirstOrDefaultAsync(cancellationToken);
        if (staticRole is not null)
        {
            // Platform admin: platform permissions only; firm admin: every firm permission.
            return staticRole.TenantId is null ? StageTrackPermissions.Host.All.ToList() : StageTrackPermissions.GetAll().ToList();
        }

        return await DbContext.Set<RolePermission>()
            .Where(p => roles.Contains(p.RoleId))
            .Select(p => p.Name)
            .Distinct()
            .ToListAsync(cancellationToken);
    }

    public Task<List<string>> GetRoleNamesAsync(Guid userId, CancellationToken cancellationToken = default) =>
        (from userRole in DbContext.Set<UserRole>()
         where userRole.UserId == userId
         join role in DbContext.Roles on userRole.RoleId equals role.Id
         select role.Name)
        .ToListAsync(cancellationToken);

    public Task<List<UserListItem>> GetPagedListAsync(Guid companyId, string? text, int skip, int take, CancellationToken cancellationToken = default) =>
        ApplyFilter(companyId, text)
            .OrderBy(u => u.FullName)
            .Skip(skip)
            .Take(take)
            .Select(u => new UserListItem
            {
                User = u,
                RoleIds = u.Roles.Select(r => r.RoleId).ToList(),
                CompanyIds = u.Companies.Select(c => c.CompanyId).ToList()
            })
            .AsNoTracking()
            .ToListAsync(cancellationToken);

    public Task<long> GetCountAsync(Guid companyId, string? text, CancellationToken cancellationToken = default) =>
        ApplyFilter(companyId, text).LongCountAsync(cancellationToken);

    public async Task<List<(AppUser User, List<string> Roles)>> GetDirectoryAsync(Guid companyId, CancellationToken cancellationToken = default)
    {
        var rows = await DbSet
            .Where(u => u.IsActive && u.Companies.Any(c => c.CompanyId == companyId))
            .OrderBy(u => u.FullName)
            .Select(u => new
            {
                User = u,
                Roles = DbContext.Set<UserRole>().Where(ur => ur.UserId == u.Id)
                    .Join(DbContext.Roles, ur => ur.RoleId, r => r.Id, (_, r) => r.Name).ToList()
            })
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        return rows.Select(r => (r.User, r.Roles)).ToList();
    }

    public async Task<List<(AppUser User, List<string> Roles)>> GetListByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var rows = await DbSet
            .Where(u => u.TenantId == tenantId)
            .OrderBy(u => u.FullName)
            .Select(u => new
            {
                User = u,
                Roles = DbContext.Set<UserRole>().Where(ur => ur.UserId == u.Id)
                    .Join(DbContext.Roles, ur => ur.RoleId, r => r.Id, (_, r) => r.Name).ToList()
            })
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        return rows.Select(r => (r.User, r.Roles)).ToList();
    }

    private IQueryable<AppUser> ApplyFilter(Guid companyId, string? text)
    {
        var query = DbSet.Where(u => u.Companies.Any(c => c.CompanyId == companyId));
        if (!string.IsNullOrWhiteSpace(text))
        {
            text = text.Trim();
            query = query.Where(u => u.UserName.Contains(text) || u.FullName.Contains(text) || (u.Email != null && u.Email.Contains(text)));
        }

        return query;
    }
}

public class RoleRepository(StageTrackDbContext dbContext) : EfRepository<AppRole>(dbContext), IRoleRepository
{
    protected override IQueryable<AppRole> WithDetails(IQueryable<AppRole> query) => query.Include(r => r.Permissions);

    public Task<List<AppRole>> GetListAsync(Guid? tenantId, CancellationToken cancellationToken = default) =>
        WithDetails(DbSet).Where(r => r.TenantId == tenantId).OrderByDescending(r => r.IsStatic).ThenBy(r => r.Name).ToListAsync(cancellationToken);

    public Task<AppRole?> FindByNameAsync(Guid? tenantId, string name, CancellationToken cancellationToken = default) =>
        WithDetails(DbSet).FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Name == name, cancellationToken);

    public Task<bool> NameExistsAsync(Guid? tenantId, string name, Guid? excludeId = null, CancellationToken cancellationToken = default) =>
        DbSet.AnyAsync(r => r.TenantId == tenantId && r.Name == name && (excludeId == null || r.Id != excludeId), cancellationToken);

    public Task<Dictionary<Guid, int>> GetUserCountsAsync(CancellationToken cancellationToken = default) =>
        DbContext.Set<UserRole>()
            .GroupBy(ur => ur.RoleId)
            .Select(g => new { RoleId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RoleId, x => x.Count, cancellationToken);
}
