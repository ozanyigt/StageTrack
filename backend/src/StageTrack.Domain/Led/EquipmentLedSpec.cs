using System.Text.RegularExpressions;
using StageTrack.Entities;
using StageTrack.Inventory;
using StageTrack.Led.Transport;

namespace StageTrack.Led;

/// <summary>
/// The LED side of an <see cref="Equipment"/>: what the Pixel Map, power, processor and logistics pages need and
/// the rest of StageTrack has no column for. One row per equipment at most — no row means the item is simply not
/// part of the LED module, which is also how "is this an LED panel?" is answered.
/// Everything the equipment record already carries (name, brand, weight, volume, notes, stock) stays there and is
/// never copied here.
/// </summary>
public abstract partial class EquipmentLedSpec : CompanyAggregateRoot
{
    public Guid EquipmentId { get; private set; }

    /// <summary>Which LED page the item belongs to; set on create and never changed (it is the row's type).</summary>
    public LedRole Role { get; private set; }

    protected EquipmentLedSpec()
    {
    }

    protected EquipmentLedSpec(Guid id, Guid equipmentId, LedRole role) : base(id)
    {
        EquipmentId = equipmentId;
        Role = role;
    }

    /// <summary>"HxWxD" in cm, e.g. "72x60x100" — the flight case or dolly the item travels in.</summary>
    protected static string? NormalizeCaseDimensions(string? value)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text))
        {
            return null;
        }

        if (!CaseDimensionsPattern().IsMatch(text))
        {
            throw new BusinessException(StageTrackErrorCodes.LedInvalidCaseDimensions).WithData("value", text);
        }

        return text;
    }

    protected static int? NormalizeStack(int? maxStack)
    {
        if (maxStack is > LedConsts.MaxStackLimit)
        {
            throw new BusinessException(StageTrackErrorCodes.LedStackTooHigh).WithData("limit", LedConsts.MaxStackLimit);
        }

        return maxStack is > 0 ? maxStack : null;
    }

    [GeneratedRegex(@"^\d+(\.\d+)?x\d+(\.\d+)?x\d+(\.\d+)?$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex CaseDimensionsPattern();
}

/// <summary>Everything the maths needs of one LED panel model that the equipment record does not already hold.</summary>
public class LedPanelSpec : EquipmentLedSpec
{
    public decimal PitchMm { get; private set; }
    public int WidthMm { get; private set; }
    public int HeightMm { get; private set; }
    public int PixelWidth { get; private set; }
    public int PixelHeight { get; private set; }

    /// <summary>Power of one panel; the equipment's own PowerW is the maximum, this pair is what the circuits use.</summary>
    public decimal? WattMax { get; private set; }

    public decimal? WattAvg { get; private set; }

    /// <summary>Panels on one 16 A connection at maximum / average power; null = worked out from the current.</summary>
    public int? MaxLink { get; private set; }

    public int? AvgLink { get; private set; }

    public LedPanelType PanelType { get; private set; }
    public LedPanelGroup Group { get; private set; }

    /// <summary>The angle one joint to the next panel locks at; min and max go together, the step is optional.</summary>
    public decimal? AngleMin { get; private set; }

    public decimal? AngleMax { get; private set; }
    public decimal? AngleStep { get; private set; }

    /// <summary>Panels in one case or on one dolly; with the case size and weight it feeds the loading plan.</summary>
    public int? CasePanelCount { get; private set; }

    public string? CaseDimensionsCm { get; private set; }
    public decimal? CaseWeightKg { get; private set; }
    public TransportKind TransportKind { get; private set; }
    public int? MaxStack { get; private set; }

    /// <summary>Receiving card model, e.g. "Novastar A8s" — information only, no calculation reads it.</summary>
    public string? ReceivingCard { get; private set; }

    /// <summary>PWM (refresh) frequency in Hz — information only.</summary>
    public int? PwmHz { get; private set; }

    /// <summary>
    /// "Özel işlemcisi var": the panel works only with the processors linked to the equipment through
    /// <see cref="EquipmentRelationKind.CompatibleProcessor"/>. Off = any processor of the inventory will do.
    /// </summary>
    public bool HasExclusiveProcessors { get; private set; }

    private LedPanelSpec()
    {
    }

    public LedPanelSpec(Guid id, Guid equipmentId) : base(id, equipmentId, LedRole.Panel)
    {
    }

    public void SetGeometry(decimal pitchMm, int widthMm, int heightMm, int pixelWidth, int pixelHeight)
    {
        PitchMm = Math.Max(0.01m, pitchMm);
        WidthMm = Math.Max(1, widthMm);
        HeightMm = Math.Max(1, heightMm);
        PixelWidth = Math.Max(1, pixelWidth);
        PixelHeight = Math.Max(1, pixelHeight);
    }

    public void SetPower(decimal? wattMax, decimal? wattAvg, int? maxLink, int? avgLink)
    {
        if (wattMax is { } max && wattAvg is { } avg && avg > max)
        {
            throw new BusinessException(StageTrackErrorCodes.LedAverageOverMaxWatt);
        }

        WattMax = NotNegative(wattMax);
        WattAvg = NotNegative(wattAvg);
        MaxLink = maxLink is > 0 ? maxLink : null;
        AvgLink = avgLink is > 0 ? avgLink : null;
    }

    public void SetShape(LedPanelType panelType, LedPanelGroup group) => (PanelType, Group) = (panelType, group);

    /// <summary>Curve range: minimum and maximum go together (min ≤ max); the step is optional but positive.</summary>
    public void SetAngles(decimal? min, decimal? max, decimal? step)
    {
        if (min.HasValue != max.HasValue || min > max || (step.HasValue && !min.HasValue) || step is <= 0)
        {
            throw new BusinessException(StageTrackErrorCodes.LedInvalidAngleRange);
        }

        AngleMin = min;
        AngleMax = max;
        AngleStep = step;
    }

    public void SetTransport(TransportKind kind, int? casePanelCount, string? caseDimensionsCm, decimal? caseWeightKg, int? maxStack)
    {
        TransportKind = kind;
        CasePanelCount = casePanelCount is > 0 ? casePanelCount : null;
        CaseDimensionsCm = NormalizeCaseDimensions(caseDimensionsCm);
        CaseWeightKg = NotNegative(caseWeightKg);
        MaxStack = NormalizeStack(maxStack);
    }

    public void SetInfo(string? receivingCard, int? pwmHz)
    {
        ReceivingCard = receivingCard?.Trim();
        PwmHz = pwmHz is > 0 ? pwmHz : null;
    }

    /// <summary>
    /// Off: the panel works with every processor. On: it works only with the processors linked to the equipment,
    /// so at least one must be linked — the caller passes how many it found.
    /// </summary>
    public void SetExclusiveProcessors(bool exclusive, int linkedProcessors)
    {
        if (exclusive && linkedProcessors == 0)
        {
            throw new BusinessException(StageTrackErrorCodes.LedExclusiveProcessorsRequired);
        }

        HasExclusiveProcessors = exclusive;
    }

    private static decimal? NotNegative(decimal? value) => value is null ? null : Math.Max(0, value.Value);
}

/// <summary>Sending card / video processor data.</summary>
public class LedProcessorSpec : EquipmentLedSpec
{
    public long TotalPixels { get; private set; }
    public int EthernetPorts { get; private set; }

    /// <summary>null = not entered; the planner then assumes 650.000 px per port.</summary>
    public long? PixelsPerPort { get; private set; }

    /// <summary>0 = direct connection: the processor drives the panels itself, without a converter.</summary>
    public int OptPorts { get; private set; }

    private LedProcessorSpec()
    {
    }

    public LedProcessorSpec(Guid id, Guid equipmentId) : base(id, equipmentId, LedRole.Processor)
    {
    }

    public void Set(long totalPixels, int ethernetPorts, long? pixelsPerPort, int optPorts)
    {
        TotalPixels = Math.Max(1, totalPixels);
        EthernetPorts = Math.Max(1, ethernetPorts);
        PixelsPerPort = pixelsPerPort is > 0 ? pixelsPerPort : null;
        OptPorts = Math.Max(0, optPorts);
    }
}

/// <summary>Fibre extender / converter data (e.g. Novastar CVT10-S).</summary>
public class LedExtenderSpec : EquipmentLedSpec
{
    public int EthernetPorts { get; private set; }
    public int FiberPorts { get; private set; }
    public long MaxPixels { get; private set; }

    private LedExtenderSpec()
    {
    }

    public LedExtenderSpec(Guid id, Guid equipmentId) : base(id, equipmentId, LedRole.Extender)
    {
    }

    public void Set(int ethernetPorts, int fiberPorts, long maxPixels)
    {
        EthernetPorts = Math.Max(1, ethernetPorts);
        FiberPorts = Math.Max(0, fiberPorts);
        MaxPixels = Math.Max(0, maxPixels);
    }
}
