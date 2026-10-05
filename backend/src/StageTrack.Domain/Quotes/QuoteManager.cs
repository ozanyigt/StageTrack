using StageTrack.Companies;
using StageTrack.Inventory;
using StageTrack.Pricing;
using StageTrack.Projects;

namespace StageTrack.Quotes;

public class QuoteManager(
    IQuoteRepository quoteRepository,
    IEquipmentRepository equipmentRepository,
    RentalFactorManager rentalFactorManager,
    ProjectManager projectManager)
{
    private static readonly Dictionary<QuoteStatus, QuoteStatus[]> Transitions = new()
    {
        [QuoteStatus.Draft] = [QuoteStatus.Sent],
        [QuoteStatus.Sent] = [QuoteStatus.Draft, QuoteStatus.Accepted, QuoteStatus.Rejected],
        [QuoteStatus.Rejected] = [QuoteStatus.Sent],
        [QuoteStatus.Accepted] = [],
        [QuoteStatus.Superseded] = []
    };

    /// <summary>
    /// Starts a quote from the project's planned equipment: daily catalog prices, rental days from the
    /// usage period and the multiplier from the chosen (or default) profile.
    /// </summary>
    public async Task<Quote> CreateFromProjectAsync(Project project, Company company, Guid? profileId, DateTime issueDate)
    {
        var number = await GenerateNumberAsync(issueDate.Year);
        var quote = new Quote(Guid.CreateVersion7(), project.Id, number, 1, issueDate, company.DefaultCurrency, company.DefaultVatRate);
        await ApplyRentalPeriodAsync(quote, project.RentalDays, profileId);

        var equipmentIds = project.Equipment.Select(e => e.EquipmentId).ToList();
        var equipment = (await equipmentRepository.GetListByIdsAsync(equipmentIds)).ToDictionary(e => e.Id);

        // Lines without a section first, then every section in the order shown on the project.
        var placements = new List<(Guid? SectionId, string? Path)> { (null, null) };
        placements.AddRange(project.GetSectionOutline().Select(o => ((Guid?)o.Section.Id, (string?)o.Path)));

        foreach (var (sectionId, path) in placements)
        {
            foreach (var line in project.Equipment.Where(e => e.SectionId == sectionId).OrderBy(e => e.SortOrder))
            {
                if (equipment.TryGetValue(line.EquipmentId, out var item))
                {
                    quote.AddLine(QuoteLineType.Equipment, item.Id, item.Name, line.Quantity, item.RentalPrice,
                        applyFactor: true, discountPercent: 0, section: path, notes: line.Notes);
                }
            }
        }

        return quote;
    }

    /// <summary>Sets rental days and recomputes the multiplier from the profile; a manual factor overrides the table.</summary>
    public async Task ApplyRentalPeriodAsync(Quote quote, int days, Guid? profileId, decimal? manualFactor = null)
    {
        if (manualFactor.HasValue)
        {
            if (manualFactor <= 0)
            {
                throw new BusinessException(StageTrackErrorCodes.RentalFactorInvalidFactor);
            }

            quote.SetRentalPeriod(days, manualFactor.Value, profileId);
            return;
        }

        var profile = await rentalFactorManager.GetOrDefaultAsync(profileId);
        quote.SetRentalPeriod(days, profile?.GetFactor(days) ?? days, profile?.Id);
    }

    public async Task<QuoteLine> AddEquipmentLineAsync(Quote quote, Guid equipmentId, decimal quantity, string? section)
    {
        var equipment = await equipmentRepository.GetAsync(equipmentId, includeDetails: false);
        return quote.AddLine(QuoteLineType.Equipment, equipment.Id, equipment.Name, quantity, equipment.RentalPrice,
            applyFactor: true, discountPercent: 0, section: section);
    }

    public async Task ChangeStatusAsync(Quote quote, QuoteStatus status, Project project)
    {
        if (quote.Status == status)
        {
            return;
        }

        if (!Transitions.TryGetValue(quote.Status, out var allowed) || !allowed.Contains(status))
        {
            throw new BusinessException(StageTrackErrorCodes.QuoteInvalidStatusTransition)
                .WithData("from", quote.Status)
                .WithData("to", status);
        }

        if (status == QuoteStatus.Sent && quote.Lines.Count == 0)
        {
            throw new BusinessException(StageTrackErrorCodes.QuoteHasNoLines);
        }

        quote.SetStatus(status);

        if (status == QuoteStatus.Accepted)
        {
            await projectManager.ConfirmIfNotYetAsync(project);
        }
    }

    /// <summary>A sent or rejected quote is never edited; a new draft revision is created and the old one is superseded.</summary>
    public Quote Revise(Quote quote, DateTime issueDate)
    {
        if (quote.Status is not (QuoteStatus.Sent or QuoteStatus.Rejected))
        {
            throw new BusinessException(StageTrackErrorCodes.QuoteInvalidStatusTransition)
                .WithData("from", quote.Status)
                .WithData("to", QuoteStatus.Superseded);
        }

        var revision = quote.CreateRevision(Guid.CreateVersion7(), issueDate);
        quote.SetStatus(QuoteStatus.Superseded);
        return revision;
    }

    public void EnsureCanDelete(Quote quote)
    {
        if (quote.Status != QuoteStatus.Draft)
        {
            throw new BusinessException(StageTrackErrorCodes.QuoteCannotDelete);
        }
    }

    public static IReadOnlyList<QuoteStatus> GetAllowedTargets(QuoteStatus from) =>
        Transitions.TryGetValue(from, out var targets) ? targets : [];

    private async Task<string> GenerateNumberAsync(int year)
    {
        var next = await quoteRepository.GetLastSequenceForYearAsync(year) + 1;
        return $"TKL-{year}-{next:0000}";
    }
}
