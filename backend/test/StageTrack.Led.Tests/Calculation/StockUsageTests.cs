using StageTrack.Led.Calculation;

namespace StageTrack.Led.Tests.Calculation;

/// <summary>Stok Durumu: panels the job uses, per stock line (model × location).</summary>
public sealed class StockUsageTests
{
    private static readonly Guid Model = Guid.NewGuid();
    private static readonly Guid CornerModel = Guid.NewGuid();
    private static readonly Guid Istanbul = Guid.NewGuid();
    private static readonly Guid Dubai = Guid.NewGuid();

    private static StockScreenUse Screen(Guid model, Guid location, int columns, int rows, Cutout[]? cutouts = null, StockCornerUse[]? corners = null) =>
        new(new StockKey(model, location), columns, rows, cutouts ?? [], corners ?? []);

    [Fact]
    public void EveryPanelOfAScreen_CountsForItsModelInItsLocation()
    {
        var used = StockUsage.Count([Screen(Model, Istanbul, 10, 5), Screen(Model, Istanbul, 4, 5), Screen(Model, Dubai, 2, 2)]);
        Assert.Equal(70, used[new StockKey(Model, Istanbul)]);
        Assert.Equal(4, used[new StockKey(Model, Dubai)]);
    }

    [Fact]
    public void CutPanels_AreNotUsed()
    {
        // A 2 × 2 door at the bottom of a 10 × 5 screen.
        var used = StockUsage.Count([Screen(Model, Istanbul, 10, 5, [new Cutout(2, 2, 4, 0)])]);
        Assert.Equal(46, used[new StockKey(Model, Istanbul)]);
    }

    [Fact]
    public void CornerColumns_CountForTheCornerModelAndItsLocation()
    {
        // 6 columns, one a corner column from Dubai; its top panel cut.
        var corner = new StockCornerUse(3, new StockKey(CornerModel, Dubai));
        var used = StockUsage.Count([Screen(Model, Istanbul, 6, 4, [new Cutout(1, 1, 3, 3)], [corner])]);
        Assert.Equal(20, used[new StockKey(Model, Istanbul)]);
        Assert.Equal(3, used[new StockKey(CornerModel, Dubai)]);
    }

    [Fact]
    public void AnEmptyScreen_UsesNothing()
    {
        Assert.Empty(StockUsage.Count([Screen(Model, Istanbul, 0, 5)]));
        Assert.Empty(StockUsage.Count([]));
    }
}
