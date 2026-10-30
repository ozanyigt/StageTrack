namespace StageTrack.Led.Calculation;

/// <summary>A non-LED equipment model's figures the power calculation needs (one unit).</summary>
public sealed record EquipmentPowerSpec(double WeightKg, double? WattMax, double? WattAvg);

/// <summary>
/// One line of a job (a fixture group, a speaker / amplifier group, truss or scaff material): <paramref name="Count"/>
/// units, their weight and watt, the current they draw, how many go on one circuit and the circuits they need.
/// </summary>
public sealed record EquipmentPowerLine(int Count, double WeightKg, double Watt, double UnitCurrentA, double CurrentA, int UnitsPerCircuit, int Circuits);

/// <summary>
/// Power of non-LED equipment: watt → current → circuits, with the same constants as the LED calculation
/// (<see cref="CalcSettings"/>: power factor, fuse, derating). No CEE / socapex / phase split here — that stays LED's.
/// </summary>
public static class EquipmentPowerCalculator
{
    /// <summary>
    /// The unit's watt for the mode: Max = max watt; Ortalama = average watt, or the max one when only that is known.
    /// None = 0 (truss, scaff, passive speakers).
    /// </summary>
    public static double UnitWatt(EquipmentPowerSpec spec, PowerMode mode) =>
        (mode == PowerMode.Max ? spec.WattMax : spec.WattAvg ?? spec.WattMax) ?? 0;

    /// <summary>
    /// The line's figures. Units go whole onto circuits: floor(fuse × derating / unit current) per circuit; a unit that
    /// draws more than one circuit gives takes ⌈unit current ÷ usable⌉ circuits of its own.
    /// </summary>
    public static EquipmentPowerLine Line(EquipmentPowerSpec spec, int count, PowerMode mode, double voltage, CalcSettings settings)
    {
        if (count < 0) throw new ArgumentOutOfRangeException(nameof(count), "Adet negatif olamaz.");
        var unitWatt = UnitWatt(spec, mode);
        var unitCurrent = unitWatt > 0 ? PowerCalculator.WattToCurrent(unitWatt, voltage, settings.PowerFactor) : 0;
        var usable = settings.FuseAmpere * (settings.DeratingPercent / 100);
        int perCircuit;
        int circuits;
        if (unitCurrent <= 0 || count == 0)
        {
            perCircuit = 0;
            circuits = 0;
        }
        else if (unitCurrent <= usable)
        {
            perCircuit = (int)Math.Floor(usable / unitCurrent);
            circuits = (int)Math.Ceiling(count / (double)perCircuit);
        }
        else
        {
            perCircuit = 0;
            circuits = count * (int)Math.Ceiling(unitCurrent / usable);
        }
        return new EquipmentPowerLine(count, spec.WeightKg * count, unitWatt * count, unitCurrent, unitCurrent * count, perCircuit, circuits);
    }
}
