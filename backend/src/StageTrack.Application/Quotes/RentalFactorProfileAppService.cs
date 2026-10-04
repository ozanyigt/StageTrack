using StageTrack.Pricing;

namespace StageTrack.Quotes;

public class RentalFactorProfileAppService(
    IRentalFactorProfileRepository profileRepository,
    RentalFactorManager rentalFactorManager) : IRentalFactorProfileAppService
{
    public async Task<List<RentalFactorProfileDto>> GetListAsync() =>
        (await profileRepository.GetListAsync(includeDetails: true)).Select(p => p.ToDto()).ToList();

    public async Task<RentalFactorProfileDto> CreateAsync(CreateUpdateRentalFactorProfileDto input)
    {
        var profile = await rentalFactorManager.CreateAsync(input.Name, input.ExtraDayFactor, ToSteps(input), input.IsDefault);
        await profileRepository.InsertAsync(profile);
        return profile.ToDto();
    }

    public async Task<RentalFactorProfileDto> UpdateAsync(Guid id, CreateUpdateRentalFactorProfileDto input)
    {
        var profile = await profileRepository.GetAsync(id);
        profile.Rename(input.Name.Trim());
        profile.SetRules(input.ExtraDayFactor, ToSteps(input));
        if (input.IsDefault)
        {
            await rentalFactorManager.SetDefaultAsync(profile);
        }

        return profile.ToDto();
    }

    public async Task DeleteAsync(Guid id)
    {
        var profile = await profileRepository.GetAsync(id);
        rentalFactorManager.EnsureCanDelete(profile);
        await profileRepository.DeleteAsync(profile);
    }

    public async Task<List<FactorPreviewDto>> GetPreviewAsync(Guid id, int maxDays)
    {
        var profile = await profileRepository.GetAsync(id);
        var defined = profile.Steps.Select(s => s.Days).ToHashSet();
        return Enumerable.Range(1, Math.Clamp(maxDays, 1, RentalFactorConsts.MaxDays))
            .Select(days => new FactorPreviewDto { Days = days, Factor = profile.GetFactor(days), IsDefinedStep = defined.Contains(days) })
            .ToList();
    }

    private static List<(int Days, decimal Factor)> ToSteps(CreateUpdateRentalFactorProfileDto input) =>
        input.Steps.Select(s => (s.Days, s.Factor)).ToList();
}
