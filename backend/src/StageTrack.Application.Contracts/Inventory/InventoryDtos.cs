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

    /// <summary>Null when the user may not see prices.</summary>
    public decimal? RentalPrice { get; set; }

    public decimal? WeightKg { get; set; }
    public decimal? VolumeM3 { get; set; }
    public string? Notes { get; set; }
    public bool IsArchived { get; set; }

    public string? FolderName { get; set; }
    public string? CountryOfOrigin { get; set; }
    public decimal? LengthCm { get; set; }
    public decimal? WidthCm { get; set; }
    public decimal? HeightCm { get; set; }
    public decimal? PowerW { get; set; }

    /// <summary>False: office/internal equipment that cannot be planned on projects or quotes.</summary>
    public bool ShowInQuotes { get; set; }

    public DateTime? PurchaseDate { get; set; }
    public DateTime? WarrantyEndDate { get; set; }
    public Guid? PurchaseSupplierId { get; set; }
    public string? PurchaseSupplierName { get; set; }

    /// <summary>Cases/sets whose default content includes this equipment ("part of").</summary>
    public List<EquipmentRefDto> ContainedIn { get; set; } = [];
}

public class EquipmentRefDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = null!;
    public string Name { get; set; } = null!;
}

public class EquipmentDetailDto : EquipmentDto
{
    public int StockQuantity { get; set; }

    /// <summary>True when the price was typed by hand; otherwise a case's price follows its content total.</summary>
    public bool IsPriceManual { get; set; }

    /// <summary>Total rental price of the default content; null when the user may not see prices or there is no content.</summary>
    public decimal? ContentPriceTotal { get; set; }
    public decimal? CurrentA { get; set; }
    public int PackedPer { get; set; }
    public Guid? ImageAttachmentId { get; set; }
    public int? InspectionIntervalMonths { get; set; }
    public string? InspectionDescription { get; set; }
    public string? FolderPath { get; set; }
    public List<LabelDto> Labels { get; set; } = [];
    public Dictionary<UnitStatus, int> UnitStatusCounts { get; set; } = [];
    public List<EquipmentRelationDto> Relations { get; set; } = [];
    public List<EquipmentSupplierDto> Suppliers { get; set; } = [];

    /// <summary>Equipment that contains this one as default content (Rentman "Structure › is part of").</summary>
    public List<EquipmentRelationDto> PartOf { get; set; } = [];

    public List<StockRowDto> StockRows { get; set; } = [];
}

public class EquipmentRelationDto
{
    public Guid Id { get; set; }
    public EquipmentRelationKind Kind { get; set; }
    public Guid EquipmentId { get; set; }
    public string EquipmentCode { get; set; } = null!;
    public string EquipmentName { get; set; } = null!;
    public int Quantity { get; set; }
    public int Stock { get; set; }
}

public class EquipmentSupplierDto
{
    public Guid Id { get; set; }
    public Guid SupplierId { get; set; }
    public string SupplierName { get; set; } = null!;
    public string? SupplierCode { get; set; }
    public decimal? PurchasePrice { get; set; }
    public bool IsPreferred { get; set; }
}

public class StockRowDto
{
    public Guid? StockLocationId { get; set; }
    public string? StockLocationName { get; set; }
    public UnitStatus Status { get; set; }
    public int Count { get; set; }
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

    [StringLength(EquipmentDetailConsts.MaxCountryLength)]
    public string? CountryOfOrigin { get; set; }

    [Range(0, 1_000_000)]
    public int StockQuantity { get; set; }

    /// <summary>Ignored when the user may not see prices (the stored price is kept).</summary>
    [Range(0, 100_000_000)]
    public decimal? RentalPrice { get; set; }

    [Range(0, 100_000)] public decimal? LengthCm { get; set; }
    [Range(0, 100_000)] public decimal? WidthCm { get; set; }
    [Range(0, 100_000)] public decimal? HeightCm { get; set; }
    [Range(0, 100_000)] public decimal? WeightKg { get; set; }
    [Range(0, 100_000)] public decimal? VolumeM3 { get; set; }
    [Range(0, 1_000_000)] public decimal? PowerW { get; set; }
    [Range(0, 10_000)] public decimal? CurrentA { get; set; }
    [Range(1, 10_000)] public int PackedPer { get; set; } = 1;

    [Range(1, 120)]
    public int? InspectionIntervalMonths { get; set; }

    [StringLength(EquipmentDetailConsts.MaxInspectionDescriptionLength)]
    public string? InspectionDescription { get; set; }

    [StringLength(EquipmentConsts.MaxNotesLength)]
    public string? Notes { get; set; }

    public bool ShowInQuotes { get; set; } = true;
    public DateTime? PurchaseDate { get; set; }
    public DateTime? WarrantyEndDate { get; set; }
    public Guid? PurchaseSupplierId { get; set; }
}

public class AddEquipmentRelationInput
{
    public EquipmentRelationKind Kind { get; set; }

    [Required]
    public Guid RelatedEquipmentId { get; set; }

    [Range(1, 10_000)]
    public int Quantity { get; set; } = 1;
}

public class UpdateEquipmentRelationInput
{
    [Range(1, 10_000)]
    public int Quantity { get; set; }
}

public class CreateUpdateEquipmentSupplierInput
{
    [Required]
    public Guid SupplierId { get; set; }

    [StringLength(EquipmentDetailConsts.MaxSupplierCodeLength)]
    public string? SupplierCode { get; set; }

    [Range(0, 100_000_000)]
    public decimal? PurchasePrice { get; set; }

    public bool IsPreferred { get; set; }
}

public class EquipmentLookupDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = null!;
    public string Name { get; set; } = null!;
    public bool IsSerialized { get; set; }
    public decimal? RentalPrice { get; set; }
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
    public bool IsArchived { get; set; }
    public DateTime? PurchaseDate { get; set; }
    public DateTime? WarrantyDate { get; set; }
    public DateTime? ReplacementDate { get; set; }
    public Guid? SupplierId { get; set; }
    public string? SupplierName { get; set; }
    public DateTime? LastInspectionDate { get; set; }
    public DateTime? NextInspectionDate { get; set; }
    public Guid? ImageAttachmentId { get; set; }
}

public class EquipmentUnitDetailDto : EquipmentUnitDto
{
    public string? EquipmentBrand { get; set; }
    public string? EquipmentModel { get; set; }
    public int? InspectionIntervalMonths { get; set; }
    public List<LabelDto> Labels { get; set; } = [];
}

public class GetEquipmentUnitListInput : PagedRequestDto
{
    public string? Text { get; set; }
    public Guid? EquipmentId { get; set; }
    public UnitStatus? Status { get; set; }
    public Guid? StockLocationId { get; set; }
    public bool IncludeArchived { get; set; }
}

public class CreateEquipmentUnitDto
{
    [Required]
    public Guid EquipmentId { get; set; }

    /// <summary>Empty: the next number (1, 2, 3… or TR-004 after TR-003) is used.</summary>
    [StringLength(EquipmentUnitConsts.MaxInternalRefLength)]
    public string? InternalRef { get; set; }

    [StringLength(EquipmentUnitConsts.MaxSerialNumberLength)]
    public string? SerialNumber { get; set; }

    public Guid? StockLocationId { get; set; }

    [StringLength(EquipmentDetailConsts.MaxRemarkLength)]
    public string? Notes { get; set; }

    public DateTime? PurchaseDate { get; set; }
    public Guid? SupplierId { get; set; }

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

    [StringLength(EquipmentDetailConsts.MaxRemarkLength)]
    public string? Notes { get; set; }

    public DateTime? PurchaseDate { get; set; }
    public DateTime? WarrantyDate { get; set; }
    public DateTime? ReplacementDate { get; set; }
    public Guid? SupplierId { get; set; }
}

public class ChangeUnitStatusInput
{
    public UnitStatus Status { get; set; }
}

public class TransferUnitsInput
{
    [Required, MinLength(1)]
    public List<Guid> UnitIds { get; set; } = [];

    [Required]
    public Guid TargetCompanyId { get; set; }
}

public class TransferResultDto
{
    public Guid TargetCompanyId { get; set; }
    public string TargetCompanyName { get; set; } = null!;
    public string TargetLocationName { get; set; } = null!;
    public int UnitCount { get; set; }
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

public class PrintLabelsInput
{
    public List<Guid> UnitIds { get; set; } = [];

    /// <summary>Quantity-tracked equipment: one label for the equipment itself.</summary>
    public List<Guid> EquipmentIds { get; set; } = [];

    /// <summary>Create a new label (Rentman JSON format) for items that have none yet.</summary>
    public bool CreateMissing { get; set; } = true;
}

/// <summary>Everything a label template may print for one item.</summary>
public class PrintLabelItemDto
{
    public Guid EquipmentId { get; set; }
    public Guid? UnitId { get; set; }
    public string EquipmentCode { get; set; } = null!;
    public string EquipmentName { get; set; } = null!;
    public string? Brand { get; set; }
    public string? Model { get; set; }
    public string? InternalRef { get; set; }
    public string? SerialNumber { get; set; }

    /// <summary>Exact text encoded in the QR (Rentman JSON).</summary>
    public string QrValue { get; set; } = null!;

    public string Code { get; set; } = null!;
    public bool IsNew { get; set; }
}

public class LabelTemplateDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public int WidthMm { get; set; }
    public int HeightMm { get; set; }
    public int QrSizeMm { get; set; }
    public decimal FontSizePt { get; set; }
    public bool ShowName { get; set; }
    public bool ShowBrand { get; set; }
    public bool ShowModel { get; set; }
    public bool ShowCode { get; set; }
    public bool ShowInternalRef { get; set; }
    public bool ShowSerialNumber { get; set; }
    public bool ShowCompanyName { get; set; }
    public bool IsDefault { get; set; }
}

public class CreateUpdateLabelTemplateDto
{
    [Required, StringLength(128)]
    public string Name { get; set; } = null!;

    [Range(10, 300)] public int WidthMm { get; set; } = 60;
    [Range(10, 300)] public int HeightMm { get; set; } = 30;
    [Range(5, 300)] public int QrSizeMm { get; set; } = 20;
    [Range(4, 24)] public decimal FontSizePt { get; set; } = 7;
    public bool ShowName { get; set; } = true;
    public bool ShowBrand { get; set; } = true;
    public bool ShowModel { get; set; } = true;
    public bool ShowCode { get; set; }
    public bool ShowInternalRef { get; set; } = true;
    public bool ShowSerialNumber { get; set; } = true;
    public bool ShowCompanyName { get; set; }
    public bool IsDefault { get; set; }
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
