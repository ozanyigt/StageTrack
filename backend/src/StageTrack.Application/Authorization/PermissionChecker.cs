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
public class PermissionChecker(ICurrentUser currentUser, IUserRepository userRepository) : IPermissionChecker
{
    private HashSet<string>? _permissions;
    private AppUser? _user;

    public async Task<bool> IsGrantedAsync(string permission)
    {
        if (!currentUser.IsAuthenticated)
        {
            return false;
        }

        _permissions ??= (await userRepository.GetPermissionsAsync(currentUser.Id!.Value)).ToHashSet();
        return _permissions.Contains(permission);
    }

    public async Task<bool> HasCompanyAccessAsync(Guid companyId)
    {
        if (!currentUser.IsAuthenticated)
        {
            return false;
        }

        _user ??= await userRepository.FindAsync(currentUser.Id!.Value);
        return _user is not null && _user.HasCompany(companyId);
    }
}
