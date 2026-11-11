using StageTrack.Design;
using StageTrack.Design.Transport;

namespace StageTrack.Data;

/// <summary>
/// The LED side of the demo inventory: what a panel, a processor and a converter have to say about themselves
/// before Pixel Map, the simulation, the 3D stage, the loading plan and stock status have anything to show.
///
/// The figures are those of the products the names imitate, and they agree with one another: a panel's pixel
/// count is its size divided by its pitch, average power never exceeds maximum, and the case data is the case
/// the firm actually carries the panels in. Kept as plain data so the seeder stays a loop and the numbers can
/// be checked by a test rather than by reading code.
/// </summary>
public static class DesignDemoData
{
    /// <param name="Code">The equipment code the spec belongs to; the demo inventory is addressed by code.</param>
    /// <param name="MaxLinkPanels">Panels the manufacturer allows on one 16 A circuit at maximum power.</param>
    /// <param name="AvgLinkPanels">The same at average power, which is what a show actually draws.</param>
    /// <param name="WeightKgPerPanel">
    /// What one panel weighs. It belongs on the equipment record rather than here, but the design screens read it
    /// per panel, so the demo has to be sure it is there: a missing weight is a zero in every rigging total.
    /// </param>
    /// <param name="WeightKgToCorrect">
    /// A weight the demo used to carry that means something else - the ROE floor's row held the weight of a
    /// ten-tile dolly. Replaced once; any other value is left alone, which is also what makes this idempotent.
    /// </param>
    /// <param name="MaxStack">Cases of this model stacked on top of each other in the vehicle.</param>
    public sealed record PanelSeed(
        string Code,
        decimal PitchMm,
        int WidthMm,
        int HeightMm,
        int PixelWidth,
        int PixelHeight,
        decimal PowerMaxW,
        decimal PowerAvgW,
        int MaxLinkPanels,
        int AvgLinkPanels,
        decimal WeightKgPerPanel,
        decimal? WeightKgToCorrect,
        LedPanelType PanelType,
        LedPanelGroup Group,
        decimal? AngleMinDeg,
        decimal? AngleMaxDeg,
        decimal? AngleStepDeg,
        TransportKind TransportKind,
        int CasePanelCount,
        string CaseDimensionsCm,
        decimal CaseWeightKg,
        int MaxStack,
        string ReceivingCard,
        int PwmHz);

    /// <param name="OptPorts">Fibre outputs; above zero the planner may put a converter between it and the panels.</param>
    public sealed record ProcessorSeed(string Code, long TotalPixels, int EthernetPorts, long PixelsPerPort, int OptPorts);

    public sealed record ExtenderSeed(string Code, int EthernetPorts, int FiberPorts, long MaxPixels);

    /// <summary>
    /// Gear the demo warehouse never had and the design screens cannot work without: an indoor panel, the two
    /// processors and the converter. Created with devices and labels like the rest of the demo inventory, so it
    /// also appears on the warehouse board and in the device list.
    /// </summary>
    public sealed record NewEquipmentSeed(
        string Code,
        string Name,
        string Brand,
        string Model,
        int Units,
        string UnitPrefix,
        decimal PriceTry,
        decimal LengthCm,
        decimal WidthCm,
        decimal HeightCm,
        decimal WeightKg,
        decimal PowerW,
        int PackedPer);

    /// <param name="CompanyCode">The firm location this set belongs to: the demo has a Turkish and a Dubai one.</param>
    public sealed record DesignSeedSet(
        string CompanyCode,
        IReadOnlyList<PanelSeed> Panels,
        IReadOnlyList<ProcessorSeed> Processors,
        IReadOnlyList<ExtenderSeed> Extenders,
        IReadOnlyList<NewEquipmentSeed> NewEquipment)
    {
        /// <summary>Every equipment code this set has something to say about.</summary>
        public IReadOnlyList<string> Codes =>
            [.. Panels.Select(p => p.Code), .. Processors.Select(p => p.Code), .. Extenders.Select(e => e.Code)];
    }

    /// <summary>
    /// Turkey: the two panels the inventory already has (an outdoor 500x1000 and the ROE floor) plus the indoor
    /// panel, the two Novastar processors and the fibre converter it does not.
    /// </summary>
    private static readonly DesignSeedSet Turkey = new(
        "TR",
        Panels:
        [
            // INFICOLOR P3.9MM 500X1000, outdoor: 128 x 3.91 = 500 mm, 256 x 3.91 = 1001 mm.
            new("Led-045", 3.91m, 500, 1000, 128, 256, 400, 130, 7, 21, 14, null, LedPanelType.Flat, LedPanelGroup.Outdoor,
                -7.5m, 7.5m, 2.5m, TransportKind.Case, 6, "108x60x105", 135, 2, "Novastar A8s", 3840),

            // UNILUMIN UPAD III H2.6, indoor: 192 x 2.604 = 500 mm exactly.
            new("Led-026", 2.604m, 500, 500, 192, 192, 160, 55, 12, 34, 7.5m, null, LedPanelType.Flat, LedPanelGroup.Indoor,
                -5m, 5m, 1m, TransportKind.Case, 8, "72x60x100", 85, 2, "Novastar A10s Pro", 3840),

            // ROE BLACK MARBLE floor: 104 x 4.81 = 500 mm. A floor panel is never curved, so it has no angles,
            // and it travels on dollies rather than in flight cases - ten tiles to a dolly, as the firm keeps it.
            new("Led-047", 4.81m, 500, 500, 104, 104, 150, 50, 10, 30, 10.5m, 160, LedPanelType.Floor, LedPanelGroup.Other,
                null, null, null, TransportKind.Dolly, 10, "60x55x105", 175, 2, "ROE Visual integrated", 3840)
        ],
        Processors:
        [
            new("VID-053", 6_500_000, 10, 650_000, 2),
            new("VID-054", 2_600_000, 4, 650_000, 2)
        ],
        Extenders:
        [
            new("VID-055", 10, 2, 6_500_000)
        ],
        NewEquipment:
        [
            new("Led-026", "UNILUMIN UPAD III H2.6 500X500 INDOOR PANEL", "Unilumin", "UPAD III H2.6",
                Units: 72, UnitPrefix: "UPAD", PriceTry: 180, LengthCm: 50, WidthCm: 50, HeightCm: 8,
                WeightKg: 7.5m, PowerW: 160, PackedPer: 8),
            new("VID-053", "NOVASTAR VX1000 LED PROCESSOR / SWITCHER", "Novastar", "VX1000",
                Units: 2, UnitPrefix: "VX1000", PriceTry: 1200, LengthCm: 48, WidthCm: 33, HeightCm: 10,
                WeightKg: 4.5m, PowerW: 120, PackedPer: 1),
            new("VID-054", "NOVASTAR VX400 LED PROCESSOR", "Novastar", "VX400",
                Units: 4, UnitPrefix: "VX400", PriceTry: 600, LengthCm: 48, WidthCm: 33, HeightCm: 5,
                WeightKg: 3, PowerW: 60, PackedPer: 1),
            new("VID-055", "NOVASTAR CVT10-S FIBER CONVERTER", "Novastar", "CVT10-S",
                Units: 6, UnitPrefix: "CVT10", PriceTry: 250, LengthCm: 48, WidthCm: 20, HeightCm: 4,
                WeightKg: 2, PowerW: 20, PackedPer: 1)
        ]);

    /// <summary>
    /// Dubai: the panel and the processor it already owns get their data. Nothing is created here - the point is
    /// that switching location does not land on an empty catalogue.
    /// </summary>
    private static readonly DesignSeedSet Dubai = new(
        "AE",
        Panels:
        [
            // UNILUMIN INDOOR P2.6 CURVE 50x50: the same cabinet as Turkey's, in its curving frame.
            new("Led-032", 2.604m, 500, 500, 192, 192, 160, 55, 12, 34, 7.5m, null, LedPanelType.Curve, LedPanelGroup.Indoor,
                -10m, 10m, 2.5m, TransportKind.Case, 8, "72x60x100", 85, 2, "Novastar A10s Pro", 3840)
        ],
        Processors:
        [
            new("VID-053", 6_500_000, 10, 650_000, 2)
        ],
        Extenders: [],
        NewEquipment: []);

    private static readonly DesignSeedSet[] Sets = [Turkey, Dubai];

    /// <summary>What the given firm location needs; null when the demo has nothing to say about it.</summary>
    public static DesignSeedSet? ForCompany(string companyCode) =>
        Sets.FirstOrDefault(s => string.Equals(s.CompanyCode, companyCode, StringComparison.OrdinalIgnoreCase));

    /// <summary>Every set, for the tests that check the figures agree with each other.</summary>
    public static IReadOnlyList<DesignSeedSet> All => Sets;

    /// <summary>
    /// The codes of the set that still need a spec row, given the ones that already have one. This is what makes
    /// the seeding idempotent: on the second start every code is already spoken for and the list comes back empty.
    /// </summary>
    public static IReadOnlyList<string> MissingSpecs(DesignSeedSet set, IEnumerable<string> codesWithSpec)
    {
        var already = new HashSet<string>(codesWithSpec, StringComparer.OrdinalIgnoreCase);
        return [.. set.Codes.Where(code => !already.Contains(code))];
    }
}
