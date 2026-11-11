using StageTrack.Projects;
using StageTrack.Repositories;

namespace StageTrack.Inventory;

/// <summary>A content line with the equipment and device it points at, as the screens need it.</summary>
public sealed record CaseContentItem(CaseContent Line, Equipment Equipment, EquipmentUnit? Unit);

/// <summary>
/// The rules of a case: what it may be, what may go into it, and what has to be true before it can be
/// emptied or archived. A case is one physical box, so everything here is about that one box - never about
/// a model or a quantity in stock.
/// </summary>
public class CaseManager(
    IEquipmentRepository equipmentRepository,
    IEquipmentUnitRepository unitRepository,
    ICaseContentRepository contentRepository,
    IProjectRepository projectRepository)
{
    /// <summary>A case is a single box: never serial-tracked, always one in stock.</summary>
    public static void ApplyCaseRules(Equipment equipment)
    {
        if (equipment.Type != EquipmentType.Case)
        {
            return;
        }

        equipment.SetSerialized(false);
        equipment.SetStockQuantity(1);
    }

    /// <summary>
    /// A case cannot become something else while it still holds things, and nothing else can become a case
    /// while it has devices of its own - those two models of "what is this thing" cannot both be true.
    /// </summary>
    public async Task EnsureTypeChangeAllowedAsync(Equipment equipment, EquipmentType newType)
    {
        if (equipment.Type == newType)
        {
            return;
        }

        if (equipment.Type == EquipmentType.Case && (await contentRepository.GetListByCaseAsync(equipment.Id)).Count > 0)
        {
            throw new BusinessException(StageTrackErrorCodes.CaseNotEmpty).WithData("code", equipment.Code);
        }

        if (newType == EquipmentType.Case)
        {
            if (await unitRepository.AnyForEquipmentAsync(equipment.Id))
            {
                throw new BusinessException(StageTrackErrorCodes.CaseHasUnits).WithData("code", equipment.Code);
            }

            if (equipment.Relations.Any(r => r.Kind == EquipmentRelationKind.Content))
            {
                throw new BusinessException(StageTrackErrorCodes.CaseHasDefaultContent).WithData("code", equipment.Code);
            }
        }
    }

    /// <summary>
    /// Puts something in the case. A device goes in by name and may be in one case only; everything else goes
    /// in by count, and asking twice for the same equipment raises the count instead of adding a second line.
    /// </summary>
    public async Task<CaseContent> AddAsync(Equipment caseEquipment, Guid equipmentId, Guid? unitId, int quantity)
    {
        EnsureIsCase(caseEquipment);
        if (equipmentId == caseEquipment.Id)
        {
            throw new BusinessException(StageTrackErrorCodes.RelationSelf);
        }

        var equipment = await equipmentRepository.GetAsync(equipmentId, includeDetails: false);
        if (equipment.Type == EquipmentType.Case)
        {
            // A case inside a case would make "what is where" a question with two answers.
            throw new BusinessException(StageTrackErrorCodes.CaseInsideCase).WithData("code", equipment.Code);
        }

        var lines = await contentRepository.GetListByCaseAsync(caseEquipment.Id);
        var next = lines.Select(l => l.SortOrder).DefaultIfEmpty(0).Max() + 1;

        if (equipment.IsSerialized)
        {
            if (unitId is not { } id)
            {
                throw new BusinessException(StageTrackErrorCodes.CaseNeedsUnit).WithData("code", equipment.Code);
            }

            var unit = await unitRepository.GetAsync(id, includeDetails: false);
            if (unit.EquipmentId != equipment.Id)
            {
                throw new BusinessException(StageTrackErrorCodes.CaseUnitMismatch).WithData("unit", unit.InternalRef);
            }

            if (await contentRepository.FindByUnitAsync(id) is { } other)
            {
                var holder = await equipmentRepository.FindAsync(other.CaseEquipmentId, includeDetails: false);
                throw new BusinessException(StageTrackErrorCodes.CaseUnitTaken)
                    .WithData("unit", unit.InternalRef)
                    .WithData("case", holder?.Name ?? "?");
            }

            EnsureUnitFree(unit, await DescribeProjectAsync(unit.CurrentProjectId));

            return new CaseContent(Guid.CreateVersion7(), caseEquipment.Id, equipment.Id, id, 1, next);
        }

        if (lines.FirstOrDefault(l => l.EquipmentId == equipmentId && l.UnitId is null) is { } existing)
        {
            existing.SetQuantity(existing.Quantity + Math.Max(1, quantity));
            return existing;
        }

        return new CaseContent(Guid.CreateVersion7(), caseEquipment.Id, equipment.Id, null, quantity, next);
    }

    /// <summary>
    /// Only a device standing in the warehouse can be packed. One that is out on a job, in repair or lost is
    /// refused by name and with its reason, whether it was picked from the list or scanned at the case.
    /// </summary>
    /// <param name="onProjectName">The job it is out on, for the message; resolved by the caller.</param>
    public static void EnsureUnitFree(EquipmentUnit unit, string? onProjectName)
    {
        if (unit.Status == UnitStatus.OnProject || unit.CurrentProjectId.HasValue)
        {
            throw new BusinessException(StageTrackErrorCodes.CaseUnitOnProject)
                .WithData("unit", unit.InternalRef)
                .WithData("project", onProjectName ?? "?");
        }

        if (unit.Status != UnitStatus.InStock)
        {
            throw new BusinessException(StageTrackErrorCodes.CaseUnitNotAvailable)
                .WithData("unit", unit.InternalRef)
                .WithData("status", unit.Status.ToString());
        }
    }

    /// <summary>"number - name" of a job, for the messages that have to name it.</summary>
    public async Task<string?> DescribeProjectAsync(Guid? projectId)
    {
        if (projectId is not { } id)
        {
            return null;
        }

        var project = await projectRepository.FindAsync(id, includeDetails: false);
        return project is null ? null : $"{project.Number} \u00b7 {project.Name}";
    }

    /// <summary>
    /// Emptying a case that is standing in the warehouse is housekeeping; emptying one that is on a job loses
    /// track of what went out, so it is refused while the case is out.
    /// </summary>
    public static void EnsureNotOut(Equipment caseEquipment, bool isOut)
    {
        if (isOut)
        {
            throw new BusinessException(StageTrackErrorCodes.CaseIsOut).WithData("code", caseEquipment.Code);
        }
    }

    private static void EnsureIsCase(Equipment equipment)
    {
        if (equipment.Type != EquipmentType.Case)
        {
            throw new BusinessException(StageTrackErrorCodes.NotACase).WithData("code", equipment.Code);
        }
    }
}
