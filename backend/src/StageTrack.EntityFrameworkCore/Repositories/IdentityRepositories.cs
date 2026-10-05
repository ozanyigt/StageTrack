using Microsoft.EntityFrameworkCore;
using StageTrack.Companies;
using StageTrack.EntityFrameworkCore;
using StageTrack.Identity;
using StageTrack.Permissions;

namespace StageTrack.Repositories;

public class CompanyRepository(StageTrackDbContext dbContext) : EfRepository<Company>(dbContext), ICompanyRepository;

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

        if (await DbContext.Roles.AnyAsync(r => r.IsStatic && roles.Contains(r.Id), cancellationToken))
        {
            return StageTrackPermissions.GetAll().ToList();
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

    public override Task<List<AppRole>> GetListAsync(bool includeDetails = false, CancellationToken cancellationToken = default) =>
        Query(includeDetails).OrderByDescending(r => r.IsStatic).ThenBy(r => r.Name).ToListAsync(cancellationToken);

    public Task<AppRole?> FindByNameAsync(string name, CancellationToken cancellationToken = default) =>
        WithDetails(DbSet).FirstOrDefaultAsync(r => r.Name == name, cancellationToken);

    public Task<bool> NameExistsAsync(string name, Guid? excludeId = null, CancellationToken cancellationToken = default) =>
        DbSet.AnyAsync(r => r.Name == name && (excludeId == null || r.Id != excludeId), cancellationToken);

    public Task<Dictionary<Guid, int>> GetUserCountsAsync(CancellationToken cancellationToken = default) =>
        DbContext.Set<UserRole>()
            .GroupBy(ur => ur.RoleId)
            .Select(g => new { RoleId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RoleId, x => x.Count, cancellationToken);
}
