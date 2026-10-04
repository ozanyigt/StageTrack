using StageTrack.Session;

namespace StageTrack.Infrastructure;

public class HttpCurrentUser(IHttpContextAccessor httpContextAccessor) : ICurrentUser
{
    public const string UserIdClaim = "sub";
    public const string UserNameClaim = "unique_name";
    public const string ImpersonatorIdClaim = "impersonator_id";
    public const string ImpersonatorNameClaim = "impersonator_name";

    public bool IsAuthenticated => httpContextAccessor.HttpContext?.User.Identity?.IsAuthenticated == true;

    public Guid? Id =>
        Guid.TryParse(httpContextAccessor.HttpContext?.User.FindFirst(UserIdClaim)?.Value, out var id) ? id : null;

    public string? UserName => httpContextAccessor.HttpContext?.User.FindFirst(UserNameClaim)?.Value;

    public Guid? ImpersonatorId =>
        Guid.TryParse(httpContextAccessor.HttpContext?.User.FindFirst(ImpersonatorIdClaim)?.Value, out var id) ? id : null;
}

/// <summary>
/// The company comes from the X-Company-Id header (validated by <see cref="CompanyAccessMiddleware"/>),
/// unless code switched it with <see cref="Change"/>.
/// </summary>
public class HttpCurrentCompany(IHttpContextAccessor httpContextAccessor) : ICurrentCompany
{
    public const string HeaderName = "X-Company-Id";

    public Guid? Id
    {
        get
        {
            if (CompanyScope.Current is { } scoped)
            {
                return scoped[0];
            }

            var header = httpContextAccessor.HttpContext?.Request.Headers[HeaderName].FirstOrDefault();
            return Guid.TryParse(header, out var id) ? id : null;
        }
    }

    public IDisposable Change(Guid? companyId) => CompanyScope.Begin(companyId);
}
