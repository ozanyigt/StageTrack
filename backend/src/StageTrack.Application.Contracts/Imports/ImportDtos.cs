using System.ComponentModel.DataAnnotations;

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

public class EquipmentImportRow
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

    [StringLength(2000)]
    public string? Notes { get; set; }
}

public class UnitImportRow
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

public class CustomerImportRow
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
