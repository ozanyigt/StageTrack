using StageTrack.Entities;
using StageTrack.Repositories;

namespace StageTrack.Tenants;

/// <summary>
/// A customer firm subscribed to the platform (e.g. Staras). Its locations are <see cref="Companies.Company"/>
/// records; its users and roles carry the tenant id. Managed only by the platform administrator.
/// </summary>
public class Tenant : AggregateRoot, IAuditedObject
{
    public string Name { get; private set; } = null!;

    /// <summary>Short unique code, e.g. "STARAS".</summary>
    public string Code { get; private set; } = null!;

    public string? ContactName { get; private set; }
    public string? Email { get; private set; }
    public string? Phone { get; private set; }
    public string? Notes { get; private set; }

    /// <summary>False when the platform admin suspended the firm.</summary>
    public bool IsActive { get; private set; } = true;

    public string PlanName { get; private set; } = null!;
    public DateTime StartDate { get; private set; }

    /// <summary>Last day of the subscription; null = open-ended.</summary>
    public DateTime? EndDate { get; private set; }

    /// <summary>Null = unlimited.</summary>
    public int? MaxUsers { get; private set; }

    /// <summary>Null = unlimited.</summary>
    public int? MaxLocations { get; private set; }

    /// <summary>Firm logo printed on quotes and packing slips.</summary>
    public byte[]? LogoContent { get; private set; }

    public string? LogoContentType { get; private set; }

    public DateTime CreationTime { get; set; }
    public Guid? CreatorId { get; set; }
    public DateTime? LastModificationTime { get; set; }
    public Guid? LastModifierId { get; set; }

    private Tenant()
    {
    }

    internal Tenant(Guid id, string name, string code) : base(id)
    {
        Name = name;
        Code = code;
    }

    public void Update(string name, string? contactName, string? email, string? phone, string? notes)
    {
        Name = name.Trim();
        ContactName = Clean(contactName);
        Email = Clean(email);
        Phone = Clean(phone);
        Notes = Clean(notes);
    }

    internal void SetCode(string code) => Code = code;

    public void SetSubscription(string planName, DateTime startDate, DateTime? endDate, int? maxUsers, int? maxLocations)
    {
        if (endDate.HasValue && endDate.Value.Date < startDate.Date)
        {
            throw new BusinessException(StageTrackErrorCodes.TenantInvalidPeriod);
        }

        if (maxUsers is < 1 || maxLocations is < 1)
        {
            throw new BusinessException(StageTrackErrorCodes.TenantInvalidLimit);
        }

        PlanName = planName.Trim();
        StartDate = startDate.Date;
        EndDate = endDate?.Date;
        MaxUsers = maxUsers;
        MaxLocations = maxLocations;
    }

    public void SetActive(bool isActive) => IsActive = isActive;

    public void SetLogo(byte[]? content, string? contentType)
    {
        if (content is not null && (content.Length > TenantConsts.MaxLogoSize || contentType is null || !contentType.StartsWith("image/")))
        {
            throw new BusinessException(StageTrackErrorCodes.FirmLogoInvalid);
        }

        LogoContent = content;
        LogoContentType = content is null ? null : contentType;
    }

    public TenantStatus GetStatus(DateTime today)
    {
        if (!IsActive)
        {
            return TenantStatus.Suspended;
        }

        if (today.Date < StartDate)
        {
            return TenantStatus.NotStarted;
        }

        return EndDate.HasValue && today.Date > EndDate.Value ? TenantStatus.Expired : TenantStatus.Active;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public class TenantListItem
{
    public required Tenant Tenant { get; init; }
    public int UserCount { get; init; }
    public int LocationCount { get; init; }
}

public interface ITenantRepository : IRepository<Tenant>
{
    Task<bool> CodeExistsAsync(string code, Guid? excludeId = null, CancellationToken cancellationToken = default);

    Task<List<TenantListItem>> GetPagedListAsync(string? text, int skip, int take, CancellationToken cancellationToken = default);

    Task<long> GetCountAsync(string? text, CancellationToken cancellationToken = default);

    Task<int> GetUserCountAsync(Guid tenantId, CancellationToken cancellationToken = default);

    Task<int> GetLocationCountAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
