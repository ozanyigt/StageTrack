using StageTrack.Led;
using Xunit;

namespace StageTrack.Application.Tests;

/// <summary>
/// What a job asks of the inventory. Counting is the part that decides how many cases travel and how much stock a
/// job eats, so it is checked against the shapes the screens can take.
/// </summary>
public class LedJobTests
{
    private static readonly Guid Panel = Guid.CreateVersion7();
    private static readonly Guid CornerPanel = Guid.CreateVersion7();

    private static EvaluateScreenRequest Screen(int columns, int rows, IReadOnlyList<CutoutDto>? cutouts = null,
        IReadOnlyList<CornerDto>? corners = null) =>
        new("s1", Panel, columns, rows, Cutouts: cutouts, Corners: corners);

    [Fact]
    public void A_plain_screen_needs_columns_times_rows_panels()
    {
        var counted = LedTransportAppService.PanelsByEquipment([Screen(10, 6)]);

        Assert.Equal(60, counted[Panel]);
    }

    [Fact]
    public void A_cut_out_area_is_not_carried()
    {
        var counted = LedTransportAppService.PanelsByEquipment([Screen(10, 6, [new CutoutDto(2, 2, 0, 0)])]);

        Assert.Equal(56, counted[Panel]);
    }

    [Fact]
    public void A_corner_column_is_counted_towards_its_own_model()
    {
        var counted = LedTransportAppService.PanelsByEquipment([Screen(10, 6, corners: [new CornerDto(3, CornerPanel)])]);

        Assert.Equal(54, counted[Panel]);
        Assert.Equal(6, counted[CornerPanel]);
    }

    [Fact]
    public void Several_screens_of_the_same_panel_add_up()
    {
        var counted = LedTransportAppService.PanelsByEquipment([
            Screen(10, 6),
            new EvaluateScreenRequest("s2", Panel, 4, 3)
        ]);

        Assert.Equal(72, counted[Panel]);
    }

    [Fact]
    public void A_screen_without_a_panel_or_without_size_carries_nothing()
    {
        var counted = LedTransportAppService.PanelsByEquipment([
            new EvaluateScreenRequest("s1", null, 10, 6),
            new EvaluateScreenRequest("s2", Panel, 0, 6),
            new EvaluateScreenRequest("s3", Panel, 10, 0)
        ]);

        Assert.Empty(counted);
    }
}
