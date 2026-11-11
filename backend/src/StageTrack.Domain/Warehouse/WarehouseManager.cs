using StageTrack.Inventory;
using StageTrack.Projects;

namespace StageTrack.Warehouse;

public class ScanOutcome
{
    public required ScanDirection Direction { get; init; }
    public required Equipment Equipment { get; init; }
    public EquipmentUnit? Unit { get; init; }
    public required string LabelCode { get; init; }
    public int PlannedQuantity { get; init; }
    public int OutQuantity { get; init; }

    /// <summary>True when the device was already scanned out for this project; nothing was changed.</summary>
    public bool AlreadyScanned { get; init; }

    /// <summary>
    /// Not planned (or more than planned): nothing was changed; the warehouse must confirm, then the item is added to
    /// the project's "added products" section.
    /// </summary>
    public bool RequiresConfirmation { get; init; }

    public List<ScanWarning> Warnings { get; init; } = [];

    /// <summary>The case the scanned device is packed in; set with <see cref="ScanWarning.InsideCase"/>.</summary>
    public string? CaseName { get; init; }

    /// <summary>What happened to each line of a scanned case; empty for a normal scan.</summary>
    public List<CaseScanLine> CaseLines { get; init; } = [];
}

/// <summary>One line of a scanned case, as the screen reports it back.</summary>
public sealed record CaseScanLine(string Label, int Quantity, bool Moved, CaseScanSkipReason? Reason);

/// <summary>
/// Everything one scan wants written: the answer for the screen, the log lines, and - when a device was taken
/// out of its case to be scanned on its own - the content row that no longer holds.
/// </summary>
public sealed record ScanEffects(ScanOutcome Outcome, IReadOnlyList<WarehouseMovement> Movements, CaseContent? RemovedFromCase = null);

/// <summary>
/// Check-out and check-in by label scan. Works with existing Rentman labels because the label is
/// resolved through <see cref="LabelManager"/>; an unknown label raises Label.NotFound so the client
/// can offer to link it on the spot.
/// </summary>
public class WarehouseManager(
    LabelManager labelManager,
    IWarehouseMovementRepository movementRepository,
    IProjectRepository projectRepository,
    IEquipmentRepository equipmentRepository,
    IEquipmentUnitRepository unitRepository,
    ICaseContentRepository caseContentRepository)
{
    /// <param name="allowUnplanned">The warehouse confirmed an item that is not on the quote.</param>
    /// <param name="takeOutOfCase">The warehouse confirmed scanning a device out of the case it is packed in.</param>
    /// <param name="allowPartial">The warehouse confirmed sending a case out without everything in it.</param>
    public async Task<ScanEffects> ScanAsync(
        Project project, string? rawCode, ScanDirection direction, Guid? userId,
        bool allowUnplanned = false, bool takeOutOfCase = false, bool allowPartial = false)
    {
        if (!ProjectStatusRules.Scannable.Contains(project.Status))
        {
            throw new BusinessException(StageTrackErrorCodes.WarehouseProjectNotScannable).WithData("status", project.Status);
        }

        var target = await labelManager.ResolveAsync(rawCode);
        if (target is null)
        {
            throw new BusinessException(StageTrackErrorCodes.LabelNotFound).WithData("code", LabelManager.Normalize(rawCode));
        }

        var equipment = target.Equipment;
        var unit = target.Unit;

        if (equipment.Type == EquipmentType.Case)
        {
            return await ScanCaseAsync(project, equipment, target.Label.Code, direction, userId, allowUnplanned, allowPartial);
        }

        // A device that is packed in a case does not leave on its own by accident.
        CaseContent? removedFromCase = null;
        if (unit is not null && await caseContentRepository.FindByUnitAsync(unit.Id) is { } packed)
        {
            var box = await equipmentRepository.FindAsync(packed.CaseEquipmentId, includeDetails: false);
            if (!takeOutOfCase)
            {
                return new ScanEffects(
                    Pending(direction, equipment, unit, target.Label.Code, 0, 0, ScanWarning.InsideCase, box?.Name),
                    []);
            }

            removedFromCase = packed;
        }

        if (unit is null && equipment.IsSerialized)
        {
            throw new BusinessException(StageTrackErrorCodes.WarehouseSerializedNeedsUnitLabel).WithData("equipment", equipment.Name);
        }

        var balances = await movementRepository.GetBalancesAsync(project.Id);
        var outBefore = balances.FirstOrDefault(b => b.EquipmentId == equipment.Id)?.Out ?? 0;
        var planned = project.GetPlannedQuantity(equipment.Id);

        if (unit is not null && direction == ScanDirection.Out && unit.CurrentProjectId == project.Id)
        {
            return new ScanEffects(BuildOutcome(direction, equipment, unit, target.Label.Code, planned, outBefore, alreadyScanned: true), []);
        }

        if (direction == ScanDirection.Out)
        {
            if (unit is not null)
            {
                await EnsureCanCheckOutAsync(unit);
            }

            if (outBefore + 1 > planned)
            {
                if (!allowUnplanned)
                {
                    var warning = planned == 0 ? ScanWarning.NotPlanned : ScanWarning.OverPlanned;
                    return new ScanEffects(
                        Pending(direction, equipment, unit, target.Label.Code, planned, outBefore, warning),
                        []);
                }

                project.AddWarehouseExtra(equipment.Id);
                planned = project.GetPlannedQuantity(equipment.Id);
            }

            unit?.CheckOut(project.Id);
        }
        else if (unit is not null)
        {
            if (unit.CurrentProjectId != project.Id)
            {
                throw new BusinessException(StageTrackErrorCodes.WarehouseUnitNotOnThisProject).WithData("unit", unit.InternalRef);
            }

            unit.CheckIn();
        }
        else if (outBefore <= 0)
        {
            throw new BusinessException(StageTrackErrorCodes.WarehouseNothingToReturn).WithData("equipment", equipment.Name);
        }

        var movement = new WarehouseMovement(
            Guid.CreateVersion7(),
            direction == ScanDirection.Out ? MovementAction.CheckedOut : MovementAction.CheckedIn,
            equipment.Id, unit?.Id, project.Id, 1, target.Label.Code, userId);

        var outAfter = outBefore + (direction == ScanDirection.Out ? 1 : -1);
        return new ScanEffects(
            BuildOutcome(direction, equipment, unit, target.Label.Code, planned, outAfter, alreadyScanned: false),
            [movement],
            removedFromCase);
    }

    /// <summary>
    /// A case goes out and comes back as one thing: the box gets its own movement and everything in it gets
    /// its own line beside it, so a device's job history says it was on the job even though nobody scanned it.
    /// What can and cannot travel is decided by <see cref="CaseScanPlan"/>; a case that cannot go out whole is
    /// a question first and a scan second.
    /// </summary>
    private async Task<ScanEffects> ScanCaseAsync(Project project, Equipment box, string labelCode,
        ScanDirection direction, Guid? userId, bool allowUnplanned, bool allowPartial)
    {
        var balances = await movementRepository.GetBalancesAsync(project.Id);
        var outBefore = balances.FirstOrDefault(b => b.EquipmentId == box.Id)?.Out ?? 0;
        var planned = project.GetPlannedQuantity(box.Id);

        if (direction == ScanDirection.Out && outBefore + 1 > planned && !allowUnplanned)
        {
            var warning = planned == 0 ? ScanWarning.NotPlanned : ScanWarning.OverPlanned;
            return new ScanEffects(Pending(direction, box, null, labelCode, planned, outBefore, warning), []);
        }

        if (direction == ScanDirection.In && outBefore <= 0)
        {
            throw new BusinessException(StageTrackErrorCodes.WarehouseNothingToReturn).WithData("equipment", box.Name);
        }

        var lines = await caseContentRepository.GetListByCaseAsync(box.Id);
        var units = (await unitRepository.GetListByIdsAsync(lines.Where(l => l.UnitId.HasValue).Select(l => l.UnitId!.Value)))
            .ToDictionary(u => u.Id);
        var contentEquipment = (await equipmentRepository.GetListByIdsAsync(lines.Select(l => l.EquipmentId).Distinct()))
            .ToDictionary(e => e.Id);

        var state = lines.Select(line =>
        {
            var unit = line.UnitId.HasValue ? units.GetValueOrDefault(line.UnitId.Value) : null;
            return new CaseLineState(
                line.EquipmentId,
                line.UnitId,
                contentEquipment.GetValueOrDefault(line.EquipmentId)?.Name ?? "?",
                unit?.InternalRef,
                line.Quantity,
                unit?.Status ?? UnitStatus.InStock,
                unit?.CurrentProjectId,
                balances.FirstOrDefault(b => b.EquipmentId == line.EquipmentId)?.Out ?? 0);
        }).ToList();

        var plan = CaseScanPlan.Build(direction, project.Id, state);

        if (direction == ScanDirection.Out && plan.Blocking.Count > 0 && !allowPartial)
        {
            var pending = Pending(direction, box, null, labelCode, planned, outBefore,
                ScanWarning.CaseContentUnavailable, lines: Report(plan));
            return new ScanEffects(pending, []);
        }

        if (direction == ScanDirection.Out && outBefore + 1 > planned)
        {
            project.AddWarehouseExtra(box.Id);
            planned = project.GetPlannedQuantity(box.Id);
        }

        var action = direction == ScanDirection.Out ? MovementAction.CheckedOut : MovementAction.CheckedIn;
        var movements = new List<WarehouseMovement>
        {
            new(Guid.CreateVersion7(), action, box.Id, null, project.Id, 1, labelCode, userId)
        };

        foreach (var move in plan.Moves)
        {
            if (move.UnitId is { } unitId && units.TryGetValue(unitId, out var unit))
            {
                if (direction == ScanDirection.Out)
                {
                    unit.CheckOut(project.Id);
                }
                else
                {
                    unit.CheckIn();
                }
            }

            movements.Add(WarehouseMovement.CreateInCase(action, move.EquipmentId, move.UnitId, project.Id, move.Quantity, userId, box.Name));
        }

        var warnings = new List<ScanWarning>();
        if (direction == ScanDirection.Out && plan.Blocking.Count > 0)
        {
            warnings.Add(ScanWarning.CaseContentUnavailable);
        }

        if (direction == ScanDirection.In && plan.Missing.Count > 0)
        {
            warnings.Add(ScanWarning.CaseReturnIncomplete);
        }

        var outcome = new ScanOutcome
        {
            Direction = direction,
            Equipment = box,
            LabelCode = labelCode,
            PlannedQuantity = planned,
            OutQuantity = outBefore + (direction == ScanDirection.Out ? 1 : -1),
            Warnings = warnings,
            CaseLines = Report(plan)
        };

        return new ScanEffects(outcome, movements);
    }

    private static List<CaseScanLine> Report(CaseScanPlan plan) =>
    [
        .. plan.Moves.Select(m => new CaseScanLine(m.Label, m.Quantity, true, null)),
        .. plan.Skips.Select(s => new CaseScanLine(s.Label, 0, false, s.Reason))
    ];

    /// <summary>Nothing written: the screen asks the question and scans again with the answer.</summary>
    private static ScanOutcome Pending(ScanDirection direction, Equipment equipment, EquipmentUnit? unit, string labelCode,
        int planned, int outQuantity, ScanWarning warning, string? caseName = null, List<CaseScanLine>? lines = null) =>
        new()
        {
            Direction = direction,
            Equipment = equipment,
            Unit = unit,
            LabelCode = labelCode,
            PlannedQuantity = planned,
            OutQuantity = outQuantity,
            Warnings = [warning],
            RequiresConfirmation = true,
            CaseName = caseName,
            CaseLines = lines ?? []
        };

    /// <summary>Log line written when a label is linked from the scan screen.</summary>
    public WarehouseMovement CreateLabelAssignedMovement(EquipmentLabel label, Guid? userId) =>
        new(Guid.CreateVersion7(), MovementAction.LabelAssigned, label.EquipmentId, label.UnitId, null, 0, label.Code, userId);

    private async Task EnsureCanCheckOutAsync(EquipmentUnit unit)
    {
        switch (unit.Status)
        {
            case UnitStatus.InStock:
                return;
            case UnitStatus.OnProject:
                var other = unit.CurrentProjectId.HasValue
                    ? await projectRepository.FindAsync(unit.CurrentProjectId.Value, includeDetails: false)
                    : null;
                throw new BusinessException(StageTrackErrorCodes.WarehouseUnitOnAnotherProject)
                    .WithData("unit", unit.InternalRef)
                    .WithData("project", other is null ? "?" : $"{other.Number} - {other.Name}");
            default:
                throw new BusinessException(StageTrackErrorCodes.WarehouseUnitNotAvailable)
                    .WithData("unit", unit.InternalRef)
                    .WithData("status", unit.Status);
        }
    }

    private static ScanOutcome BuildOutcome(ScanDirection direction, Equipment equipment, EquipmentUnit? unit,
        string labelCode, int planned, int outQuantity, bool alreadyScanned)
    {
        var warnings = new List<ScanWarning>();
        if (direction == ScanDirection.Out && !alreadyScanned)
        {
            if (planned == 0)
            {
                warnings.Add(ScanWarning.NotPlanned);
            }
            else if (outQuantity > planned)
            {
                warnings.Add(ScanWarning.OverPlanned);
            }
        }

        return new ScanOutcome
        {
            Direction = direction,
            Equipment = equipment,
            Unit = unit,
            LabelCode = labelCode,
            PlannedQuantity = planned,
            OutQuantity = outQuantity,
            AlreadyScanned = alreadyScanned,
            Warnings = warnings
        };
    }
}
