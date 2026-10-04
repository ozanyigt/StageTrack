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

    public List<ScanWarning> Warnings { get; init; } = [];
}

/// <summary>
/// Check-out and check-in by label scan. Works with existing Rentman labels because the label is
/// resolved through <see cref="LabelManager"/>; an unknown label raises Label.NotFound so the client
/// can offer to link it on the spot.
/// </summary>
public class WarehouseManager(
    LabelManager labelManager,
    IWarehouseMovementRepository movementRepository,
    IProjectRepository projectRepository)
{
    public async Task<(ScanOutcome Outcome, WarehouseMovement? Movement)> ScanAsync(
        Project project, string? rawCode, ScanDirection direction, Guid? userId)
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
        if (unit is null && equipment.IsSerialized)
        {
            throw new BusinessException(StageTrackErrorCodes.WarehouseSerializedNeedsUnitLabel).WithData("equipment", equipment.Name);
        }

        var balances = await movementRepository.GetBalancesAsync(project.Id);
        var outBefore = balances.FirstOrDefault(b => b.EquipmentId == equipment.Id)?.Out ?? 0;
        var planned = project.GetPlannedQuantity(equipment.Id);

        if (unit is not null && direction == ScanDirection.Out && unit.CurrentProjectId == project.Id)
        {
            return (BuildOutcome(direction, equipment, unit, target.Label.Code, planned, outBefore, alreadyScanned: true), null);
        }

        if (direction == ScanDirection.Out)
        {
            if (unit is not null)
            {
                await EnsureCanCheckOutAsync(unit);
                unit.CheckOut(project.Id);
            }
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
            direction == ScanDirection.Out ? MovementAction.CheckOut : MovementAction.CheckIn,
            equipment.Id, unit?.Id, project.Id, 1, target.Label.Code, userId);

        var outAfter = outBefore + (direction == ScanDirection.Out ? 1 : -1);
        return (BuildOutcome(direction, equipment, unit, target.Label.Code, planned, outAfter, alreadyScanned: false), movement);
    }

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
