using StageTrack.Led.Calculation;

namespace StageTrack.Led.Tests.Calculation;

/// <summary>Curve angles (Simülasyon S4): per joint angle for an arc or a radius, fitted to the panel's lock positions.</summary>
public sealed class CurveSolverTests
{
    // 500 mm wide, locks at −5° … +10° every 2.5°.
    private static readonly PanelSpec Curve = new(Guid.NewGuid(), 500, 500, 192, 192, 7.8, 140, 45, 20, 30, [], Angles: new AngleRange(-5, 10, 2.5));
    private static readonly PanelSpec Flat = Curve with { Id = Guid.NewGuid(), Angles = null };

    private static CurveResult Solve(PanelSpec panel, int columns, CurveMode mode, double value, CurveDirection direction = CurveDirection.Concave, params int[] corners) =>
        CurveSolver.Solve(panel, columns, corners, new CurveRequest(mode, value, direction));

    [Fact]
    public void AnArc_IsSpreadEvenlyOverTheJoints()
    {
        // 90° over 13 columns = 12 joints of 7.5° — a lock position.
        var r = Solve(Curve, 13, CurveMode.Arc, 90);
        Assert.Equal(12, r.JointAnglesDeg.Count);
        Assert.All(r.JointAnglesDeg, a => Assert.Equal(7.5, a));
        Assert.Equal((7.5, 7.5, 90.0), (r.TargetJointDeg, r.AppliedJointDeg, r.AchievedArcDeg));
        Assert.Empty(r.Warnings);
    }

    [Fact]
    public void ARadius_GivesTwoAsinOfHalfAPanelOverTheRadius_AndBack()
    {
        // R = 0.25 / sin(3.75°) = 3.8226 m needs exactly 7.5° per joint.
        var radius = 0.25 / Math.Sin(3.75 * Math.PI / 180);
        var r = Solve(Curve, 10, CurveMode.Radius, radius);
        Assert.Equal(7.5, r.TargetJointDeg, 9);
        Assert.Equal(7.5, r.AppliedJointDeg);
        Assert.Equal(radius, r.AchievedRadiusM!.Value, 9);
        Assert.Equal(67.5, r.AchievedArcDeg, 9);
        Assert.Empty(r.Warnings);
    }

    [Fact]
    public void BetweenTwoLockPositions_TheNearestIsUsed_AndNoted()
    {
        // 60° over 9 joints = 6.67° → 7.5°, which makes a 67.5° arc.
        var r = Solve(Curve, 10, CurveMode.Arc, 60);
        Assert.Equal(60.0 / 9, r.TargetJointDeg, 9);
        Assert.Equal(7.5, r.AppliedJointDeg);
        Assert.Equal(67.5, r.AchievedArcDeg, 9);
        Assert.Equal([CurveSolver.Rounded], r.Warnings);
    }

    [Fact]
    public void OutsideTheRange_TheNearestEndIsUsed_AndNoted()
    {
        var tight = Solve(Curve, 5, CurveMode.Arc, 80); // 20° per joint, max 10°
        Assert.Equal(10, tight.AppliedJointDeg);
        Assert.Equal(40, tight.AchievedArcDeg);
        Assert.Equal([CurveSolver.OutOfRange], tight.Warnings);

        // Convex goes negative: −8° per joint, the panel bends back only 5°.
        var convex = Solve(Curve, 5, CurveMode.Arc, 32, CurveDirection.Convex);
        Assert.Equal(-8, convex.TargetJointDeg);
        Assert.Equal(-5, convex.AppliedJointDeg);
        Assert.All(convex.JointAnglesDeg, a => Assert.Equal(-5, a));
        Assert.Equal([CurveSolver.OutOfRange], convex.Warnings);

        // A radius shorter than half a panel can't be made at all.
        Assert.Equal([CurveSolver.OutOfRange], Solve(Curve, 5, CurveMode.Radius, 0.1).Warnings);
    }

    [Fact]
    public void AMaxOffTheStepGrid_TheLastLockPositionIsTheLimit()
    {
        var odd = Curve with { Angles = new AngleRange(0, 9, 2.5) }; // 0, 2.5, 5, 7.5
        var r = Solve(odd, 3, CurveMode.Arc, 40);
        Assert.Equal(7.5, r.AppliedJointDeg);
        Assert.Equal([CurveSolver.OutOfRange], r.Warnings);
    }

    [Fact]
    public void WithoutAStep_AnyAngleInTheRangeIsUsed()
    {
        var free = Curve with { Angles = new AngleRange(-5, 10, null) };
        var r = Solve(free, 10, CurveMode.Arc, 60);
        Assert.Equal(60.0 / 9, r.AppliedJointDeg, 9);
        Assert.Equal(60, r.AchievedArcDeg, 9);
        Assert.Empty(r.Warnings);
    }

    [Fact]
    public void AFlatPanel_CannotBeCurved()
    {
        var r = Solve(Flat, 10, CurveMode.Arc, 60);
        Assert.All(r.JointAnglesDeg, a => Assert.Equal(0, a));
        Assert.Equal(0, r.AchievedArcDeg);
        Assert.Null(r.AchievedRadiusM);
        Assert.Equal([CurveSolver.NotSupported], r.Warnings);
    }

    [Fact]
    public void JointsNextToACornerColumn_StayStraight()
    {
        // 7 columns, corner in column 3: joints 2 (2|3) and 3 (3|4) are straight; 4 curved joints share 30°.
        var r = Solve(Curve, 7, CurveMode.Arc, 30, CurveDirection.Concave, 3);
        Assert.Equal([7.5, 7.5, 0, 0, 7.5, 7.5], r.JointAnglesDeg);
        Assert.Equal(30, r.AchievedArcDeg);

        Assert.Equal([CurveSolver.NoJoints], Solve(Curve, 1, CurveMode.Arc, 30).Warnings);
    }
}
