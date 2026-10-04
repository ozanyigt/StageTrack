using System.ComponentModel.DataAnnotations;
using StageTrack.Dtos;

namespace StageTrack.Inventory;

public class EquipmentFolderDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public Guid? ParentId { get; set; }
    public int SortOrder { get; set; }
    public int EquipmentCount { get; set; }
}

public class CreateUpdateEquipmentFolderDto
{
    [Required, StringLength(EquipmentFolderConsts.MaxNameLength)]
    public string Name { get; set; } = null!;

    public Guid? ParentId { get; set; }
}

public class EquipmentDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string? Brand { get; set; }
    public string? Model { get; set; }
    public Guid? FolderId { get; set; }
    public EquipmentType Type { get; set; }
    public bool IsSerialized { get; set; }

    /// <summary>Owned stock: device count for serialized equipment, entered quantity otherwise.</summary>
    public int Stock { get; set; }

    public decimal RentalPrice { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? VolumeM3 { get; set; }
    public string? Notes { get; set; }
    public bool IsArchived { get; set; }
}

public class EquipmentDetailDto : EquipmentDto
{
    public int StockQuantity { get; set; }
    public List<LabelDto> Labels { get; set; } = [];
    public Dictionary<UnitStatus, int> UnitStatusCounts { get; set; } = [];
}

public class GetEquipmentListInput : PagedRequestDto
{
    public string? Text { get; set; }
    public Guid? FolderId { get; set; }
    public bool IncludeSubfolders { get; set; } = true;
    public EquipmentType? Type { get; set; }
    public bool IsArchived { get; set; }
}

public class CreateUpdateEquipmentDto
{
    [Required, StringLength(EquipmentConsts.MaxCodeLength)]
    public string Code { get; set; } = null!;

    [Required, StringLength(EquipmentConsts.MaxNameLength)]
    public string Name { get; set; } = null!;

    [StringLength(EquipmentConsts.MaxBrandLength)]
    public string? Brand { get; set; }

    [StringLength(EquipmentConsts.MaxModelLength)]
    public string? Model { get; set; }

    public Guid? FolderId { get; set; }
    public EquipmentType Type { get; set; } = EquipmentType.Physical;
    public bool IsSerialized { get; set; } = true;

    [Range(0, 1_000_000)]
    public int StockQuantity { get; set; }

    [Range(0, 100_000_000)]
    public decimal RentalPrice { get; set; }

    [Range(0, 100_000)]
    public decimal? WeightKg { get; set; }

    [Range(0, 100_000)]
    public decimal? VolumeM3 { get; set; }

    [StringLength(EquipmentConsts.MaxNotesLength)]
    public string? Notes { get; set; }
}

public class EquipmentLookupDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = null!;
    public string Name { get; set; } = null!;
    public bool IsSerialized { get; set; }
    public decimal RentalPrice { get; set; }
}

public class GetAvailabilityInput
{
    [Required, MinLength(1)]
    public List<Guid> EquipmentIds { get; set; } = [];

    public DateTime Start { get; set; }
    public DateTime End { get; set; }
    public Guid? ExcludeProjectId { get; set; }
}

public class EquipmentAvailabilityDto
{
    public Guid EquipmentId { get; set; }
    public int Stock { get; set; }
    public int PlannedElsewhere { get; set; }
    public int Available { get; set; }
}

public class EquipmentUnitDto
{
    public Guid Id { get; set; }
    public Guid EquipmentId { get; set; }
    public string EquipmentCode { get; set; } = null!;
    public string EquipmentName { get; set; } = null!;
    public string InternalRef { get; set; } = null!;
    public string? SerialNumber { get; set; }
    public Guid? StockLocationId { get; set; }
    public string? StockLocationName { get; set; }
    public UnitStatus Status { get; set; }
    public Guid? CurrentProjectId { get; set; }
    public int? CurrentProjectNumber { get; set; }
    public string? CurrentProjectName { get; set; }
    public string? Notes { get; set; }
    public int LabelCount { get; set; }
}

public class GetEquipmentUnitListInput : PagedRequestDto
{
    public string? Text { get; set; }
    public Guid? EquipmentId { get; set; }
    public UnitStatus? Status { get; set; }
    public Guid? StockLocationId { get; set; }
}

public class CreateEquipmentUnitDto
{
    [Required]
    public Guid EquipmentId { get; set; }

    [Required, StringLength(EquipmentUnitConsts.MaxInternalRefLength)]
    public string InternalRef { get; set; } = null!;

    [StringLength(EquipmentUnitConsts.MaxSerialNumberLength)]
    public string? SerialNumber { get; set; }

    public Guid? StockLocationId { get; set; }

    [StringLength(EquipmentUnitConsts.MaxNotesLength)]
    public string? Notes { get; set; }

    /// <summary>Optional label scanned while registering the device (e.g. its existing Rentman QR).</summary>
    [StringLength(EquipmentLabelConsts.MaxCodeLength)]
    public string? LabelCode { get; set; }
}

public class UpdateEquipmentUnitDto
{
    [Required, StringLength(EquipmentUnitConsts.MaxInternalRefLength)]
    public string InternalRef { get; set; } = null!;

    [StringLength(EquipmentUnitConsts.MaxSerialNumberLength)]
    public string? SerialNumber { get; set; }

    public Guid? StockLocationId { get; set; }

    [StringLength(EquipmentUnitConsts.MaxNotesLength)]
    public string? Notes { get; set; }
}

public class ChangeUnitStatusInput
{
    public UnitStatus Status { get; set; }
}

public class LabelDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = null!;
    public string RawValue { get; set; } = null!;
    public LabelType Type { get; set; }
    public Guid EquipmentId { get; set; }
    public Guid? UnitId { get; set; }
    public DateTime CreationTime { get; set; }
}

public class AssignLabelInput
{
    [Required, StringLength(EquipmentLabelConsts.MaxCodeLength)]
    public string Code { get; set; } = null!;

    public LabelType Type { get; set; } = LabelType.RentmanQr;
    public Guid? EquipmentId { get; set; }
    public Guid? UnitId { get; set; }
}

public class ResolveLabelResultDto
{
    public bool Found { get; set; }

    /// <summary>The normalized code that was looked up.</summary>
    public string Code { get; set; } = null!;

    public LabelDto? Label { get; set; }
    public EquipmentDto? Equipment { get; set; }
    public EquipmentUnitDto? Unit { get; set; }
}

public class StockLocationDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public StockLocationType Type { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public bool IsActive { get; set; }
}

public class CreateUpdateStockLocationDto
{
    [Required, StringLength(StockLocationConsts.MaxNameLength)]
    public string Name { get; set; } = null!;

    public StockLocationType Type { get; set; } = StockLocationType.Warehouse;

    [StringLength(StockLocationConsts.MaxAddressLength)]
    public string? Address { get; set; }

    [StringLength(StockLocationConsts.MaxCityLength)]
    public string? City { get; set; }

    public bool IsActive { get; set; } = true;
}
