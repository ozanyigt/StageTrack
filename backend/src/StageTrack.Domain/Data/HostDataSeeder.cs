using Microsoft.Extensions.Logging;
using StageTrack.Identity;
using StageTrack.Repositories;
using StageTrack.Tenants;

namespace StageTrack.Data;

/// <summary>Platform administrator account, read from configuration ("HostAdmin" section).</summary>
public class HostAdminOptions
{
    public const string Section = "HostAdmin";

    public string UserName { get; set; } = "";
    public string Password { get; set; } = "";
    public string FullName { get; set; } = "Platform Yöneticisi";
    public string? Email { get; set; }
}

/// <summary>
/// The only data an empty database gets: the platform administrator role and user. Customer firms, their
/// locations and users are created from the platform admin panel.
/// </summary>
public class HostDataSeeder(
    IRoleRepository roleRepository,
    IUserRepository userRepository,
    UserManager userManager,
    IUnitOfWork unitOfWork,
    ILogger<HostDataSeeder> logger)
{
    public async Task SeedAsync(HostAdminOptions options)
    {
        var role = await roleRepository.FindByNameAsync(null, TenantConsts.HostAdminRoleName);
        if (role is null)
        {
            role = new AppRole(Guid.CreateVersion7(), TenantConsts.HostAdminRoleName, tenantId: null, isStatic: true);
            await roleRepository.InsertAsync(role);
            await unitOfWork.SaveChangesAsync();
        }

        if (string.IsNullOrWhiteSpace(options.UserName) || string.IsNullOrWhiteSpace(options.Password))
        {
            logger.LogWarning("HostAdmin:UserName / HostAdmin:Password are not configured; no platform administrator was created.");
            return;
        }

        if (await userRepository.FindByUserNameAsync(options.UserName) is not null)
        {
            return;
        }

        var user = await userManager.CreateAsync(options.UserName, options.FullName, options.Password, options.Email, "tr", tenantId: null);
        user.AddRole(role.Id);
        await unitOfWork.SaveChangesAsync();
        logger.LogInformation("Platform administrator '{UserName}' created.", user.UserName);
    }
}
