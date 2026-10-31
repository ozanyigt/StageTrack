using System.ComponentModel.DataAnnotations;
using StageTrack.Dtos;
using StageTrack.Led.Transport;

namespace StageTrack.Led;

/// <summary>An LED item as the screens list it: the equipment's own fields plus what the role adds.</summary>
public class LedItemDto
{
    public Guid EquipmentId { get; set; }
    public LedRole Role { get; set; }
    public string Code { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string? Brand { get; set; }
    public string? Model { get; set; }
    public string? FolderName { get; set; }
    public decimal? WeightKg { get; set; }
    public bool IsArchived { get; set; }

    /// <summary>Owned pieces: devices for serial-tracked equipment, the stock count otherwise.</summary>
    public int Stock { get; set; }
}

public class LedPanelDto : LedItemDto
{
    public decimal PitchMm { get; set; }
    public int WidthMm { get; set; }
    public int HeightMm { get; set; }
    public int PixelWidth { get; set; }
    public int PixelHeight { get; set; }
    public decimal? WattMax { get; set; }
    public decimal? WattAvg { get; set; }
    public int? MaxLink { get; set; }
    public int? AvgLink { get; set; }
    public LedPanelType PanelType { get; set; }
    public LedPanelGroup Group { get; set; }
    public decimal? AngleMin { get; set; }
    public decimal? AngleMax { get; set; }
    public decimal? AngleStep { get; set; }
    public int? CasePanelCount { get; set; }
    public string? CaseDimensionsCm { get; set; }
    public decimal? CaseWeightKg { get; set; }
    public TransportKind TransportKind { get; set; }
    public int? MaxStack { get; set; }
    public string? ReceivingCard { get; set; }
    public int? PwmHz { get; set; }
    public bool HasExclusiveProcessors { get; set; }

    /// <summary>The processors an exclusive panel is restricted to; empty when it works with any.</summary>
    public List<Guid> CompatibleProcessorIds { get; set; } = [];

    public bool IsFavorite { get; set; }
}

public class LedProcessorDto : LedItemDto
{
    public long TotalPixels { get; set; }
    public int EthernetPorts { get; set; }
    public long? PixelsPerPort { get; set; }
    public int OptPorts { get; set; }
}

public class LedExtenderDto : LedItemDto
{
    public int EthernetPorts { get; set; }
    public int FiberPorts { get; set; }
    public long MaxPixels { get; set; }
}

public class GetLedCatalogInput
{
    public string? Text { get; set; }
    public LedPanelGroup? Group { get; set; }
    public Guid? FolderId { get; set; }
    public bool IncludeArchived { get; set; }
}

/// <summary>The LED side of an equipment item; the equipment itself is created and edited on the equipment screens.</summary>
public class LedPanelInput
{
    [Range(0.01, 1000)]
    public decimal PitchMm { get; set; }

    [Range(1, 100_000)]
    public int WidthMm { get; set; }

    [Range(1, 100_000)]
    public int HeightMm { get; set; }

    [Range(1, 1_000_000)]
    public int PixelWidth { get; set; }

    [Range(1, 1_000_000)]
    public int PixelHeight { get; set; }

    [Range(0, 100_000)]
    public decimal? WattMax { get; set; }

    [Range(0, 100_000)]
    public decimal? WattAvg { get; set; }

    [Range(1, 10_000)]
    public int? MaxLink { get; set; }

    [Range(1, 10_000)]
    public int? AvgLink { get; set; }

    public LedPanelType PanelType { get; set; } = LedPanelType.Flat;
    public LedPanelGroup Group { get; set; } = LedPanelGroup.Indoor;

    [Range(-180, 180)]
    public decimal? AngleMin { get; set; }

    [Range(-180, 180)]
    public decimal? AngleMax { get; set; }

    [Range(0.01, 180)]
    public decimal? AngleStep { get; set; }

    [Range(1, 1000)]
    public int? CasePanelCount { get; set; }

    [StringLength(LedConsts.MaxCaseDimensionsLength)]
    public string? CaseDimensionsCm { get; set; }

    [Range(0, 100_000)]
    public decimal? CaseWeightKg { get; set; }

    public TransportKind TransportKind { get; set; } = TransportKind.Case;

    [Range(1, LedConsts.MaxStackLimit)]
    public int? MaxStack { get; set; }

    [StringLength(LedConsts.MaxReceivingCardLength)]
    public string? ReceivingCard { get; set; }

    [Range(1, 1_000_000)]
    public int? PwmHz { get; set; }

    public bool HasExclusiveProcessors { get; set; }

    /// <summary>Only read when <see cref="HasExclusiveProcessors"/> is set; each must be a processor of the inventory.</summary>
    public List<Guid> CompatibleProcessorIds { get; set; } = [];
}

public class LedProcessorInput
{
    [Range(1, 100_000_000_000)]
    public long TotalPixels { get; set; }

    [Range(1, 1000)]
    public int EthernetPorts { get; set; }

    [Range(1, 100_000_000)]
    public long? PixelsPerPort { get; set; }

    [Range(0, 1000)]
    public int OptPorts { get; set; }
}

public class LedExtenderInput
{
    [Range(1, 1000)]
    public int EthernetPorts { get; set; }

    [Range(0, 1000)]
    public int FiberPorts { get; set; }

    [Range(0, 100_000_000_000)]
    public long MaxPixels { get; set; }
}

/// <summary>
/// The LED inventory: which equipment items are panels, processors and extenders, and their technical data.
/// Creating the equipment itself stays on the equipment screens — an LED panel is not a separate kind of record.
/// </summary>
public interface ILedInventoryAppService
{
    Task<List<LedPanelDto>> GetPanelsAsync(GetLedCatalogInput input);

    Task<List<LedProcessorDto>> GetProcessorsAsync(GetLedCatalogInput input);

    Task<List<LedExtenderDto>> GetExtendersAsync(GetLedCatalogInput input);

    Task<LedPanelDto> SavePanelAsync(Guid equipmentId, LedPanelInput input);

    Task<LedProcessorDto> SaveProcessorAsync(Guid equipmentId, LedProcessorInput input);

    Task<LedExtenderDto> SaveExtenderAsync(Guid equipmentId, LedExtenderInput input);

    /// <summary>Takes the equipment out of the LED module; the equipment record itself is untouched.</summary>
    Task RemoveAsync(Guid equipmentId);

    Task SetFavoriteAsync(Guid equipmentId, bool favorite);
}
