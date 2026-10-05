using System.ComponentModel.DataAnnotations;
using StageTrack.Account;
using StageTrack.Dtos;
using StageTrack.Tenants;

namespace StageTrack.Host;

public class TenantDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string Code { get; set; } = null!;
    public string? ContactName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; }
    public TenantStatus Status { get; set; }
    public string PlanName { get; set; } = null!;
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public int? MaxUsers { get; set; }
    public int? MaxLocations { get; set; }
    public int UserCount { get; set; }
    public int LocationCount { get; set; }
    public DateTime CreationTime { get; set; }

    /// <summary>Days left until the end date (negative when expired); null when open-ended.</summary>
    public int? DaysLeft { get; set; }
}

public class TenantLocationDto : CompanyDto
{
    public int? RentmanWorkspaceId { get; set; }
}

public class TenantUserDto
{
    public Guid Id { get; set; }
    public string UserName { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string? Email { get; set; }
    public bool IsActive { get; set; }
    public List<string> Roles { get; set; } = [];
    public DateTime CreationTime { get; set; }
}

public class TenantDetailDto : TenantDto
{
    public List<TenantLocationDto> Locations { get; set; } = [];
    public List<TenantUserDto> Users { get; set; } = [];
}

public class HostSummaryDto
{
    public int Total { get; set; }
    public int Active { get; set; }
    public int Suspended { get; set; }
    public int Expired { get; set; }

    /// <summary>Active firms whose subscription ends within the warning period.</summary>
    public int ExpiringSoon { get; set; }
}

public class GetTenantListInput : PagedRequestDto
{
    public string? Text { get; set; }
}

public class UpdateTenantInput
{
    [Required, StringLength(TenantConsts.MaxNameLength)]
    public string Name { get; set; } = null!;

    [Required, StringLength(TenantConsts.MaxCodeLength), RegularExpression("^[A-Za-z0-9_-]+$")]
    public string Code { get; set; } = null!;

    [StringLength(TenantConsts.MaxContactLength)]
    public string? ContactName { get; set; }

    [EmailAddress, StringLength(TenantConsts.MaxEmailLength)]
    public string? Email { get; set; }

    [StringLength(TenantConsts.MaxPhoneLength)]
    public string? Phone { get; set; }

    [StringLength(TenantConsts.MaxNotesLength)]
    public string? Notes { get; set; }

    [Required, StringLength(TenantConsts.MaxPlanLength)]
    public string PlanName { get; set; } = null!;

    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }

    [Range(1, 100_000)]
    public int? MaxUsers { get; set; }

    [Range(1, 1_000)]
    public int? MaxLocations { get; set; }
}

public class TenantLocationInput
{
    [Required, StringLength(256)]
    public string Name { get; set; } = null!;

    [Required, StringLength(16), RegularExpression("^[A-Za-z0-9_-]+$")]
    public string Code { get; set; } = null!;

    [Required, StringLength(3, MinimumLength = 3)]
    public string Currency { get; set; } = "TRY";

    [Range(0, 100)]
    public decimal VatRate { get; set; } = 20;

    [Required, StringLength(2, MinimumLength = 2)]
    public string CountryCode { get; set; } = "TR";

    /// <summary>Rentman workspace number (cmpID in existing QR labels); optional.</summary>
    [Range(1, int.MaxValue)]
    public int? RentmanWorkspaceId { get; set; }

    /// <summary>Only used when the location is created: name of its first warehouse.</summary>
    [StringLength(128)]
    public string? WarehouseName { get; set; }
}

public class TenantAdminInput
{
    [Required, StringLength(64, MinimumLength = 3)]
    public string UserName { get; set; } = null!;

    [Required, StringLength(128)]
    public string FullName { get; set; } = null!;

    [EmailAddress, StringLength(256)]
    public string? Email { get; set; }

    [Required, StringLength(128, MinimumLength = 8)]
    public string Password { get; set; } = null!;

    [RegularExpression("^(tr|en|ar)$")]
    public string Language { get; set; } = "tr";
}

public class CreateTenantInput : UpdateTenantInput
{
    [Required]
    public TenantLocationInput Location { get; set; } = null!;

    [Required]
    public TenantAdminInput Admin { get; set; } = null!;
}

public class SetTenantActiveInput
{
    public bool IsActive { get; set; }
}

public class ResetTenantUserPasswordInput
{
    [Required, StringLength(128, MinimumLength = 8)]
    public string NewPassword { get; set; } = null!;
}

/// <summary>Platform administration: customer firms, their subscriptions, locations and users.</summary>
public interface ITenantAppService
{
    Task<HostSummaryDto> GetSummaryAsync();

    Task<PagedResultDto<TenantDto>> GetListAsync(GetTenantListInput input);

    Task<TenantDetailDto> GetAsync(Guid id);

    /// <summary>New firm with its first location, built-in roles and administrator.</summary>
    Task<TenantDetailDto> CreateAsync(CreateTenantInput input);

    Task<TenantDetailDto> UpdateAsync(Guid id, UpdateTenantInput input);

    Task<TenantDetailDto> SetActiveAsync(Guid id, SetTenantActiveInput input);

    Task<TenantDetailDto> AddLocationAsync(Guid id, TenantLocationInput input);

    Task<TenantDetailDto> UpdateLocationAsync(Guid id, Guid locationId, TenantLocationInput input);

    Task ResetUserPasswordAsync(Guid id, Guid userId, ResetTenantUserPasswordInput input);
}
