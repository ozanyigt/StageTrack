using StageTrack.Entities;

namespace StageTrack.Inventory;

/// <summary>
/// One line of what is physically inside a case: a named device for serial-tracked equipment, a count for
/// everything else.
///
/// This is not the same thing as <see cref="EquipmentRelationKind.Content"/>. That one is a model's recipe -
/// "a roof system travels with twelve truss sections" - copied afresh onto every job. This one is the truth
/// about one box standing in the warehouse: the rack labelled FOH Rack 1 has TR-003 in it right now, and
/// nothing else may have it.
/// </summary>
public class CaseContent : CompanyAggregateRoot
{
    /// <summary>The case this line belongs to; equipment of type <see cref="EquipmentType.Case"/>.</summary>
    public Guid CaseEquipmentId { get; private set; }

    public Guid EquipmentId { get; private set; }

    /// <summary>The device, for serial-tracked equipment; null when the line is a count.</summary>
    public Guid? UnitId { get; private set; }

    /// <summary>Always 1 for a device; the number of pieces otherwise.</summary>
    public int Quantity { get; private set; }

    public int SortOrder { get; private set; }

    private CaseContent()
    {
    }

    internal CaseContent(Guid id, Guid caseEquipmentId, Guid equipmentId, Guid? unitId, int quantity, int sortOrder) : base(id)
    {
        CaseEquipmentId = caseEquipmentId;
        EquipmentId = equipmentId;
        UnitId = unitId;
        Quantity = unitId.HasValue ? 1 : Math.Max(1, quantity);
        SortOrder = sortOrder;
    }

    public void SetQuantity(int quantity)
    {
        if (UnitId.HasValue)
        {
            // A device is one device; a count here would mean the case holds TR-003 twice.
            throw new BusinessException(StageTrackErrorCodes.CaseUnitQuantityFixed);
        }

        Quantity = Math.Max(1, quantity);
    }

    public void SetSortOrder(int sortOrder) => SortOrder = sortOrder;
}

/// <summary>What a case weighs: the empty box plus everything in it.</summary>
public static class CaseWeight
{
    /// <param name="emptyWeightKg">The case's own weight, empty.</param>
    /// <param name="contents">Each line's weight per piece and how many pieces; a missing weight counts as zero.</param>
    public static decimal Of(decimal? emptyWeightKg, IEnumerable<(decimal? WeightKg, int Quantity)> contents) =>
        (emptyWeightKg ?? 0) + contents.Sum(c => (c.WeightKg ?? 0) * Math.Max(0, c.Quantity));
}
