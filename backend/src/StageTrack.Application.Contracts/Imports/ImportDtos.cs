using System.ComponentModel.DataAnnotations;
using StageTrack.Inventory;

namespace StageTrack.Imports;

/// <summary>
/// Excel rows are read in the browser and sent as JSON. Existing records are updated (matched by code,
/// internal reference or tax number); new ones are created. Each failing row is reported, the rest is saved.
/// </summary>
public class ImportResultDto
{
    public int Created { get; set; }
    public int Updated { get; set; }
    public List<ImportErrorDto> Errors { get; set; } = [];
}

public class ImportErrorDto
{
    /// <summary>Excel row number (header is row 1).</summary>
    public int Row { get; set; }

    public string Code { get; set; } = null!;
    public string Message { get; set; } = null!;
    public Dictionary<string, object?>? Details { get; set; }
}

public class EquipmentImportInput
{
    public int Row { get; set; }
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? Brand { get; set; }
    public string? Model { get; set; }

    /// <summary>Folder path, e.g. "VIDEO/Display"; missing folders are created.</summary>
    public string? Folder { get; set; }

    /// <summary>true = tracked by serial number (default), false = by quantity.</summary>
    public bool? IsSerialized { get; set; }

    public int? StockQuantity { get; set; }
    public decimal? RentalPrice { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? LengthCm { get; set; }
    public decimal? WidthCm { get; set; }
    public decimal? HeightCm { get; set; }
    public decimal? PowerW { get; set; }

    /// <summary>What it weighs empty (a case, a rack), kilograms.</summary>
    public decimal? EmptyWeightKg { get; set; }

    /// <summary>How many go in one case; 1 when the sheet says nothing.</summary>
    public int? PackedPer { get; set; }

    /// <summary>
    /// What kind of thing it is, as the sheet words it: rental stock, a consumable, or something sold. Text
    /// rather than an enum because the file usually comes from another system with its own vocabulary.
    /// </summary>
    public string? Type { get; set; }

    /// <summary>"Rental" or "Sale" in the exporting system's words; a sale here wins over <see cref="Type"/>.</summary>
    public string? SaleType { get; set; }

    /// <summary>
    /// The manufacturer's serial number of one device. A sheet exported per serial number carries one row per
    /// device, so the row makes the product and then the device on it.
    /// </summary>
    [StringLength(EquipmentUnitConsts.MaxSerialNumberLength)]
    public string? SerialNumber { get; set; }

    /// <summary>An existing QR or RFID code on that device (or on the product, when it is quantity-tracked).</summary>
    public string? LabelCode { get; set; }

    [StringLength(2000)]
    public string? Notes { get; set; }
}

public class UnitImportInput
{
    public int Row { get; set; }
    public string? EquipmentCode { get; set; }
    public string? InternalRef { get; set; }
    public string? SerialNumber { get; set; }

    /// <summary>Stock location name, e.g. "GÜNEŞLİ".</summary>
    public string? StockLocation { get; set; }

    public DateTime? PurchaseDate { get; set; }

    /// <summary>Existing label content (Rentman QR JSON or code) to link to the device.</summary>
    public string? LabelCode { get; set; }
}

public class CustomerImportInput
{
    public int Row { get; set; }
    public string? Name { get; set; }
    public string? TaxNumber { get; set; }
    public string? TaxOffice { get; set; }
    public string? ContactPerson { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
}
