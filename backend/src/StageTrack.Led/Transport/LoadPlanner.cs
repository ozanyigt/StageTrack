using System.Globalization;

namespace StageTrack.Led.Transport;

/// <summary>A case (or dolly) size from the inventory's "HxWxD" in cm: height, width and depth.</summary>
public sealed record CaseSize(double HeightCm, double WidthCm, double DepthCm)
{
    /// <summary>"72x60x100" → 72 high, 60 wide, 100 deep; null when blank or not in that form.</summary>
    public static CaseSize? Parse(string? hxwxd)
    {
        var parts = hxwxd?.Split('x');
        if (parts is not { Length: 3 }) return null;
        var values = new double[3];
        for (var i = 0; i < 3; i++)
            if (!double.TryParse(parts[i], NumberStyles.Float, CultureInfo.InvariantCulture, out values[i]) || values[i] <= 0) return null;
        return new CaseSize(values[0], values[1], values[2]);
    }
}

/// <summary>
/// One panel model's cases in the job. Every case travels whole (its full size and weight), also the last one when it
/// is not full; <paramref name="PanelsPerCase"/> says what is in each (e.g. 10, 10, 3).
/// </summary>
/// <param name="CaseWeightKg">A (full) case's weight; null = not entered (counted as 0, the page says so).</param>
/// <param name="MaxStack">How many may stand on top of each other (≥ 1).</param>
public sealed record CaseGroup(Guid ModelId, TransportKind Kind, CaseSize Size, double? CaseWeightKg, int MaxStack, IReadOnlyList<int> PanelsPerCase)
{
    public int Cases => PanelsPerCase.Count;

    /// <summary>The cases of <paramref name="panels"/> panels: ⌈panels ÷ per case⌉, full ones first, the rest in the last.</summary>
    public static CaseGroup For(Guid modelId, TransportKind kind, CaseSize size, double? caseWeightKg, int? maxStack, int panels, int panelsPerCase) =>
        new(modelId, kind, size, caseWeightKg, Math.Max(1, maxStack ?? 1), LoadPlanner.SplitPanels(panels, panelsPerCase));
}

/// <summary>A vehicle type's load space (cm) and capacity (kg).</summary>
public sealed record VehicleSpec(Guid Id, double LengthCm, double WidthCm, double HeightCm, double CapacityKg)
{
    public double FloorArea => LengthCm * WidthCm;
}

/// <summary>
/// A stack of cases of one model on the vehicle floor, seen from above: X along the length from the front (cab), Y across
/// the width from the left. Not rotated = the case's depth along the length and its width across; rotated = turned 90°.
/// </summary>
public sealed record PlacedStack(string Id, Guid ModelId, int Cases, int Panels, double X, double Y, bool Rotated);

public sealed record LoadedVehicle(VehicleSpec Vehicle, IReadOnlyList<PlacedStack> Stacks);

/// <summary>The vehicles with what stands in each; <paramref name="Unplaced"/> = cases that fit no vehicle (one entry per model).</summary>
public sealed record LoadPlan(IReadOnlyList<LoadedVehicle> Vehicles, IReadOnlyList<PlacedStack> Unplaced);

/// <summary>
/// The automatic loading plan (Lojistik). Cases of a model are stacked as high as the model allows and the vehicle's
/// height fits, then the stacks are laid in rows across the vehicle from the front: each row is filled across the width
/// (a stack is turned when that fits more in a row), the next row starts behind the deepest one. A vehicle is closed when
/// no stack fits any more or its capacity is reached; the rest goes to the next vehicle. A gap is left between two
/// stacks and between a stack and a wall.
/// </summary>
public static class LoadPlanner
{
    /// <summary>A safety bound on the number of vehicles (well above any real job).</summary>
    public const int MaxVehicles = 200;

    private const double Eps = 1e-6;

    /// <summary>⌈panels ÷ per case⌉ cases: every one full but the last, which holds the rest.</summary>
    public static IReadOnlyList<int> SplitPanels(int panels, int panelsPerCase)
    {
        if (panels <= 0 || panelsPerCase <= 0) return [];
        var cases = new List<int>();
        for (var left = panels; left > 0; left -= panelsPerCase) cases.Add(Math.Min(left, panelsPerCase));
        return cases;
    }

    /// <summary>How many cases of a group stand on top of each other in a vehicle (0 = too tall for it).</summary>
    public static int Layers(CaseGroup group, VehicleSpec vehicle) =>
        Math.Min(group.MaxStack, (int)Math.Floor((vehicle.HeightCm + Eps) / group.Size.HeightCm));

    /// <param name="vehicleTypeId">A type to use only (as many as needed); null = automatic: the fewest vehicles.</param>
    /// <param name="gapCm">Space between two stacks and between a stack and a wall (front, rear and sides).</param>
    public static LoadPlan Plan(IReadOnlyList<CaseGroup> groups, IReadOnlyList<VehicleSpec> types, Guid? vehicleTypeId = null, double gapCm = 0)
    {
        if (gapCm < 0) throw new ArgumentOutOfRangeException(nameof(gapCm));
        var pieces = groups
            .Where(g => g.Cases > 0)
            .OrderByDescending(g => g.Size.WidthCm * g.Size.DepthCm).ThenBy(g => g.ModelId)
            .SelectMany(g => g.PanelsPerCase.Select(p => new Piece(g, p)))
            .ToList();
        if (pieces.Count == 0 || types.Count == 0) return Finish([], pieces);

        if (vehicleTypeId is { } id)
        {
            var type = types.FirstOrDefault(t => t.Id == id) ?? throw new ArgumentException("Unknown vehicle type.", nameof(vehicleTypeId));
            var (only, rest) = PackMany(type, pieces, gapCm);
            return Finish(only, rest);
        }

        // Automatic: one vehicle when everything fits one (the smallest such type) …
        var bySize = types.OrderBy(t => t.FloorArea).ThenBy(t => t.CapacityKg).ToList();
        foreach (var type in bySize)
        {
            var (vehicle, left) = PackOne(type, pieces, gapCm);
            if (left.Count == 0) return Finish([vehicle], left);
        }

        // … else as many of the largest as needed, the last one swapped for the smallest type that takes its load.
        var largest = bySize[^1];
        var (vehicles, unplaced) = PackMany(largest, pieces, gapCm);
        if (vehicles.Count > 0)
        {
            var last = vehicles[^1];
            foreach (var type in bySize.Where(t => t != largest))
            {
                var (smaller, left) = PackOne(type, last.Pieces, gapCm);
                if (left.Count > 0) continue;
                vehicles[^1] = smaller;
                break;
            }
        }
        // What the largest cannot take (too tall / too wide for it) may still fit another type.
        foreach (var type in bySize.Where(t => t != largest).Reverse())
        {
            if (unplaced.Count == 0) break;
            var (more, left) = PackMany(type, unplaced, gapCm, MaxVehicles - vehicles.Count);
            vehicles.AddRange(more);
            unplaced = left;
        }
        return Finish(vehicles, unplaced);
    }

    private sealed record Piece(CaseGroup Group, int Panels);

    private sealed record Stack(CaseGroup Group, List<Piece> Pieces)
    {
        public double Weight => (Group.CaseWeightKg ?? 0) * Pieces.Count;
    }

    private sealed record Placement(Stack Stack, double X, double Y, bool Rotated);

    private sealed record Loaded(VehicleSpec Vehicle, List<Placement> Placements)
    {
        public List<Piece> Pieces => Placements.SelectMany(p => p.Stack.Pieces).ToList();
    }

    private sealed class Row(double x, double depth)
    {
        public double X { get; } = x;
        public double Depth { get; } = depth;
        public double UsedY { get; set; }
    }

    /// <summary>Vehicles of one type until everything is in (or the rest fits none of them).</summary>
    private static (List<Loaded> Vehicles, List<Piece> Left) PackMany(VehicleSpec type, List<Piece> pieces, double gap, int max = MaxVehicles)
    {
        var vehicles = new List<Loaded>();
        var left = pieces;
        while (left.Count > 0 && vehicles.Count < max)
        {
            var (vehicle, rest) = PackOne(type, left, gap);
            if (vehicle.Placements.Count == 0) break;
            vehicles.Add(vehicle);
            left = rest;
        }
        return (vehicles, left);
    }

    /// <summary>One vehicle: stacks in order, each in the first row it fits (else a new row behind), within the capacity.</summary>
    private static (Loaded Vehicle, List<Piece> Left) PackOne(VehicleSpec vehicle, List<Piece> pieces, double gap)
    {
        var placements = new List<Placement>();
        var left = new List<Piece>();
        var rows = new List<Row>();
        var weight = 0.0;

        foreach (var stack in Stacks(vehicle, pieces, left))
        {
            var fits = stack;
            if (stack.Group.CaseWeightKg is { } caseWeight && caseWeight > 0 && weight + stack.Weight > vehicle.CapacityKg + Eps)
            {
                // Over the capacity: a lower stack, if a case or more still may go.
                var count = (int)Math.Floor((vehicle.CapacityKg - weight + Eps) / caseWeight);
                if (count <= 0)
                {
                    left.AddRange(stack.Pieces);
                    continue;
                }
                fits = stack with { Pieces = stack.Pieces.Take(count).ToList() };
            }

            var spot = Place(vehicle, rows, fits.Group.Size, gap);
            if (spot is null)
            {
                left.AddRange(stack.Pieces);
                continue;
            }
            placements.Add(new Placement(fits, spot.Value.X, spot.Value.Y, spot.Value.Rotated));
            weight += fits.Weight;
            left.AddRange(stack.Pieces.Skip(fits.Pieces.Count));
        }
        // Keep the original order for the next vehicle.
        var order = pieces.Select((p, i) => (p, i)).ToDictionary(x => x.p, x => x.i, ReferenceEqualityComparer.Instance);
        return (new Loaded(vehicle, placements), left.OrderBy(p => order[p]).ToList());
    }

    /// <summary>The pieces in stacks as high as the vehicle allows; a group too tall for it goes to <paramref name="left"/>.</summary>
    private static IEnumerable<Stack> Stacks(VehicleSpec vehicle, List<Piece> pieces, List<Piece> left)
    {
        foreach (var group in pieces.GroupBy(p => p.Group))
        {
            var layers = Layers(group.Key, vehicle);
            var list = group.ToList();
            if (layers <= 0)
            {
                left.AddRange(list);
                continue;
            }
            for (var i = 0; i < list.Count; i += layers)
                yield return new Stack(group.Key, list.Skip(i).Take(layers).ToList());
        }
    }

    /// <summary>
    /// Where a footprint goes: the first row with room (the turn that fills its depth best), else a new row. Every
    /// footprint takes its size + the gap (behind it and to its right); the first row and the first stack of a row start
    /// one gap from the front and the left wall, so a gap is also left to every wall.
    /// </summary>
    private static (double X, double Y, bool Rotated)? Place(VehicleSpec vehicle, List<Row> rows, CaseSize size, double gap)
    {
        var turns = new List<(double Dx, double Dy, bool Rotated)> { (size.DepthCm + gap, size.WidthCm + gap, false) };
        if (Math.Abs(size.DepthCm - size.WidthCm) > Eps) turns.Add((size.WidthCm + gap, size.DepthCm + gap, true));
        turns = turns.Where(t => gap + t.Dy <= vehicle.WidthCm + Eps && gap + t.Dx <= vehicle.LengthCm + Eps).ToList();
        if (turns.Count == 0) return null;

        foreach (var row in rows)
        {
            var fit = turns
                .Where(t => t.Dx <= row.Depth + Eps && row.UsedY + t.Dy <= vehicle.WidthCm + Eps)
                .OrderByDescending(t => t.Dx).ThenBy(t => t.Dy)
                .Cast<(double Dx, double Dy, bool Rotated)?>()
                .FirstOrDefault();
            if (fit is { } f)
            {
                var y = row.UsedY;
                row.UsedY += f.Dy;
                return (row.X, y, f.Rotated);
            }
        }

        // A new row: the turn that uses the least length per stack (most across the width).
        var x = rows.Count == 0 ? gap : rows[^1].X + rows[^1].Depth;
        foreach (var t in turns.OrderBy(t => t.Dx / Math.Floor((vehicle.WidthCm - gap + Eps) / t.Dy)).ThenBy(t => t.Rotated))
        {
            if (x + t.Dx > vehicle.LengthCm + Eps) continue;
            rows.Add(new Row(x, t.Dx) { UsedY = gap + t.Dy });
            return (x, gap, t.Rotated);
        }
        return null;
    }

    /// <summary>Numbers the stacks per model in vehicle order ("{model}-1", "-2", …) and lists what fits nowhere.</summary>
    private static LoadPlan Finish(List<Loaded> vehicles, List<Piece> unplaced)
    {
        var counters = new Dictionary<Guid, int>();
        string NextId(Guid model)
        {
            counters[model] = counters.GetValueOrDefault(model) + 1;
            return $"{model:N}-{counters[model]}";
        }

        var loaded = vehicles.Select(v => new LoadedVehicle(
            v.Vehicle,
            v.Placements.Select(p => new PlacedStack(NextId(p.Stack.Group.ModelId), p.Stack.Group.ModelId, p.Stack.Pieces.Count,
                p.Stack.Pieces.Sum(x => x.Panels), Math.Round(p.X, 2), Math.Round(p.Y, 2), p.Rotated)).ToList())).ToList();
        var rest = unplaced.GroupBy(p => p.Group.ModelId)
            .Select(g => new PlacedStack(NextId(g.Key), g.Key, g.Count(), g.Sum(p => p.Panels), 0, 0, false))
            .ToList();
        return new LoadPlan(loaded, rest);
    }
}
