using StageTrack.Inventory;
using StageTrack.Projects;
using StageTrack.Quotes;
using StageTrack.Repositories;

namespace StageTrack.Sites;

/// <summary>
/// The point of planning on a map inside an inventory system: what was drawn becomes what is reserved. Six towers
/// placed on the ground become six towers planned on the job, which reserve stock, print on the packing list, are
/// scanned out of the warehouse and — because a draft quote follows the job — land on the quote at the firm's own
/// prices. A drawing tool stops at the picture.
/// </summary>
public class SiteJobAppService(
    ISitePlanRepository planRepository,
    IProjectRepository projectRepository,
    IEquipmentRepository equipmentRepository,
    ProjectManager projectManager,
    QuoteManager quoteManager,
    IUnitOfWork unitOfWork) : ISiteJobAppService
{
    public async Task<SiteToJobResultDto> PreviewAsync(Guid planId, SiteToJobInput input)
    {
        var plan = await planRepository.GetAsync(planId);
        var project = await projectRepository.GetAsync(plan.ProjectId);
        return new SiteToJobResultDto(project.Id, input.SectionId, SectionNameOf(plan, project, input), await BuildAsync(plan, input));
    }

    public async Task<SiteToJobResultDto> TransferAsync(Guid planId, SiteToJobInput input)
    {
        var plan = await planRepository.GetAsync(planId);
        var project = await projectRepository.GetAsync(plan.ProjectId);
        var lines = await BuildAsync(plan, input);

        var section = await PrepareSectionAsync(project, SectionNameOf(plan, project, input), input);
        var planned = new List<SiteToJobLineDto>();
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
                // One item the job will not take must not lose the rest of the site.
                planned.Add(line with { Problem = e.Code });
            }
        }

        await unitOfWork.SaveChangesAsync();
        await quoteManager.SyncDraftAsync(project);
        await unitOfWork.SaveChangesAsync();

        return new SiteToJobResultDto(project.Id, section?.Id, section?.Name ?? string.Empty, planned);
    }

    /// <summary>
    /// What the job takes: each equipment on the plan once, with everything standing on the map added up. Plain
    /// markers are not inventory and plan nothing.
    /// </summary>
    private async Task<List<SiteToJobLineDto>> BuildAsync(SitePlan plan, SiteToJobInput input)
    {
        var wanted = plan.Items
            .Where(i => i.EquipmentId.HasValue)
            .Where(i => input.Layers.Count == 0 || (i.Layer is not null && input.Layers.Contains(i.Layer, StringComparer.OrdinalIgnoreCase)))
            .GroupBy(i => i.EquipmentId!.Value)
            .ToDictionary(g => g.Key, g => g.Sum(i => i.Quantity));

        var equipment = (await equipmentRepository.GetListByIdsAsync(wanted.Keys)).ToDictionary(e => e.Id);
        var stock = await equipmentRepository.GetStockQuantitiesAsync(wanted.Keys.ToList());

        return wanted
            .Select(pair =>
            {
                if (!equipment.TryGetValue(pair.Key, out var item))
                {
                    return new SiteToJobLineDto(pair.Key, "?", "?", pair.Value, 0, false, StageTrackErrorCodes.EntityNotFound);
                }

                var problem = item.IsArchived ? StageTrackErrorCodes.EntityNotFound
                    : !item.ShowInQuotes ? StageTrackErrorCodes.EquipmentNotQuotable
                    : null;
                return new SiteToJobLineDto(item.Id, item.Code, item.Name, pair.Value, stock.GetValueOrDefault(item.Id), false, problem);
            })
            .OrderBy(l => l.Code)
            .ToList();
    }

    private static string SectionNameOf(SitePlan plan, Project project, SiteToJobInput input)
    {
        if (!string.IsNullOrWhiteSpace(input.SectionName))
        {
            return input.SectionName.Trim();
        }

        return input.SectionId is { } id
            ? project.Sections.FirstOrDefault(s => s.Id == id)?.Name ?? plan.Name
            : plan.Name;
    }

    /// <summary>
    /// Where the lines go. Sending the same plan over again replaces that section instead of doubling it — what a
    /// user expects after moving a few towers — unless they asked to append.
    /// </summary>
    private async Task<ProjectSection?> PrepareSectionAsync(Project project, string name, SiteToJobInput input)
    {
        var section = input.SectionId is { } id
            ? project.Sections.FirstOrDefault(s => s.Id == id) ?? throw new BusinessException(StageTrackErrorCodes.SectionNotFound)
            : project.Sections.FirstOrDefault(s => s.Name.Equals(name, StringComparison.OrdinalIgnoreCase));

        if (section is null)
        {
            var created = project.AddSection(name, null);
            await unitOfWork.SaveChangesAsync();
            return created;
        }

        if (!input.Append)
        {
            foreach (var line in project.Equipment.Where(e => e.SectionId == section.Id && e.ParentLineId == null).ToList())
            {
                project.RemoveEquipment(line.Id);
            }
        }

        return section;
    }
}
