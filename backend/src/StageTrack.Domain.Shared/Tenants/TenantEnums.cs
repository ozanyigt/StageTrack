namespace StageTrack.Tenants;

/// <summary>Subscription state of a customer firm, derived from its dates and the active flag.</summary>
public enum TenantStatus
{
    Active = 1,

    /// <summary>Stopped by the platform admin (e.g. unpaid); nobody of the firm can sign in.</summary>
    Suspended = 2,

    /// <summary>The subscription end date has passed.</summary>
    Expired = 3,

    /// <summary>The subscription start date is still in the future.</summary>
    NotStarted = 4
}

public static class TenantConsts
{
    public const int MaxNameLength = 128;
    public const int MaxCodeLength = 32;
    public const int MaxContactLength = 128;
    public const int MaxEmailLength = 256;
    public const int MaxPhoneLength = 32;
    public const int MaxPlanLength = 64;
    public const int MaxNotesLength = 2000;

    /// <summary>The built-in platform administrator role (users without a firm).</summary>
    public const string HostAdminRoleName = "host-admin";

    /// <summary>Days before the end date from which the firm sees a renewal warning.</summary>
    public const int ExpiryWarningDays = 14;
}
