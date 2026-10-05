using System.ComponentModel.DataAnnotations;
using StageTrack.Dtos;

namespace StageTrack.Suppliers;

public class SupplierDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string? ContactPerson { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? TaxNumber { get; set; }
    public string? TaxOffice { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public string? Website { get; set; }
    public string? Notes { get; set; }
}

public class GetSupplierListInput : PagedRequestDto
{
    public string? Text { get; set; }
}

public class CreateUpdateSupplierDto
{
    [Required, StringLength(256)] public string Name { get; set; } = null!;
    [StringLength(128)] public string? ContactPerson { get; set; }
    [EmailAddress, StringLength(256)] public string? Email { get; set; }
    [StringLength(32)] public string? Phone { get; set; }
    [StringLength(32)] public string? TaxNumber { get; set; }
    [StringLength(128)] public string? TaxOffice { get; set; }
    [StringLength(512)] public string? Address { get; set; }
    [StringLength(128)] public string? City { get; set; }
    [StringLength(128)] public string? Country { get; set; }
    [StringLength(256)] public string? Website { get; set; }
    [StringLength(2000)] public string? Notes { get; set; }
}

public interface ISupplierAppService
{
    Task<PagedResultDto<SupplierDto>> GetListAsync(GetSupplierListInput input);

    Task<List<LookupDto>> GetLookupAsync(string? text);

    Task<SupplierDto> CreateAsync(CreateUpdateSupplierDto input);

    Task<SupplierDto> UpdateAsync(Guid id, CreateUpdateSupplierDto input);

    Task DeleteAsync(Guid id);
}
