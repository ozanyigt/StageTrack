using StageTrack.Identity;
using StageTrack.Session;
using StageTrack.Tenants;

namespace StageTrack.Authorization;

/// <summary>The signed-in user's customer firm (null for the platform administrator); loaded once per request.</summary>
public class CurrentTenant(ICurrentUser currentUser, IUserRepository userRepository)
{
    private AppUser? _user;

    public async Task<AppUser?> GetUserAsync()
    {
        if (!currentUser.IsAuthenticated)
        {
            return null;
        }

        return _user ??= await userRepository.FindAsync(currentUser.Id!.Value, includeDetails: false);
    }

    public async Task<Guid?> GetIdAsync() => (await GetUserAsync())?.TenantId;
}

/// <summary>
/// Checked on every authenticated request: users of a suspended or expired firm are signed out immediately,
/// not only at their next sign-in.
/// </summary>
public class TenantAccessChecker(CurrentTenant currentTenant, ITenantRepository tenantRepository)
{
    /// <returns>The error to return, or null when the request may continue.</returns>
    public async Task<BusinessException?> CheckAsync()
    {
        var user = await currentTenant.GetUserAsync();
        if (user is null)
        {
            return new BusinessException(StageTrackErrorCodes.Unauthorized);
        }

        if (!user.IsActive)
        {
            return new BusinessException(StageTrackErrorCodes.UserInactive);
        }

        if (user.TenantId is not { } tenantId)
        {
            return null;
        }

        try
        {
            TenantManager.EnsureCanUse(await tenantRepository.GetAsync(tenantId), DateTime.Today);
            return null;
        }
        catch (BusinessException ex)
        {
            return ex;
        }
    }
}
