using Microsoft.AspNetCore.Identity;
using StageTrack.Tenants;

namespace StageTrack.Identity;

public class UserManager(
    IUserRepository userRepository,
    IRoleRepository roleRepository,
    TenantManager tenantManager,
    IPasswordHasher<AppUser> passwordHasher)
{
    public const int MinPasswordLength = 8;

    /// <param name="tenantId">The customer firm; null only for platform administrators. Checks the firm's user limit.</param>
    public async Task<AppUser> CreateAsync(string userName, string fullName, string password, string? email, string language, Guid? tenantId)
    {
        userName = userName.Trim();
        if (tenantId.HasValue)
        {
            await tenantManager.EnsureCanAddUserAsync(tenantId.Value);
        }

        if (await userRepository.UserNameExistsAsync(userName))
        {
            throw new BusinessException(StageTrackErrorCodes.UserNameAlreadyExists).WithData("userName", userName);
        }

        var user = new AppUser(Guid.CreateVersion7(), userName, fullName.Trim(), email, language, tenantId);
        SetPassword(user, password);
        return await userRepository.InsertAsync(user);
    }

    /// <summary>Returns the user when the credentials are valid; otherwise throws a localized business error.</summary>
    public async Task<AppUser> ValidateCredentialsAsync(string userName, string password)
    {
        var user = await userRepository.FindByUserNameAsync(userName);
        if (user is null)
        {
            throw new BusinessException(StageTrackErrorCodes.InvalidCredentials);
        }

        var result = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, password);
        if (result == PasswordVerificationResult.Failed)
        {
            throw new BusinessException(StageTrackErrorCodes.InvalidCredentials);
        }

        if (!user.IsActive)
        {
            throw new BusinessException(StageTrackErrorCodes.UserInactive);
        }

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.SetPasswordHash(passwordHasher.HashPassword(user, password));
        }

        return user;
    }

    /// <summary>Password rule: at least 8 characters, letters and digits.</summary>
    public void SetPassword(AppUser user, string password)
    {
        if (password.Length < MinPasswordLength || !password.Any(char.IsLetter) || !password.Any(char.IsDigit))
        {
            throw new BusinessException(StageTrackErrorCodes.UserPasswordTooWeak);
        }

        user.SetPasswordHash(passwordHasher.HashPassword(user, password));
    }

    public async Task SetRolesAsync(AppUser user, IReadOnlyCollection<Guid> roleIds)
    {
        if (roleIds.Count == 0)
        {
            throw new BusinessException(StageTrackErrorCodes.UserRoleRequired);
        }

        var existing = await roleRepository.GetListByIdsAsync(roleIds);
        if (existing.Count != roleIds.Distinct().Count() || existing.Any(r => r.TenantId != user.TenantId))
        {
            throw new EntityNotFoundException(typeof(AppRole));
        }

        user.SetRoles(roleIds.Distinct().ToList());
    }

    /// <summary>The acting admin can only grant or remove companies they belong to themselves.</summary>
    public void SetCompanies(AppUser user, IReadOnlyCollection<Guid> companyIds, AppUser actingUser)
    {
        var manageable = actingUser.Companies.Select(c => c.CompanyId).ToList();
        var requested = companyIds.Where(manageable.Contains).Distinct().ToList();
        var keptElsewhere = user.Companies.Count(c => !manageable.Contains(c.CompanyId));
        if (requested.Count + keptElsewhere == 0)
        {
            throw new BusinessException(StageTrackErrorCodes.UserCompanyRequired);
        }

        user.SetCompanies(requested, manageable);
    }

    public void SetActive(AppUser user, bool isActive, Guid actingUserId)
    {
        if (!isActive && user.Id == actingUserId)
        {
            throw new BusinessException(StageTrackErrorCodes.UserCannotDeactivateSelf);
        }

        user.SetActive(isActive);
    }

    /// <summary>
    /// ABP-style "log in as this user": not yourself, not an inactive user, only someone in the company the
    /// admin is working in, and never from an already impersonated session (no chains).
    /// </summary>
    public void EnsureCanImpersonate(AppUser impersonator, AppUser target, Guid companyId, bool alreadyImpersonating)
    {
        if (alreadyImpersonating || impersonator.Id == target.Id || !target.IsActive || !target.HasCompany(companyId) ||
            target.TenantId != impersonator.TenantId)
        {
            throw new BusinessException(StageTrackErrorCodes.ImpersonationNotAllowed);
        }
    }

    /// <summary>The platform admin may sign in as any active user of a customer firm (support, presentations).</summary>
    public static void EnsureHostCanImpersonate(AppUser impersonator, AppUser target, bool alreadyImpersonating)
    {
        if (alreadyImpersonating || !impersonator.IsHost || target.IsHost || !target.IsActive)
        {
            throw new BusinessException(StageTrackErrorCodes.ImpersonationNotAllowed);
        }
    }

    public void EnsureCompanyAccess(AppUser user, Guid companyId)
    {
        if (!user.HasCompany(companyId))
        {
            throw new BusinessException(StageTrackErrorCodes.CompanyAccessDenied);
        }
    }
}
