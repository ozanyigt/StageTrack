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

/// <summary>
/// What a case weighs, and how much of that is known. A content line whose equipment has no weight counts as
/// zero, which makes the total a floor rather than the weight - so the number of such lines travels with it
/// and whoever shows or loads the case can say "at least".
/// </summary>
/// <param name="TotalKg">The empty box plus every line whose weight is known.</param>
/// <param name="UnknownLines">Lines whose equipment has no weight entered.</param>
public sealed record CaseWeightSummary(decimal TotalKg, int UnknownLines)
{
    /// <summary>True when something inside has no weight, so <see cref="TotalKg"/> is a lower bound.</summary>
    public bool IsAtLeast => UnknownLines > 0;
}

/// <summary>What a case weighs: the empty box plus everything in it.</summary>
public static class CaseWeight
{
    /// <param name="emptyWeightKg">The case's own weight, empty.</param>
    /// <param name="contents">Each line's weight per piece and how many pieces; a missing weight counts as zero.</param>
    public static CaseWeightSummary Of(decimal? emptyWeightKg, IEnumerable<(decimal? WeightKg, int Quantity)> contents)
    {
        var lines = contents as IReadOnlyCollection<(decimal? WeightKg, int Quantity)> ?? contents.ToList();
        return new CaseWeightSummary(
            (emptyWeightKg ?? 0) + lines.Sum(c => (c.WeightKg ?? 0) * Math.Max(0, c.Quantity)),
            lines.Count(c => c.WeightKg is null));
    }
}
