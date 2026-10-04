using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using StageTrack.Authorization;
using StageTrack.Permissions;

namespace StageTrack.Infrastructure;

public record PermissionRequirement(string Permission) : IAuthorizationRequirement;

/// <summary>Turns any policy name that is a permission ("StageTrack.Projects.Manage") into a permission requirement.</summary>
public class PermissionPolicyProvider(IOptions<AuthorizationOptions> options) : DefaultAuthorizationPolicyProvider(options)
{
    public override async Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (!policyName.StartsWith(StageTrackPermissions.Prefix + ".", StringComparison.Ordinal))
        {
            return await base.GetPolicyAsync(policyName);
        }

        return new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .AddRequirements(new PermissionRequirement(policyName))
            .Build();
    }
}

public class PermissionAuthorizationHandler(IPermissionChecker permissionChecker) : AuthorizationHandler<PermissionRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        if (await permissionChecker.IsGrantedAsync(requirement.Permission))
        {
            context.Succeed(requirement);
        }
    }
}
