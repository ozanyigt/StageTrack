using StageTrack.Permissions;

namespace StageTrack.Identity;

public class RoleManager(IRoleRepository roleRepository)
{
    public async Task<AppRole> CreateAsync(string name, Guid? tenantId)
    {
        name = name.Trim();
        await EnsureNameIsUniqueAsync(tenantId, name, null);
        return new AppRole(Guid.CreateVersion7(), name, tenantId);
    }

    public async Task RenameAsync(AppRole role, string name)
    {
        EnsureNotStatic(role);
        name = name.Trim();
        await EnsureNameIsUniqueAsync(role.TenantId, name, role.Id);
        role.Rename(name);
    }

    /// <summary>
    /// Replaces the role's permissions. Every name must be defined, and a child permission
    /// (e.g. "Projects.Manage") requires its parent ("Projects") — same rule as ABP's permission tree.
    /// </summary>
    public void SetPermissions(AppRole role, IReadOnlyCollection<string> permissions)
    {
        EnsureNotStatic(role);
        var granted = permissions.Distinct().ToList();

        foreach (var name in granted)
        {
            var definition = StageTrackPermissions.Find(name)
                             ?? throw new BusinessException(StageTrackErrorCodes.PermissionUnknown).WithData("name", name);

            if (definition.Parent is not null && !granted.Contains(definition.Parent))
            {
                throw new BusinessException(StageTrackErrorCodes.PermissionParentRequired)
                    .WithData("name", name)
                    .WithData("parent", definition.Parent);
            }
        }

        role.SetPermissions(granted);
    }

    public async Task EnsureCanDeleteAsync(AppRole role)
    {
        EnsureNotStatic(role);
        var users = (await roleRepository.GetUserCountsAsync()).GetValueOrDefault(role.Id);
        if (users > 0)
        {
            throw new BusinessException(StageTrackErrorCodes.RoleInUse).WithData("count", users);
        }
    }

    private static void EnsureNotStatic(AppRole role)
    {
        if (role.IsStatic)
        {
            throw new BusinessException(StageTrackErrorCodes.RoleStaticCannotBeChanged);
        }
    }

    private async Task EnsureNameIsUniqueAsync(Guid? tenantId, string name, Guid? excludeId)
    {
        if (await roleRepository.NameExistsAsync(tenantId, name, excludeId))
        {
            throw new BusinessException(StageTrackErrorCodes.RoleNameAlreadyExists).WithData("name", name);
        }
    }
}
