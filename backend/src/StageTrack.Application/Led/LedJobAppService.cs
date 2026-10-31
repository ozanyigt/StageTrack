using Microsoft.Extensions.Localization;
using StageTrack.Inventory;
using StageTrack.Led.Calculation;
using StageTrack.Localization;
using StageTrack.Projects;
using StageTrack.Quotes;
using StageTrack.Repositories;

namespace StageTrack.Led;

/// <summary>
/// The point of folding the LED module in: a calculated screen stops being a drawing and becomes planned equipment
/// on a job — which then reserves stock, prints on the packing list, is scanned out of the warehouse and, because a
/// draft quote follows the job, lands on the quote with the firm's own prices.
/// Panelyze could only produce an Excel of model names here, because it had no job to plan onto.
/// </summary>
public class LedJobAppService(
    IProjectRepository projectRepository,
    IEquipmentRepository equipmentRepository,
    IEquipmentLedSpecRepository specRepository,
    ProjectManager projectManager,
    QuoteManager quoteManager,
    IStringLocalizer<StageTrackResource> localizer,
    IUnitOfWork unitOfWork) : ILedJobAppService
{
    public async Task<LedToJobResultDto> PreviewAsync(Guid projectId, LedToJobInput input)
    {
        var project = await projectRepository.GetAsync(projectId);
        var lines = await BuildAsync(input);
        return Result(project, input, lines);
    }

    public async Task<LedToJobResultDto> TransferAsync(Guid projectId, LedToJobInput input)
    {
        var project = await projectRepository.GetAsync(projectId);
        var lines = await BuildAsync(input);

        var section = await PrepareSectionAsync(project, input);
        var planned = new List<LedJobLineDto>();
        foreach (var line in lines)
        {
            if (line.Problem is not null)
            {
                planned.Add(line);
                continue;
            }

            try
            {
                await projectManager.AddEquipmentAsync(project, line.EquipmentId, line.Quantity, section?.Id);
                planned.Add(line with { Added = true });
            }
            catch (BusinessException e)
            {
                // One item the job will not take (archived, not quotable) must not lose the rest of the screen.
                planned.Add(line with { Problem = e.Code });
            }
        }

        await unitOfWork.SaveChangesAsync();
        await quoteManager.SyncDraftAsync(project);
        await unitOfWork.SaveChangesAsync();

        return new LedToJobResultDto(project.Id, section?.Id, section?.Name ?? string.Empty, planned);
    }

    /// <summary>
    /// What the job takes: the panels the screens use (cut-outs left out, a corner column counting for its own
    /// model), then the processors, extenders and other lines, each once with its total.
    /// </summary>
    private async Task<List<LedJobLineDto>> BuildAsync(LedToJobInput input)
    {
        Validate(input);

        var panels = StockUsage.Count(input.Screens
                .Where(s => s.EquipmentId is not null)
                .Select(s => new StockScreenUse(
                    new StockKey(s.EquipmentId!.Value, s.StockLocationId ?? Guid.Empty),
                    s.Columns,
                    s.Rows,
                    (s.Cutouts ?? []).Select(c => new Cutout(c.Width, c.Height, c.Left, c.Bottom)).ToList(),
                    (s.Corners ?? []).Select(c => new StockCornerUse(c.AfterColumn, new StockKey(c.EquipmentId, c.StockLocationId ?? Guid.Empty))).ToList())))
            .GroupBy(u => u.Key.PanelModelId)
            .ToDictionary(g => g.Key, g => g.Sum(u => u.Value));

        var wanted = new List<(LedJobLineSource Source, Guid EquipmentId, int Count)>();
        wanted.AddRange(panels.Select(p => (LedJobLineSource.Panel, p.Key, p.Value)));
        wanted.AddRange(Totals(input.Processors).Select(p => (LedJobLineSource.Processor, p.Key, p.Value)));
        wanted.AddRange(Totals(input.Extenders).Select(p => (LedJobLineSource.Extender, p.Key, p.Value)));
        wanted.AddRange(Totals(input.Equipment).Select(p => (LedJobLineSource.Equipment, p.Key, p.Value)));

        var equipment = (await equipmentRepository.GetListByIdsAsync(wanted.Select(w => w.EquipmentId))).ToDictionary(e => e.Id);
        var roles = (await specRepository.GetListByEquipmentAsync(wanted.Select(w => w.EquipmentId).ToList()))
            .ToDictionary(s => s.EquipmentId, s => s.Role);

        return wanted
            .Where(w => w.Count > 0)
            .Select(w =>
            {
                if (!equipment.TryGetValue(w.EquipmentId, out var item))
                {
                    return new LedJobLineDto(w.Source, w.EquipmentId, "?", "?", w.Count, false, StageTrackErrorCodes.EntityNotFound);
                }

                var problem = item.IsArchived ? StageTrackErrorCodes.EntityNotFound
                    : !item.ShowInQuotes ? StageTrackErrorCodes.EquipmentNotQuotable
                    : w.Source == LedJobLineSource.Processor && roles.GetValueOrDefault(w.EquipmentId) != LedRole.Processor
                        ? StageTrackErrorCodes.LedNotAProcessor
                        : null;
                return new LedJobLineDto(w.Source, item.Id, item.Code, item.Name, w.Count, false, problem);
            })
            .OrderBy(l => l.Source)
            .ThenBy(l => l.Code)
            .ToList();
    }

    /// <summary>
    /// Where the lines go: the section asked for, or one named after the LED screen. Sending the same screen over
    /// again replaces that section's lines instead of doubling them, unless the caller asked to append.
    /// </summary>
    private async Task<ProjectSection?> PrepareSectionAsync(Project project, LedToJobInput input)
    {
        if (input.SectionId is { } id)
        {
            var existing = project.Sections.FirstOrDefault(s => s.Id == id) ?? throw new BusinessException(StageTrackErrorCodes.SectionNotFound);
            if (!input.Append)
            {
                ClearSection(project, existing.Id);
            }

            return existing;
        }

        var name = string.IsNullOrWhiteSpace(input.SectionName) ? localizer["Led.JobSection"].Value : input.SectionName.Trim();
        var match = project.Sections.FirstOrDefault(s => s.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
        if (match is not null)
        {
            if (!input.Append)
            {
                ClearSection(project, match.Id);
            }

            return match;
        }

        var section = project.AddSection(name, null);
        await unitOfWork.SaveChangesAsync();
        return section;
    }

    private static void ClearSection(Project project, Guid sectionId)
    {
        foreach (var line in project.Equipment.Where(e => e.SectionId == sectionId && e.ParentLineId == null).ToList())
        {
            project.RemoveEquipment(line.Id);
        }
    }

    private static LedToJobResultDto Result(Project project, LedToJobInput input, IReadOnlyList<LedJobLineDto> lines) =>
        new(project.Id,
            input.SectionId,
            input.SectionId is { } id ? project.Sections.FirstOrDefault(s => s.Id == id)?.Name ?? string.Empty : input.SectionName ?? string.Empty,
            lines);

    private static Dictionary<Guid, int> Totals(IEnumerable<LedJobItemRequest>? items) =>
        (items ?? []).Where(i => i.Count > 0).GroupBy(i => i.EquipmentId).ToDictionary(g => g.Key, g => g.Sum(i => i.Count));

    private static void Validate(LedToJobInput input)
    {
        var ok = input.Screens.Count <= LedRequestGuard.MaxScreens
                 && input.Screens.All(s => s.Columns is >= 0 and <= LedRequestGuard.MaxPanelsPerSide
                                           && s.Rows is >= 0 and <= LedRequestGuard.MaxPanelsPerSide
                                           && (s.Cutouts is null || s.Cutouts.Count <= LedRequestGuard.MaxCutouts)
                                           && (s.Corners is null || s.Corners.Count <= LedRequestGuard.MaxCorners))
                 && new[] { input.Processors, input.Extenders, input.Equipment }
                     .All(list => list.Count <= 500 && list.All(i => i.Count is >= 0 and <= 100_000));
        if (!ok)
        {
            throw new BusinessException(StageTrackErrorCodes.LedInvalidRequest);
        }
    }
}
