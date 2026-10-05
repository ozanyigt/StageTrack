using Microsoft.AspNetCore.Mvc.Filters;
using StageTrack.Authorization;
using StageTrack.Repositories;

namespace StageTrack.Infrastructure;

/// <summary>Commits all changes of a successful API call in one SaveChanges (ABP-style automatic unit of work).</summary>
public class UnitOfWorkFilter(IUnitOfWork unitOfWork) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var executed = await next();
        if (executed.Exception is null || executed.ExceptionHandled)
        {
            await unitOfWork.SaveChangesAsync(context.HttpContext.RequestAborted);
        }
    }
}

/// <summary>
/// Rejects requests of users whose firm is suspended or whose subscription is over (they are signed out at once),
/// and requests for a company (location) the signed-in user does not belong to.
/// </summary>
public class CompanyAccessMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, IPermissionChecker permissionChecker, TenantAccessChecker tenantAccessChecker,
        ErrorResponseWriter writer)
    {
        if (context.User.Identity?.IsAuthenticated == true && await tenantAccessChecker.CheckAsync() is { } blocked)
        {
            await writer.WriteAsync(context, StatusCodes.Status401Unauthorized, blocked.Code, blocked.Details);
            return;
        }

        var header = context.Request.Headers[HttpCurrentCompany.HeaderName].FirstOrDefault();
        if (context.User.Identity?.IsAuthenticated == true && Guid.TryParse(header, out var companyId) &&
            !await permissionChecker.HasCompanyAccessAsync(companyId))
        {
            await writer.WriteAsync(context, StatusCodes.Status403Forbidden, StageTrackErrorCodes.CompanyAccessDenied);
            return;
        }

        await next(context);
    }
}
