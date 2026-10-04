using StageTrack.Entities;
using StageTrack.Quotes;
using StageTrack.Repositories;

namespace StageTrack.Pricing;

/// <summary>
/// Day multiplier table defined by the company admin, e.g. 1 day = 1, 2 days = 1.5, 3 days = 2.
/// A quote line price is: daily price × quantity × factor(days).
/// </summary>
public class RentalFactorProfile : CompanyAggregateRoot
{
    public string Name { get; private set; } = null!;
    public bool IsDefault { get; private set; }

    /// <summary>Added to the factor for each day after the last defined step (and between steps).</summary>
    public decimal ExtraDayFactor { get; private set; }

    public ICollection<RentalFactorStep> Steps { get; private set; } = new List<RentalFactorStep>();

    private RentalFactorProfile()
    {
    }

    internal RentalFactorProfile(Guid id, string name) : base(id)
    {
        Name = name;
    }

    public void Rename(string name) => Name = name;

    internal void SetDefault(bool isDefault) => IsDefault = isDefault;

    public void SetRules(decimal extraDayFactor, IReadOnlyCollection<(int Days, decimal Factor)> steps)
    {
        if (extraDayFactor < 0)
        {
            throw new BusinessException(StageTrackErrorCodes.RentalFactorInvalidFactor);
        }

        if (steps.Count == 0)
        {
            throw new BusinessException(StageTrackErrorCodes.RentalFactorStepsRequired);
        }

        foreach (var step in steps)
        {
            if (step.Days < 1 || step.Days > RentalFactorConsts.MaxDays)
            {
                throw new BusinessException(StageTrackErrorCodes.RentalFactorInvalidDays).WithData("max", RentalFactorConsts.MaxDays);
            }

            if (step.Factor <= 0)
            {
                throw new BusinessException(StageTrackErrorCodes.RentalFactorInvalidFactor);
            }
        }

        var duplicate = steps.GroupBy(s => s.Days).FirstOrDefault(g => g.Count() > 1);
        if (duplicate is not null)
        {
            throw new BusinessException(StageTrackErrorCodes.RentalFactorDuplicateDays).WithData("days", duplicate.Key);
        }

        if (steps.Min(s => s.Days) != 1)
        {
            throw new BusinessException(StageTrackErrorCodes.RentalFactorFirstStepMustBeOneDay);
        }

        ExtraDayFactor = extraDayFactor;
        Steps.Clear();
        foreach (var (days, factor) in steps.OrderBy(s => s.Days))
        {
            Steps.Add(new RentalFactorStep(Guid.CreateVersion7(), Id, days, factor));
        }
    }

    /// <summary>
    /// Exact step when defined; otherwise the previous step plus <see cref="ExtraDayFactor"/> per extra day,
    /// never exceeding the next defined step so a longer rental is never cheaper than a shorter one would allow.
    /// </summary>
    public decimal GetFactor(int days)
    {
        if (days < 1 || Steps.Count == 0)
        {
            return 1;
        }

        var ordered = Steps.OrderBy(s => s.Days).ToList();
        var previous = ordered.Last(s => s.Days <= days);
        if (previous.Days == days)
        {
            return previous.Factor;
        }

        var factor = previous.Factor + (days - previous.Days) * ExtraDayFactor;
        var next = ordered.FirstOrDefault(s => s.Days > days);
        if (next is not null)
        {
            factor = Math.Min(factor, next.Factor);
        }

        return Math.Round(factor, 4);
    }
}

public class RentalFactorStep : Entity
{
    public Guid ProfileId { get; private set; }
    public int Days { get; private set; }
    public decimal Factor { get; private set; }

    private RentalFactorStep()
    {
    }

    internal RentalFactorStep(Guid id, Guid profileId, int days, decimal factor) : base(id)
    {
        ProfileId = profileId;
        Days = days;
        Factor = factor;
    }
}

public interface IRentalFactorProfileRepository : IRepository<RentalFactorProfile>
{
    Task<RentalFactorProfile?> FindDefaultAsync(CancellationToken cancellationToken = default);
}

public class RentalFactorManager(IRentalFactorProfileRepository profileRepository)
{
    public async Task<RentalFactorProfile> CreateAsync(string name, decimal extraDayFactor,
        IReadOnlyCollection<(int Days, decimal Factor)> steps, bool isDefault)
    {
        var profile = new RentalFactorProfile(Guid.CreateVersion7(), name.Trim());
        profile.SetRules(extraDayFactor, steps);

        // The first profile is always the default one, so quotes can always find a multiplier table.
        if (isDefault || await profileRepository.FindDefaultAsync() is null)
        {
            await SetDefaultAsync(profile);
        }

        return profile;
    }

    public async Task SetDefaultAsync(RentalFactorProfile profile)
    {
        var current = await profileRepository.FindDefaultAsync();
        if (current is not null && current.Id != profile.Id)
        {
            current.SetDefault(false);
        }

        profile.SetDefault(true);
    }

    public void EnsureCanDelete(RentalFactorProfile profile)
    {
        if (profile.IsDefault)
        {
            throw new BusinessException(StageTrackErrorCodes.RentalFactorCannotDeleteDefault);
        }
    }

    /// <summary>The given profile, or the company's default one when none is given.</summary>
    public async Task<RentalFactorProfile?> GetOrDefaultAsync(Guid? profileId) =>
        profileId.HasValue
            ? await profileRepository.GetAsync(profileId.Value)
            : await profileRepository.FindDefaultAsync();
}
