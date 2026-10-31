using StageTrack.Inventory;
using StageTrack.Led.Calculation;
using StageTrack.Led.Transport;

namespace StageTrack.Led;

/// <summary>
/// Turns stored equipment into what the maths asks for. The ids the calculations carry around are
/// <see cref="Equipment"/> ids, so every result can be traced straight back to the inventory —
/// onto a quote line, a project line or the packing list.
/// </summary>
public static class LedSpecMapper
{
    public static PanelSpec ToPanelSpec(Equipment equipment, LedPanelSpec spec, IReadOnlyList<Guid>? compatibleProcessorIds) =>
        new(
            equipment.Id,
            (double)spec.WidthMm,
            (double)spec.HeightMm,
            spec.PixelWidth,
            spec.PixelHeight,
            (double)(equipment.WeightKg ?? 0),
            (double?)spec.WattMax,
            (double?)spec.WattAvg,
            spec.MaxLink,
            spec.AvgLink,
            spec.HasExclusiveProcessors ? compatibleProcessorIds ?? [] : null,
            spec.PanelType is LedPanelType.Corner or LedPanelType.CurveCorner,
            spec.AngleMin is { } min && spec.AngleMax is { } max
                ? new AngleRange((double)min, (double)max, (double?)spec.AngleStep)
                : null);

    public static ProcessorSpec ToProcessorSpec(Equipment equipment, LedProcessorSpec spec) =>
        new(equipment.Id, equipment.Name, spec.TotalPixels, spec.EthernetPorts, spec.PixelsPerPort, spec.OptPorts);

    public static ExtenderSpec ToExtenderSpec(Equipment equipment, LedExtenderSpec spec) =>
        new(equipment.Id, equipment.Name, spec.EthernetPorts);

    /// <summary>
    /// The cases (or dollies) <paramref name="panels"/> panels of one model travel in. Null when the model has no
    /// case size: the loading plan cannot place a box whose size is unknown, and the caller reports it as missing.
    /// </summary>
    public static CaseGroup? ToCaseGroup(Equipment equipment, LedPanelSpec spec, int panels)
    {
        if (panels <= 0 || CaseSize.Parse(spec.CaseDimensionsCm) is not { } size)
        {
            return null;
        }

        var perCase = spec.CasePanelCount is > 0 ? spec.CasePanelCount.Value : 1;
        return CaseGroup.For(equipment.Id, spec.TransportKind, size, (double?)spec.CaseWeightKg, spec.MaxStack, panels, perCase);
    }

    /// <summary>A vehicle as the loading plan wants it: millimetres on the record, centimetres in the maths.</summary>
    public static VehicleSpec ToVehicleSpec(LedTransportVehicle vehicle) =>
        new(vehicle.Id, vehicle.LengthMm / 10d, vehicle.WidthMm / 10d, vehicle.HeightMm / 10d, vehicle.CapacityKg);
}
