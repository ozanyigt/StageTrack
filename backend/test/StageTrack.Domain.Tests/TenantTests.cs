using StageTrack.Tenants;
using Xunit;

namespace StageTrack.Domain.Tests;

public class TenantTests
{
    private static Tenant NewTenant(DateTime start, DateTime? end)
    {
        var tenant = new Tenant(Guid.CreateVersion7(), "Staras", "STARAS");
        tenant.SetSubscription("Profesyonel", start, end, 10, 2);
        return tenant;
    }

    [Fact]
    public void Subscription_is_active_through_its_last_day()
    {
        var tenant = NewTenant(new DateTime(2026, 1, 1), new DateTime(2026, 12, 31));

        Assert.Equal(TenantStatus.NotStarted, tenant.GetStatus(new DateTime(2025, 12, 31)));
        Assert.Equal(TenantStatus.Active, tenant.GetStatus(new DateTime(2026, 12, 31, 18, 0, 0)));
        Assert.Equal(TenantStatus.Expired, tenant.GetStatus(new DateTime(2027, 1, 1)));
    }

    [Fact]
    public void Open_ended_subscription_never_expires()
    {
        var tenant = NewTenant(new DateTime(2026, 1, 1), null);

        Assert.Equal(TenantStatus.Active, tenant.GetStatus(new DateTime(2040, 1, 1)));
    }

    [Fact]
    public void Suspended_firm_cannot_be_used_even_within_its_period()
    {
        var tenant = NewTenant(new DateTime(2026, 1, 1), null);
        tenant.SetActive(false);

        Assert.Equal(TenantStatus.Suspended, tenant.GetStatus(new DateTime(2026, 6, 1)));
        var ex = Assert.Throws<BusinessException>(() => TenantManager.EnsureCanUse(tenant, new DateTime(2026, 6, 1)));
        Assert.Equal(StageTrackErrorCodes.TenantSuspended, ex.Code);
    }

    [Fact]
    public void End_date_before_start_date_is_rejected()
    {
        var ex = Assert.Throws<BusinessException>(() => NewTenant(new DateTime(2026, 6, 1), new DateTime(2026, 5, 1)));
        Assert.Equal(StageTrackErrorCodes.TenantInvalidPeriod, ex.Code);
    }
}
