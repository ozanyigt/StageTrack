using StageTrack.Sites;
using Xunit;

namespace StageTrack.Domain.Tests;

public class SitePlanTests
{
    private static readonly Guid Tower = Guid.CreateVersion7();
    private static readonly Guid Barrier = Guid.CreateVersion7();

    /// <summary>A hundred metres square, somewhere flat; the numbers below are checked against it.</summary>
    private static readonly SitePoint[] Square =
    [
        new(39.9000000, 32.8000000),
        new(39.9000000, 32.8011718), // ~100 m east at this latitude
        new(39.9008983, 32.8011718), // ~100 m north
        new(39.9008983, 32.8000000)
    ];

    private static SitePlan Plan() => new(Guid.CreateVersion7(), Guid.CreateVersion7(), "Field", 39.9, 32.8);

    [Fact]
    public void What_the_job_takes_is_every_placed_equipment_added_up()
    {
        var plan = Plan();
        plan.AddItem(Tower, null, 2, 39.9, 32.8, "Structures");
        plan.AddItem(Tower, null, 4, 39.9001, 32.8001, "Structures");
        plan.AddItem(Barrier, null, 30, 39.9002, 32.8002, "Public");
        plan.AddItem(null, "Ana giriş", 1, 39.9003, 32.8003, "Public");

        var totals = plan.EquipmentTotals();

        Assert.Equal(6, totals[Tower]);
        Assert.Equal(30, totals[Barrier]);
        // A plain marker is not inventory and plans nothing.
        Assert.Equal(2, totals.Count);
    }

    [Fact]
    public void An_item_must_be_equipment_or_at_least_say_what_it_is()
    {
        var plan = Plan();

        var error = Assert.Throws<BusinessException>(() => plan.AddItem(null, "  ", 1, 39.9, 32.8, null));
        Assert.Equal(StageTrackErrorCodes.SiteItemNeedsEquipmentOrLabel, error.Code);
    }

    [Fact]
    public void A_light_reaches_about_three_times_its_height_unless_told_otherwise()
    {
        var plan = Plan();
        var item = plan.AddItem(Tower, null, 1, 39.9, 32.8, "Lighting");

        item.SetLight(heightM: 8, intensity: 80, radiusM: null);
        Assert.Equal(24, item.EffectiveRadiusM);

        item.SetLight(heightM: 8, intensity: 80, radiusM: 15);
        Assert.Equal(15, item.EffectiveRadiusM);
    }

    [Fact]
    public void Clearing_the_height_makes_it_an_ordinary_item_again()
    {
        var plan = Plan();
        var item = plan.AddItem(Tower, null, 1, 39.9, 32.8, "Lighting");
        item.SetLight(8, 80, 15);

        item.SetLight(null, 80, 15);

        Assert.Null(item.LightHeightM);
        Assert.Null(item.LightIntensity);
        Assert.Null(item.EffectiveRadiusM);
    }

    [Fact]
    public void A_zone_keeps_its_corners_through_a_save_and_a_read()
    {
        var plan = Plan();
        var zone = plan.AddZone("Arena", SiteZoneKind.Area, Square, "#ff0000", "Public");

        var read = zone.GetPoints();

        Assert.Equal(4, read.Count);
        Assert.Equal(Square[1].Lng, read[1].Lng, 6);
    }

    [Theory]
    [InlineData(SiteZoneKind.Area, 2)]
    [InlineData(SiteZoneKind.Route, 1)]
    public void A_shape_with_too_few_corners_is_refused(SiteZoneKind kind, int count)
    {
        var plan = Plan();

        var error = Assert.Throws<BusinessException>(() => plan.AddZone("x", kind, Square.Take(count).ToList(), "#fff", null));
        Assert.Equal(StageTrackErrorCodes.SiteZoneInvalidShape, error.Code);
    }

    [Fact]
    public void An_area_reports_the_ground_it_covers()
    {
        // ~100 m x 100 m; a metre either way is well inside what satellite imagery can tell you anyway.
        var area = SiteGeometry.AreaM2(Square);

        Assert.InRange(area, 9_500, 10_500);
    }

    [Fact]
    public void A_route_reports_its_length()
    {
        var length = SiteGeometry.LengthM([Square[0], Square[1]]);

        Assert.InRange(length, 95, 105);
    }

    [Fact]
    public void A_rotation_is_always_read_as_a_compass_bearing()
    {
        var plan = Plan();
        var item = plan.AddItem(Tower, null, 1, 39.9, 32.8, null);

        item.MoveTo(39.9, 32.8, -90);
        Assert.Equal(270, item.RotationDeg);

        item.MoveTo(39.9, 32.8, 450);
        Assert.Equal(90, item.RotationDeg);
    }
}
