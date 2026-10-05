using StageTrack.Repositories;

namespace StageTrack.Identity;

/// <summary>Read model for the user list.</summary>
public class UserListItem
{
    public required AppUser User { get; init; }
    public required List<Guid> RoleIds { get; init; }
    public required List<Guid> CompanyIds { get; init; }
}

public interface IUserRepository : IRepository<AppUser>
{
    Task<AppUser?> FindByUserNameAsync(string userName, CancellationToken cancellationToken = default);

    Task<bool> UserNameExistsAsync(string userName, Guid? excludeId = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Granted permission names. A user in the built-in (static) admin role gets every defined permission,
    /// including ones added in later versions.
    /// </summary>
    Task<List<string>> GetPermissionsAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<List<string>> GetRoleNamesAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Users who have access to <paramref name="companyId"/>.</summary>
    Task<List<UserListItem>> GetPagedListAsync(Guid companyId, string? text, int skip, int take, CancellationToken cancellationToken = default);

    Task<long> GetCountAsync(Guid companyId, string? text, CancellationToken cancellationToken = default);

    /// <summary>Active users of the company with their role names, for the crew directory.</summary>
    Task<List<(AppUser User, List<string> Roles)>> GetDirectoryAsync(Guid companyId, CancellationToken cancellationToken = default);
}

public interface IRoleRepository : IRepository<AppRole>
{
    Task<AppRole?> FindByNameAsync(string name, CancellationToken cancellationToken = default);

    Task<bool> NameExistsAsync(string name, Guid? excludeId = null, CancellationToken cancellationToken = default);

    Task<Dictionary<Guid, int>> GetUserCountsAsync(CancellationToken cancellationToken = default);
}
