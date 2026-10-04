using Microsoft.Extensions.Logging;
using StageTrack.Companies;
using StageTrack.Identity;
using StageTrack.Repositories;
using StageTrack.Session;

namespace StageTrack.Account;

/// <summary>Issues access tokens; implemented by the host (JWT settings live there).</summary>
public interface IAccessTokenGenerator
{
    /// <param name="impersonator">The admin signed in as <paramref name="user"/>; carried in the token so the real person stays known.</param>
    (string Token, DateTime ExpiresAt) Generate(AppUser user, AppUser? impersonator = null);
}

public class AccountAppService(
    UserManager userManager,
    IUserRepository userRepository,
    ICompanyRepository companyRepository,
    IAccessTokenGenerator tokenGenerator,
    ICurrentUser currentUser,
    ICurrentCompany currentCompany,
    IUnitOfWork unitOfWork,
    ILogger<AccountAppService> logger) : IAccountAppService
{
    public async Task<LoginResultDto> LoginAsync(LoginInput input)
    {
        var user = await userManager.ValidateCredentialsAsync(input.UserName, input.Password);
        await unitOfWork.SaveChangesAsync();
        return await IssueAsync(user, null);
    }

    public async Task<CurrentUserDto> GetCurrentAsync()
    {
        var user = await userRepository.GetAsync(currentUser.Id!.Value);
        var impersonator = currentUser.ImpersonatorId.HasValue ? await userRepository.FindAsync(currentUser.ImpersonatorId.Value) : null;
        return await BuildCurrentUserAsync(user, impersonator);
    }

    public async Task SetLanguageAsync(SetLanguageInput input)
    {
        var user = await userRepository.GetAsync(currentUser.Id!.Value);
        user.SetLanguage(input.Language);
    }

    public async Task<LoginResultDto> ImpersonateAsync(Guid userId)
    {
        var impersonator = await userRepository.GetAsync(currentUser.Id!.Value);
        var target = await userRepository.GetAsync(userId);
        userManager.EnsureCanImpersonate(impersonator, target, currentCompany.Id!.Value, currentUser.ImpersonatorId.HasValue);

        logger.LogWarning("Impersonation started: {Impersonator} ({ImpersonatorId}) is signed in as {Target} ({TargetId})",
            impersonator.UserName, impersonator.Id, target.UserName, target.Id);
        return await IssueAsync(target, impersonator);
    }

    public async Task<LoginResultDto> EndImpersonationAsync()
    {
        if (currentUser.ImpersonatorId is not { } impersonatorId)
        {
            throw new BusinessException(StageTrackErrorCodes.ImpersonationNotActive);
        }

        var impersonator = await userRepository.GetAsync(impersonatorId);
        if (!impersonator.IsActive)
        {
            throw new BusinessException(StageTrackErrorCodes.UserInactive);
        }

        logger.LogWarning("Impersonation ended: {Impersonator} ({ImpersonatorId}) left {TargetId}",
            impersonator.UserName, impersonator.Id, currentUser.Id);
        return await IssueAsync(impersonator, null);
    }

    private async Task<LoginResultDto> IssueAsync(AppUser user, AppUser? impersonator)
    {
        var (token, expiresAt) = tokenGenerator.Generate(user, impersonator);
        return new LoginResultDto { AccessToken = token, ExpiresAt = expiresAt, User = await BuildCurrentUserAsync(user, impersonator) };
    }

    private async Task<CurrentUserDto> BuildCurrentUserAsync(AppUser user, AppUser? impersonator)
    {
        var companies = await companyRepository.GetListByIdsAsync(user.Companies.Select(c => c.CompanyId));
        return new CurrentUserDto
        {
            Id = user.Id,
            UserName = user.UserName,
            FullName = user.FullName,
            Email = user.Email,
            Language = user.Language,
            Roles = await userRepository.GetRoleNamesAsync(user.Id),
            Permissions = await userRepository.GetPermissionsAsync(user.Id),
            // Ids are Guid v7 (time-ordered): the company created first (the main one) comes first and is the default.
            Companies = companies.OrderBy(c => c.Id).Select(c => c.ToDto()).ToList(),
            ImpersonatorName = impersonator?.FullName
        };
    }
}
