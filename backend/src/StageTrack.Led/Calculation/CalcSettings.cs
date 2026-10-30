namespace StageTrack.Led.Calculation;

/// <summary>A distribution box size: current per phase and socapex outputs (e.g. 63A: 63 A per phase, 6 outputs).</summary>
public sealed record DistributionOption(string Id, double AmpsPerPhase, int SocapexOutputs);

/// <summary>
/// Fixed calculation constants (configuration section "Calculation"; not editable in the UI).
/// </summary>
/// <param name="PowerFactor">Power factor of the panels (I = P / (V × power factor)).</param>
/// <param name="FuseAmpere">Fuse of one CEE connection (16 A).</param>
/// <param name="DeratingPercent">Usable share of the fuse, in percent.</param>
/// <param name="CircuitsPerSocapex">CEE circuits on one socapex cable.</param>
public sealed record CalcSettings(
    double PowerFactor,
    double FuseAmpere,
    double DeratingPercent,
    int CircuitsPerSocapex,
    IReadOnlyList<DistributionOption> DistributionOptions)
{
    public static readonly CalcSettings Default = new(
        PowerFactor: 1.0,
        FuseAmpere: 16,
        DeratingPercent: 100,
        CircuitsPerSocapex: 6,
        DistributionOptions:
        [
            new("32a", 32, 4),
            new("63a", 63, 6),
            new("125a", 125, 12),
            new("powerlock", 400, 24),
        ]);
}

/// <summary>Max Güç uses the panels' maximum watt and Max_Atlama; Ortalama Güç the average ones.</summary>
public enum PowerMode
{
    Max,
    Average,
}
