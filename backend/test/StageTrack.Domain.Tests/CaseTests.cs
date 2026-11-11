using StageTrack.Inventory;
using Xunit;

namespace StageTrack.Domain.Tests;

/// <summary>
/// What a case is allowed to be. A case is one physical box, so the answers that make sense for a product
/// type - how many are in stock, are they serial-tracked - do not apply to it, and what it weighs is what is
/// inside it.
/// </summary>
public class CaseTests
{
    private static Equipment Case() => Make(EquipmentType.Case);

    private static Equipment Make(EquipmentType type)
    {
        var equipment = (Equipment)Activator.CreateInstance(typeof(Equipment), true)!;
        typeof(Equipment).GetProperty(nameof(Equipment.Type))!.SetValue(equipment, type);
        return equipment;
    }

    [Fact]
    public void A_case_is_one_box_never_serial_tracked()
    {
        var box = Case();
        box.SetSerialized(true);
        box.SetStockQuantity(7);

        CaseManager.ApplyCaseRules(box);

        Assert.False(box.IsSerialized);
        Assert.Equal(1, box.StockQuantity);
    }

    [Fact]
    public void Other_equipment_keeps_the_answers_it_was_given()
    {
        var equipment = Make(EquipmentType.Physical);
        equipment.SetSerialized(true);
        equipment.SetStockQuantity(7);

        CaseManager.ApplyCaseRules(equipment);

        Assert.True(equipment.IsSerialized);
        Assert.Equal(7, equipment.StockQuantity);
    }

    [Fact]
    public void A_case_on_a_job_is_not_opened()
    {
        var box = Case();

        Assert.Throws<BusinessException>(() => CaseManager.EnsureNotOut(box, isOut: true));
        CaseManager.EnsureNotOut(box, isOut: false);
    }

    [Fact]
    public void A_device_line_is_one_device()
    {
        var line = new CaseContent(Guid.CreateVersion7(), Guid.CreateVersion7(), Guid.CreateVersion7(), Guid.CreateVersion7(), 5, 1);

        // The quantity it was handed is ignored: a case holds TR-003 once or not at all.
        Assert.Equal(1, line.Quantity);
        Assert.Throws<BusinessException>(() => line.SetQuantity(2));
    }

    [Fact]
    public void A_counted_line_can_be_changed()
    {
        var line = new CaseContent(Guid.CreateVersion7(), Guid.CreateVersion7(), Guid.CreateVersion7(), null, 8, 1);
        Assert.Equal(8, line.Quantity);

        line.SetQuantity(12);
        Assert.Equal(12, line.Quantity);

        // Nothing goes below one piece; removing a line is how a line disappears.
        line.SetQuantity(0);
        Assert.Equal(1, line.Quantity);
    }

    [Fact]
    public void A_case_weighs_its_own_weight_plus_what_is_in_it()
    {
        decimal?[] weights = [18m, 7.5m, null];
        var contents = new (decimal? WeightKg, int Quantity)[] { (weights[1], 2), (weights[2], 4), (3m, 1) };

        var weight = CaseWeight.Of(weights[0], contents);

        // 18 empty + 2 x 7,5 + 4 x (unknown = 0) + 1 x 3
        Assert.Equal(36m, weight.TotalKg);
    }

    [Fact]
    public void A_case_says_how_many_of_its_lines_have_no_weight()
    {
        var contents = new (decimal? WeightKg, int Quantity)[] { (7.5m, 2), (null, 4), (null, 1), (3m, 1) };

        var weight = CaseWeight.Of(18m, contents);

        // Two lines have no weight, so 36 kg is a floor and not the answer.
        Assert.Equal(2, weight.UnknownLines);
        Assert.True(weight.IsAtLeast);
    }

    [Fact]
    public void A_case_whose_contents_are_all_weighed_says_so()
    {
        var weight = CaseWeight.Of(18m, [(7.5m, 2), (3m, 1)]);

        Assert.Equal(0, weight.UnknownLines);
        Assert.False(weight.IsAtLeast);
    }

    [Fact]
    public void An_empty_case_weighs_what_the_box_weighs()
    {
        Assert.Equal(18m, CaseWeight.Of(18m, []).TotalKg);
        Assert.Equal(0m, CaseWeight.Of(null, []).TotalKg);
        Assert.False(CaseWeight.Of(null, []).IsAtLeast);
    }

    [Fact]
    public void Only_a_device_standing_in_the_warehouse_can_be_packed()
    {
        CaseManager.EnsureUnitFree(Unit(UnitStatus.InStock), null);

        Assert.Throws<BusinessException>(() => CaseManager.EnsureUnitFree(Unit(UnitStatus.InRepair), null));
        Assert.Throws<BusinessException>(() => CaseManager.EnsureUnitFree(Unit(UnitStatus.Lost), null));
        Assert.Throws<BusinessException>(() => CaseManager.EnsureUnitFree(Unit(UnitStatus.OnProject), "2393"));
    }

    [Fact]
    public void A_device_still_pointing_at_a_job_is_not_packed_either()
    {
        // Its status says in stock but it was never checked back in; the job wins.
        var unit = Unit(UnitStatus.InStock, Guid.CreateVersion7());

        Assert.Throws<BusinessException>(() => CaseManager.EnsureUnitFree(unit, "2393"));
    }

    private static EquipmentUnit Unit(UnitStatus status, Guid? projectId = null)
    {
        var unit = (EquipmentUnit)Activator.CreateInstance(typeof(EquipmentUnit), true)!;
        typeof(EquipmentUnit).GetProperty(nameof(EquipmentUnit.Status))!.SetValue(unit, status);
        typeof(EquipmentUnit).GetProperty(nameof(EquipmentUnit.CurrentProjectId))!.SetValue(unit, projectId);
        typeof(EquipmentUnit).GetProperty(nameof(EquipmentUnit.InternalRef))!.SetValue(unit, "VID063 001");
        return unit;
    }
}
