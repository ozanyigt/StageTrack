using System.ComponentModel.DataAnnotations;
using StageTrack.Account;
using StageTrack.Customers;
using StageTrack.Dtos;

namespace StageTrack.Quotes;

public class RentalFactorStepDto
{
    [Range(1, RentalFactorConsts.MaxDays)]
    public int Days { get; set; }

    [Range(0.0001, 10_000)]
    public decimal Factor { get; set; }
}

public class RentalFactorProfileDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public bool IsDefault { get; set; }
    public decimal ExtraDayFactor { get; set; }
    public List<RentalFactorStepDto> Steps { get; set; } = [];
}

public class CreateUpdateRentalFactorProfileDto
{
    [Required, StringLength(RentalFactorConsts.MaxNameLength)]
    public string Name { get; set; } = null!;

    public bool IsDefault { get; set; }

    [Range(0, 10_000)]
    public decimal ExtraDayFactor { get; set; }

    [Required, MinLength(1)]
    public List<RentalFactorStepDto> Steps { get; set; } = [];
}

public class FactorPreviewDto
{
    public int Days { get; set; }
    public decimal Factor { get; set; }
    public bool IsDefinedStep { get; set; }
}

public interface IRentalFactorProfileAppService
{
    Task<List<RentalFactorProfileDto>> GetListAsync();

    Task<RentalFactorProfileDto> CreateAsync(CreateUpdateRentalFactorProfileDto input);

    Task<RentalFactorProfileDto> UpdateAsync(Guid id, CreateUpdateRentalFactorProfileDto input);

    Task DeleteAsync(Guid id);

    Task<List<FactorPreviewDto>> GetPreviewAsync(Guid id, int maxDays);
}

public class QuoteListItemDto
{
    public Guid Id { get; set; }
    public string Number { get; set; } = null!;
    public int Revision { get; set; }
    public QuoteStatus Status { get; set; }
    public DateTime IssueDate { get; set; }
    public DateTime? ValidUntil { get; set; }
    public string Currency { get; set; } = null!;
    public decimal GrandTotal { get; set; }
    public Guid ProjectId { get; set; }
    public int ProjectNumber { get; set; }
    public string ProjectName { get; set; } = null!;
    public string? CustomerName { get; set; }
}

public class QuoteLineDto
{
    public Guid Id { get; set; }
    public int SortOrder { get; set; }
    public QuoteLineType Type { get; set; }
    public Guid? EquipmentId { get; set; }
    public string? EquipmentCode { get; set; }
    public string Description { get; set; } = null!;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public bool ApplyFactor { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal Total { get; set; }
}

public class QuoteDto : QuoteListItemDto
{
    public Guid? RentalFactorProfileId { get; set; }
    public string? RentalFactorProfileName { get; set; }
    public int RentalDays { get; set; }
    public decimal Factor { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal VatRate { get; set; }
    public string? Notes { get; set; }
    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal NetTotal { get; set; }
    public decimal VatAmount { get; set; }
    public bool IsEditable { get; set; }
    public List<QuoteStatus> AllowedStatuses { get; set; } = [];
    public List<QuoteLineDto> Lines { get; set; } = [];

    public string? Venue { get; set; }
    public DateTime? UseStart { get; set; }
    public DateTime? UseEnd { get; set; }
    public CustomerDto? Customer { get; set; }
    public CompanyDto Company { get; set; } = null!;
}

public class GetQuoteListInput : PagedRequestDto
{
    public string? Text { get; set; }
    public Guid? ProjectId { get; set; }
    public QuoteStatus? Status { get; set; }
}

public class CreateQuoteInput
{
    [Required]
    public Guid ProjectId { get; set; }

    public Guid? RentalFactorProfileId { get; set; }
}

public class UpdateQuoteHeaderInput
{
    public DateTime IssueDate { get; set; }
    public DateTime? ValidUntil { get; set; }

    [Range(0, 100)]
    public decimal DiscountPercent { get; set; }

    [Range(0, 100)]
    public decimal VatRate { get; set; }

    [StringLength(QuoteConsts.MaxNotesLength)]
    public string? Notes { get; set; }

    [Range(1, RentalFactorConsts.MaxDays)]
    public int RentalDays { get; set; }

    public Guid? RentalFactorProfileId { get; set; }

    /// <summary>When set, overrides the multiplier table for this quote only.</summary>
    [Range(0.0001, 10_000)]
    public decimal? ManualFactor { get; set; }
}

public class CreateUpdateQuoteLineInput
{
    public QuoteLineType Type { get; set; } = QuoteLineType.Equipment;

    /// <summary>Only for new equipment lines: description and daily price are taken from the catalog.</summary>
    public Guid? EquipmentId { get; set; }

    [StringLength(QuoteConsts.MaxDescriptionLength)]
    public string? Description { get; set; }

    [Range(0.01, 1_000_000)]
    public decimal Quantity { get; set; } = 1;

    [Range(0, 100_000_000)]
    public decimal? UnitPrice { get; set; }

    public bool ApplyFactor { get; set; } = true;

    [Range(0, 100)]
    public decimal DiscountPercent { get; set; }
}

public class ChangeQuoteStatusInput
{
    public QuoteStatus Status { get; set; }
}

public interface IQuoteAppService
{
    Task<PagedResultDto<QuoteListItemDto>> GetListAsync(GetQuoteListInput input);

    Task<QuoteDto> GetAsync(Guid id);

    Task<QuoteDto> CreateAsync(CreateQuoteInput input);

    Task<QuoteDto> UpdateHeaderAsync(Guid id, UpdateQuoteHeaderInput input);

    Task<QuoteDto> AddLineAsync(Guid id, CreateUpdateQuoteLineInput input);

    Task<QuoteDto> UpdateLineAsync(Guid id, Guid lineId, CreateUpdateQuoteLineInput input);

    Task<QuoteDto> RemoveLineAsync(Guid id, Guid lineId);

    Task<QuoteDto> ChangeStatusAsync(Guid id, ChangeQuoteStatusInput input);

    Task<QuoteDto> ReviseAsync(Guid id);

    Task DeleteAsync(Guid id);
}
