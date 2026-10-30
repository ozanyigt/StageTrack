using StageTrack.Led.Transport;

namespace StageTrack.Led.Tests.Transport;

public class LoadPlannerTests
{
    private static readonly VehicleSpec Truck = new(Guid.Parse("00000000-0000-0000-0000-000000000001"), 1000, 245, 270, 25_000);
    private static readonly VehicleSpec Trailer = new(Guid.Parse("00000000-0000-0000-0000-000000000002"), 2000, 240, 270, 35_500);
    private static readonly VehicleSpec[] Both = [Truck, Trailer];

    private static CaseGroup Group(int panels, int perCase = 10, string size = "72x60x100", double? weight = 150, int? maxStack = 1, TransportKind kind = TransportKind.Case) =>
        CaseGroup.For(Guid.NewGuid(), kind, CaseSize.Parse(size)!, weight, maxStack, panels, perCase);

    private static IEnumerable<PlacedStack> All(LoadPlan plan) => plan.Vehicles.SelectMany(v => v.Stacks);

    [Theory]
    [InlineData(20, 10, new[] { 10, 10 })]
    [InlineData(23, 10, new[] { 10, 10, 3 })]
    [InlineData(3, 10, new[] { 3 })]
    [InlineData(0, 10, new int[0])]
    public void Cases_AreRoundedUp_TheLastHoldsTheRest(int panels, int perCase, int[] expected) =>
        Assert.Equal(expected, LoadPlanner.SplitPanels(panels, perCase));

    [Fact]
    public void CaseSize_ParsesHeightWidthDepth()
    {
        Assert.Equal(new CaseSize(72, 60, 100), CaseSize.Parse("72x60x100"));
        Assert.Equal(new CaseSize(72.5, 60, 100), CaseSize.Parse("72.5x60x100"));
        Assert.Null(CaseSize.Parse(null));
        Assert.Null(CaseSize.Parse("72x60"));
        Assert.Null(CaseSize.Parse("0x60x100"));
    }

    [Fact]
    public void ALastCaseThatIsNotFull_TravelsAsAWholeCase()
    {
        var group = Group(23, weight: 150);
        var plan = LoadPlanner.Plan([group], [Truck], Truck.Id);
        var stacks = All(plan).ToList();
        Assert.Equal(3, stacks.Sum(s => s.Cases));
        Assert.Equal(new[] { 10, 10, 3 }, stacks.Select(s => s.Panels));
        Assert.Empty(plan.Unplaced);
    }

    [Fact]
    public void Stacks_AsHighAsTheModelAllows_AndNeverAboveTheVehicle()
    {
        // 72 cm cases, 270 cm vehicle: at most 3 fit the height, even when 5 are allowed.
        var plan = LoadPlanner.Plan([Group(70, maxStack: 5)], [Truck], Truck.Id);
        var stacks = All(plan).ToList();
        Assert.Equal(new[] { 3, 3, 1 }, stacks.Select(s => s.Cases));
        Assert.All(stacks, s => Assert.True(s.Cases * 72 <= 270));

        var flat = LoadPlanner.Plan([Group(30, maxStack: null)], [Truck], Truck.Id);
        Assert.All(All(flat), s => Assert.Equal(1, s.Cases));
    }

    [Fact]
    public void Rows_FillTheWidth_WithoutOverlapOrLeavingTheVehicle()
    {
        // 60 × 100 cm cases: 4 across 245 cm, rows of 100 cm.
        var group = Group(80);
        var plan = LoadPlanner.Plan([group], [Truck], Truck.Id);
        var stacks = All(plan).ToList();
        Assert.Equal(8, stacks.Count);
        Assert.Equal(new double[] { 0, 60, 120, 180 }, stacks.Take(4).Select(s => s.Y));
        Assert.All(stacks.Take(4), s => Assert.Equal(0, s.X));
        Assert.All(stacks.Skip(4), s => Assert.Equal(100, s.X));
        AssertValid(plan, group);
    }

    [Fact]
    public void ACaseIsTurned_WhenMoreFitAcross()
    {
        // 50 wide × 110 deep: 4 across either way? 245/50 = 4 (110 long each) vs 245/110 = 2 (50 long each) → 27.5 vs 25 per stack: turned.
        var group = Group(10, perCase: 1, size: "80x50x110");
        var plan = LoadPlanner.Plan([group], [Truck], Truck.Id);
        Assert.All(All(plan), s => Assert.True(s.Rotated));
        AssertValid(plan, group);
    }

    [Fact]
    public void Auto_OneVehicle_TheSmallestThatTakesEverything()
    {
        var small = LoadPlanner.Plan([Group(80)], Both);
        Assert.Equal(Truck, Assert.Single(small.Vehicles).Vehicle);

        // 40 stacks of 60 × 100: 10 rows → 1000 cm in a truck is exactly full; 44 need the trailer.
        var group = Group(440);
        var big = LoadPlanner.Plan([group], Both);
        Assert.Equal(Trailer, Assert.Single(big.Vehicles).Vehicle);
        AssertValid(big, group);
    }

    [Fact]
    public void Auto_SeveralVehicles_TheLastOneAsSmallAsItsLoadAllows()
    {
        // 80 rows of 4 (trailer: 20 rows = 80 stacks): 330 stacks → 4 trailers + 10 stacks, which a truck takes.
        var group = Group(3300);
        var plan = LoadPlanner.Plan([group], Both);
        Assert.Equal(new[] { Trailer, Trailer, Trailer, Trailer, Truck }, plan.Vehicles.Select(v => v.Vehicle));
        Assert.Equal(330, All(plan).Sum(s => s.Cases));
        Assert.Empty(plan.Unplaced);
        AssertValid(plan, group);
    }

    [Fact]
    public void AChosenType_IsUsedAsOftenAsNeeded()
    {
        var plan = LoadPlanner.Plan([Group(440)], Both, Truck.Id);
        Assert.Equal(2, plan.Vehicles.Count);
        Assert.All(plan.Vehicles, v => Assert.Equal(Truck, v.Vehicle));
        Assert.Equal(44, All(plan).Sum(s => s.Cases));
    }

    [Fact]
    public void TheCapacity_IsNeverExceeded()
    {
        // 1000 kg cases: 25 per truck by weight, although 40 fit the floor.
        var group = Group(400, weight: 1000);
        var plan = LoadPlanner.Plan([group], [Truck], Truck.Id);
        Assert.Equal(new[] { 25, 15 }, plan.Vehicles.Select(v => v.Stacks.Sum(s => s.Cases)));
        AssertValid(plan, group);
    }

    [Fact]
    public void ACaseThatFitsNoVehicle_IsListedApart()
    {
        var tall = Group(5, perCase: 1, size: "300x60x100");
        var wide = Group(5, perCase: 1, size: "50x260x260");
        var fine = Group(10);
        var plan = LoadPlanner.Plan([tall, wide, fine], Both);
        Assert.Equal(1, Assert.Single(plan.Vehicles).Stacks.Sum(s => s.Cases));
        Assert.Equal(new[] { 5, 5 }, plan.Unplaced.Select(u => u.Cases).Order());
    }

    [Fact]
    public void StackIds_AreNumberedPerModel()
    {
        var group = Group(30);
        var plan = LoadPlanner.Plan([group], [Truck], Truck.Id);
        Assert.Equal(new[] { $"{group.ModelId:N}-1", $"{group.ModelId:N}-2", $"{group.ModelId:N}-3" }, All(plan).Select(s => s.Id));
    }

    [Fact]
    public void Dollies_ArePlacedLikeCases()
    {
        var group = Group(12, perCase: 6, size: "120x80x120", kind: TransportKind.Dolly);
        var plan = LoadPlanner.Plan([group], [Truck], Truck.Id);
        Assert.Equal(2, All(plan).Count());
        AssertValid(plan, group);
    }

    [Fact]
    public void AGap_IsLeftBetweenTheStacks_AndToEveryWall()
    {
        // 60 × 100 cm cases with 3 cm: 63 cm across → only 3 in 245 cm, so turned: 2 across (103 cm each), rows of 63 cm.
        var group = Group(80);
        var plan = LoadPlanner.Plan([group], [Truck], Truck.Id, gapCm: 3);
        var stacks = All(plan).ToList();
        Assert.Equal(8, stacks.Count);
        Assert.All(stacks, s => Assert.True(s.Rotated));
        Assert.Equal(new double[] { 3, 66, 129, 192 }, stacks.Select(s => s.X).Distinct());
        Assert.Equal(new double[] { 3, 106 }, stacks.Select(s => s.Y).Distinct());
        AssertValid(plan, 3, group);
    }

    [Fact]
    public void AGap_TakesRoom()
    {
        // 40 stacks of 60 × 100 fill a truck exactly without a gap; with 3 cm they need two.
        var group = Group(400);
        Assert.Single(LoadPlanner.Plan([group], [Truck], Truck.Id).Vehicles);
        var plan = LoadPlanner.Plan([group], [Truck], Truck.Id, gapCm: 3);
        Assert.Equal(2, plan.Vehicles.Count);
        Assert.Equal(40, All(plan).Sum(s => s.Cases));
        AssertValid(plan, 3, group);

        // A case that only just fits the width without the gap does not fit with it.
        var exact = Group(1, perCase: 1, size: "50x245x245");
        Assert.Single(LoadPlanner.Plan([exact], [Truck], Truck.Id).Vehicles);
        Assert.Single(LoadPlanner.Plan([exact], [Truck], Truck.Id, gapCm: 3).Unplaced);
    }

    private static void AssertValid(LoadPlan plan, params CaseGroup[] groups) => AssertValid(plan, 0, groups);

    /// <summary>Every stack inside its vehicle (a gap from the walls) and a gap from every other; the weight within the capacity.</summary>
    private static void AssertValid(LoadPlan plan, double gap, params CaseGroup[] groups)
    {
        foreach (var vehicle in plan.Vehicles)
        {
            var boxes = vehicle.Stacks.Select(s =>
            {
                var size = groups.Single(g => g.ModelId == s.ModelId).Size;
                return s.Rotated ? (X: s.X, Y: s.Y, Dx: size.WidthCm, Dy: size.DepthCm) : (X: s.X, Y: s.Y, Dx: size.DepthCm, Dy: size.WidthCm);
            }).ToList();
            foreach (var b in boxes)
                Assert.True(b.X >= gap - 1e-6 && b.Y >= gap - 1e-6 && b.X + b.Dx + gap <= vehicle.Vehicle.LengthCm + 1e-6
                    && b.Y + b.Dy + gap <= vehicle.Vehicle.WidthCm + 1e-6, "outside");
            for (var i = 0; i < boxes.Count; i++)
                for (var j = i + 1; j < boxes.Count; j++)
                {
                    var (a, b) = (boxes[i], boxes[j]);
                    Assert.False(a.X < b.X + b.Dx + gap - 1e-6 && b.X < a.X + a.Dx + gap - 1e-6 && a.Y < b.Y + b.Dy + gap - 1e-6 && b.Y < a.Y + a.Dy + gap - 1e-6, "overlap");
                }
            var weight = vehicle.Stacks.Sum(s => s.Cases * (groups.Single(g => g.ModelId == s.ModelId).CaseWeightKg ?? 0));
            Assert.True(weight <= vehicle.Vehicle.CapacityKg + 1e-6, "over capacity");
        }
    }
}
