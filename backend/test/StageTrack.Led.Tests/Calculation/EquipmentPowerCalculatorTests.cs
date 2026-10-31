using StageTrack.Led.Calculation;

namespace StageTrack.Led.Tests.Calculation;

public class EquipmentPowerCalculatorTests
{
    private static readonly CalcSettings Settings = CalcSettings.Default; // pf 1, 16 A, 100 %

    [Fact]
    public void Watt_Current_Circuits_UnitsGoWholeOntoCircuits()
    {
        // 260 W at 230 V = 1.130 A; 16 A takes 14 per circuit; 24 units → 2 circuits.
        var line = EquipmentPowerCalculator.Line(new EquipmentPowerSpec(5.6, 260, 180), 24, PowerMode.Max, 230, Settings);
        Assert.Equal(24, line.Count);
        Assert.Equal(134.4, line.WeightKg, 6);
        Assert.Equal(6240, line.Watt, 6);
        Assert.Equal(260 / 230.0, line.UnitCurrentA, 6);
        Assert.Equal(6240 / 230.0, line.CurrentA, 6);
        Assert.Equal(14, line.UnitsPerCircuit);
        Assert.Equal(2, line.Circuits);
    }

    [Fact]
    public void Average_UsesTheAverageWatt_OrTheMaxWhenOnlyThatIsKnown()
    {
        Assert.Equal(180, EquipmentPowerCalculator.UnitWatt(new EquipmentPowerSpec(1, 260, 180), PowerMode.Average));
        Assert.Equal(260, EquipmentPowerCalculator.UnitWatt(new EquipmentPowerSpec(1, 260, null), PowerMode.Average));
    }

    [Fact]
    public void NoWatt_NoCurrent_NoCircuits_ButTheWeightCounts()
    {
        var truss = EquipmentPowerCalculator.Line(new EquipmentPowerSpec(15, null, null), 10, PowerMode.Max, 230, Settings);
        Assert.Equal((150.0, 0.0, 0.0, 0), (truss.WeightKg, truss.Watt, truss.CurrentA, truss.Circuits));
    }

    [Fact]
    public void AUnitDrawingMoreThanOneCircuit_TakesSeveralOfItsOwn()
    {
        // 5000 W at 230 V = 21.7 A > 16 A → 2 circuits each.
        var amp = EquipmentPowerCalculator.Line(new EquipmentPowerSpec(20, 5000, null), 3, PowerMode.Max, 230, Settings);
        Assert.Equal(0, amp.UnitsPerCircuit);
        Assert.Equal(6, amp.Circuits);
    }

    [Fact]
    public void ThePowerFactorAndDerating_AreTheLedCalculationsOwn()
    {
        var settings = Settings with { PowerFactor = 0.9, DeratingPercent = 80 };
        // 1000 W at 230 V, pf 0.9 = 4.83 A; usable 12.8 A → 2 per circuit; 5 units → 3 circuits.
        var line = EquipmentPowerCalculator.Line(new EquipmentPowerSpec(1, 1000, null), 5, PowerMode.Max, 230, settings);
        Assert.Equal(1000 / (230 * 0.9), line.UnitCurrentA, 6);
        Assert.Equal((2, 3), (line.UnitsPerCircuit, line.Circuits));
    }
}
