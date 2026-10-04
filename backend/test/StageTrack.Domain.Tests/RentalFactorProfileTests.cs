using StageTrack.Pricing;

namespace StageTrack.Domain.Tests;

public class RentalFactorProfileTests
{
    private static RentalFactorProfile Standard()
    {
        var profile = new RentalFactorProfile(Guid.NewGuid(), "Standart");
        profile.SetRules(0.5m, [(1, 1m), (2, 1.5m), (3, 2m), (7, 4m)]);
        return profile;
    }

    [Theory]
    [InlineData(1, 1.0)]
    [InlineData(2, 1.5)]
    [InlineData(3, 2.0)]
    [InlineData(4, 2.5)] // between steps: previous step + extra day
    [InlineData(6, 3.5)]
    [InlineData(7, 4.0)]
    [InlineData(9, 5.0)] // after the last step: + 0.5 per extra day
    public void Factor_follows_steps_and_extra_days(int days, decimal expected)
    {
        Assert.Equal(expected, Standard().GetFactor(days));
    }

    [Fact]
    public void Factor_between_steps_never_exceeds_the_next_step()
    {
        var profile = new RentalFactorProfile(Guid.NewGuid(), "Uzun");
        profile.SetRules(1m, [(1, 1m), (5, 2m)]);

        Assert.Equal(2m, profile.GetFactor(4)); // 1 + 3 × 1 = 4, capped at day 5's factor
    }

    [Fact]
    public void First_step_must_start_at_day_one()
    {
        var profile = new RentalFactorProfile(Guid.NewGuid(), "Hatalı");

        var error = Assert.Throws<BusinessException>(() => profile.SetRules(0.5m, [(2, 1.5m)]));
        Assert.Equal(StageTrackErrorCodes.RentalFactorFirstStepMustBeOneDay, error.Code);
    }

    [Fact]
    public void Duplicate_days_are_rejected()
    {
        var profile = new RentalFactorProfile(Guid.NewGuid(), "Hatalı");

        var error = Assert.Throws<BusinessException>(() => profile.SetRules(0.5m, [(1, 1m), (1, 2m)]));
        Assert.Equal(StageTrackErrorCodes.RentalFactorDuplicateDays, error.Code);
    }
}
