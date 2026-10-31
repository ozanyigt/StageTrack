using StageTrack.Identity;
using StageTrack.Session;

namespace StageTrack.Authorization;

public interface IPermissionChecker
{
    Task<bool> IsGrantedAsync(string permission);

    /// <summary>True when the current user may work in the given company.</summary>
    Task<bool> HasCompanyAccessAsync(Guid companyId);
}

/// <summary>Loads the current user's permissions once per request (scoped).</summary>
public class PermissionChecker(ICurrentUser currentUser, IUserRepository userRepository, IModuleAccess moduleAccess) : IPermissionChecker
{
    private HashSet<string>? _permissions;
    private AppUser? _user;

    public async Task<bool> IsGrantedAsync(string permission)
    {
        if (!currentUser.IsAuthenticated)
        {
            return false;
        }

        // Filtered here rather than at every LED endpoint: a firm without the module simply has no such permission.
        _permissions ??= (await moduleAccess.FilterPermissionsAsync(
            await LoadUserAsync() ?? throw new EntityNotFoundException(typeof(AppUser), currentUser.Id!.Value),
            await userRepository.GetPermissionsAsync(currentUser.Id!.Value))).ToHashSet();
        return _permissions.Contains(permission);
    }

    public async Task<bool> HasCompanyAccessAsync(Guid companyId)
    {
        if (!currentUser.IsAuthenticated)
        {
            return false;
        }

        var user = await LoadUserAsync();
        return user is not null && user.HasCompany(companyId);
    }

    private async Task<AppUser?> LoadUserAsync() => _user ??= await userRepository.FindAsync(currentUser.Id!.Value);
}
