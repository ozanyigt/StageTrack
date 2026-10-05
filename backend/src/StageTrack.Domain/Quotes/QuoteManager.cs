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
        [QuoteStatus.Draft] = [QuoteStatus.Sent, QuoteStatus.Accepted, QuoteStatus.Rejected],
        [QuoteStatus.Sent] = [QuoteStatus.Draft, QuoteStatus.Accepted, QuoteStatus.Rejected],
        // A rejected job is reopened with a new revision (ReopenAsync), the rejected one stays as history.
        [QuoteStatus.Rejected] = [],
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

        quote.ReplaceEquipmentLines(await BuildEquipmentLinesAsync(project, []));
        return quote;
    }

    /// <summary>
    /// Re-reads the equipment planned on the project into a draft quote. Lines that were already on the quote
    /// (same equipment in the same section) keep the price, discount and multiplier choice the salesperson set.
    /// </summary>
    public async Task SyncFromProjectAsync(Quote quote, Project project)
    {
        if (!quote.IsEditable)
        {
            throw new BusinessException(StageTrackErrorCodes.QuoteNotEditable);
        }

        var previous = quote.Lines
            .Where(l => l.Type == QuoteLineType.Equipment && l.EquipmentId.HasValue)
            .GroupBy(l => (l.EquipmentId!.Value, l.Section))
            .ToDictionary(g => g.Key, g => g.First());
        quote.ReplaceEquipmentLines(await BuildEquipmentLinesAsync(project, previous));
    }

    private async Task<List<(Guid, string, decimal, decimal, bool, decimal, string?, string?)>> BuildEquipmentLinesAsync(
        Project project, Dictionary<(Guid, string?), QuoteLine> previous)
    {
        var equipmentIds = project.Equipment.Select(e => e.EquipmentId).ToList();
        var equipment = (await equipmentRepository.GetListByIdsAsync(equipmentIds)).ToDictionary(e => e.Id);

        // Lines without a section first, then every section in the order shown on the project.
        var placements = new List<(Guid? SectionId, string? Path)> { (null, null) };
        placements.AddRange(project.GetSectionOutline().Select(o => ((Guid?)o.Section.Id, (string?)o.Path)));

        var result = new List<(Guid, string, decimal, decimal, bool, decimal, string?, string?)>();
        foreach (var (sectionId, path) in placements)
        {
            foreach (var line in project.Equipment.Where(e => e.SectionId == sectionId).OrderBy(e => e.SortOrder))
            {
                if (!equipment.TryGetValue(line.EquipmentId, out var item))
                {
                    continue;
                }

                previous.TryGetValue((item.Id, path), out var old);
                result.Add((item.Id, old?.Description ?? item.Name, line.Quantity, old?.UnitPrice ?? item.RentalPrice,
                    old?.ApplyFactor ?? true, old?.DiscountPercent ?? 0, path, line.Notes ?? old?.Notes));
            }
        }

        return result;
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

    /// <summary>
    /// Accepting a quote confirms the job (it moves from the sales list to Projects) and closes the other open
    /// revisions. Rejecting the last open quote cancels the job, so its equipment is no longer reserved.
    /// </summary>
    public async Task ChangeStatusAsync(Quote quote, QuoteStatus status, Project project, string? rejectionReason = null)
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

        if (status is QuoteStatus.Sent or QuoteStatus.Accepted && quote.Lines.Count == 0)
        {
            throw new BusinessException(StageTrackErrorCodes.QuoteHasNoLines);
        }

        var others = (await quoteRepository.GetListByProjectAsync(project.Id)).Where(q => q.Id != quote.Id).ToList();
        if (status is QuoteStatus.Accepted or QuoteStatus.Rejected && others.Any(q => q.Status == QuoteStatus.Accepted))
        {
            throw new BusinessException(StageTrackErrorCodes.QuoteJobAlreadyDecided);
        }

        if (status == QuoteStatus.Rejected)
        {
            quote.Reject(rejectionReason);
            var stillOpen = others.Any(q => q.Status is QuoteStatus.Draft or QuoteStatus.Sent);
            if (!stillOpen && project.Status is ProjectStatus.Draft or ProjectStatus.Pending)
            {
                await projectManager.ChangeStatusAsync(project, ProjectStatus.Cancelled);
            }

            return;
        }

        quote.SetStatus(status);

        if (status == QuoteStatus.Accepted)
        {
            foreach (var other in others.Where(q => q.Status is QuoteStatus.Draft or QuoteStatus.Sent))
            {
                other.SetStatus(QuoteStatus.Superseded);
            }

            await projectManager.ConfirmIfNotYetAsync(project);
        }
    }

    /// <summary>
    /// The customer came back after rejecting: a new draft revision of the latest quote is created and the
    /// cancelled job returns to the sales list (pending, reserving its equipment again).
    /// </summary>
    public async Task<Quote> ReopenAsync(Quote quote, Project project, DateTime issueDate)
    {
        if (quote.Status != QuoteStatus.Rejected)
        {
            throw new BusinessException(StageTrackErrorCodes.QuoteInvalidStatusTransition)
                .WithData("from", quote.Status)
                .WithData("to", QuoteStatus.Draft);
        }

        var all = await quoteRepository.GetListByProjectAsync(project.Id);
        if (all.Any(q => q.Number == quote.Number && q.Revision > quote.Revision))
        {
            throw new BusinessException(StageTrackErrorCodes.QuoteNotLatestRevision);
        }

        if (all.Any(q => q.Status == QuoteStatus.Accepted))
        {
            throw new BusinessException(StageTrackErrorCodes.QuoteJobAlreadyDecided);
        }

        if (project.Status == ProjectStatus.Cancelled)
        {
            await projectManager.ChangeStatusAsync(project, ProjectStatus.Draft);
        }

        if (project.Status == ProjectStatus.Draft)
        {
            await projectManager.ChangeStatusAsync(project, ProjectStatus.Pending);
        }

        return quote.CreateRevision(Guid.CreateVersion7(), issueDate);
    }

    /// <summary>A sent quote is never edited; a new draft revision is created and the old one is superseded.</summary>
    public Quote Revise(Quote quote, DateTime issueDate)
    {
        if (quote.Status is not QuoteStatus.Sent)
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
