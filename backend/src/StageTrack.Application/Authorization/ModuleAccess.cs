using StageTrack.Identity;
using StageTrack.Permissions;
using StageTrack.Tenants;

namespace StageTrack.Authorization;

/// <summary>
/// An add-on module is sold to a firm, then handed out inside it with permissions. This is the first half:
/// permissions of a module the firm never bought are dropped before anything is checked, so one filter covers
/// the API, the menu and every button — a role granted "Led.Design" by mistake simply has no effect.
/// </summary>
public interface IModuleAccess
{
    Task<List<string>> FilterPermissionsAsync(AppUser user, IEnumerable<string> permissions);
}

public class ModuleAccess(ITenantRepository tenantRepository) : IModuleAccess
{
    /// <summary>Permissions under a prefix belong to a module and need it; everything else is always available.</summary>
    private static readonly (string Prefix, string Module)[] Gated =
    [
        (StageTrackPermissions.Led.Default, TenantModules.Led)
    ];

    public async Task<List<string>> FilterPermissionsAsync(AppUser user, IEnumerable<string> permissions)
    {
        var list = permissions.ToList();

        // The platform administrator has no firm, so no module can be missing for them.
        if (user.IsHost || user.TenantId is not { } tenantId)
        {
            return list;
        }

        var gated = Gated.Where(g => list.Any(p => IsUnder(p, g.Prefix))).ToList();
        if (gated.Count == 0)
        {
            return list;
        }

        var tenant = await tenantRepository.FindAsync(tenantId, includeDetails: false);
        var missing = gated.Where(g => tenant?.HasModule(g.Module) != true).Select(g => g.Prefix).ToList();
        return missing.Count == 0 ? list : list.Where(p => !missing.Any(prefix => IsUnder(p, prefix))).ToList();
    }

    private static bool IsUnder(string permission, string prefix) =>
        permission.Equals(prefix, StringComparison.Ordinal) || permission.StartsWith(prefix + ".", StringComparison.Ordinal);
}
