using System.ComponentModel.DataAnnotations;

namespace StageTrack.Account;

public class LoginInput
{
    [Required, StringLength(64)]
    public string UserName { get; set; } = null!;

    [Required, StringLength(128)]
    public string Password { get; set; } = null!;
}

public class LoginResultDto
{
    public string AccessToken { get; set; } = null!;
    public DateTime ExpiresAt { get; set; }
    public CurrentUserDto User { get; set; } = null!;
}

public class CompanyDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string Code { get; set; } = null!;
    public string DefaultCurrency { get; set; } = null!;
    public decimal DefaultVatRate { get; set; }
    public string CountryCode { get; set; } = null!;
}

public class CurrentUserDto
{
    public Guid Id { get; set; }
    public string UserName { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string? Email { get; set; }
    public string Language { get; set; } = null!;
    public List<string> Roles { get; set; } = [];
    public List<string> Permissions { get; set; } = [];
    public List<CompanyDto> Companies { get; set; } = [];

    /// <summary>Full name of the admin who is signed in as this user; null in a normal session.</summary>
    public string? ImpersonatorName { get; set; }

    /// <summary>Platform administrator (no firm): sees only the platform admin panel.</summary>
    public bool IsHost { get; set; }

    public string? TenantName { get; set; }

    /// <summary>Last day of the firm's subscription, for the renewal warning; null when open-ended.</summary>
    public DateTime? SubscriptionEndDate { get; set; }

    /// <summary>The firm uploaded a logo (GET /api/firm/logo).</summary>
    public bool HasFirmLogo { get; set; }
}

public class SetLanguageInput
{
    [Required, RegularExpression("^(tr|en|ar)$")]
    public string Language { get; set; } = null!;
}

public interface IAccountAppService
{
    Task<LoginResultDto> LoginAsync(LoginInput input);

    Task<CurrentUserDto> GetCurrentAsync();

    Task SetLanguageAsync(SetLanguageInput input);

    /// <summary>ABP-style "log in as this user": returns a token for the target user that also carries the admin's identity.</summary>
    Task<LoginResultDto> ImpersonateAsync(Guid userId);

    /// <summary>Platform admin signs in as a user of a customer firm (support, presentations).</summary>
    Task<LoginResultDto> ImpersonateFromHostAsync(Guid userId);

    /// <summary>Returns to the admin's own account.</summary>
    Task<LoginResultDto> EndImpersonationAsync();
}
