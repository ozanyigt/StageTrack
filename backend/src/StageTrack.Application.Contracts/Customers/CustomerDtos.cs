using System.ComponentModel.DataAnnotations;
using StageTrack.Dtos;

namespace StageTrack.Customers;

public class CustomerDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string? TaxNumber { get; set; }
    public string? TaxOffice { get; set; }
    public string? ContactPerson { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public string? Notes { get; set; }
}

public class GetCustomerListInput : PagedRequestDto
{
    public string? Text { get; set; }
}

public class CreateUpdateCustomerDto
{
    [Required, StringLength(256)]
    public string Name { get; set; } = null!;

    [StringLength(32)]
    public string? TaxNumber { get; set; }

    [StringLength(128)]
    public string? TaxOffice { get; set; }

    [StringLength(128)]
    public string? ContactPerson { get; set; }

    [EmailAddress, StringLength(256)]
    public string? Email { get; set; }

    [StringLength(32)]
    public string? Phone { get; set; }

    [StringLength(512)]
    public string? Address { get; set; }

    [StringLength(128)]
    public string? City { get; set; }

    [StringLength(128)]
    public string? Country { get; set; }

    [StringLength(2000)]
    public string? Notes { get; set; }
}

public interface ICustomerAppService
{
    Task<PagedResultDto<CustomerDto>> GetListAsync(GetCustomerListInput input);

    Task<CustomerDto> GetAsync(Guid id);

    Task<List<LookupDto>> GetLookupAsync(string? text);

    Task<CustomerDto> CreateAsync(CreateUpdateCustomerDto input);

    Task<CustomerDto> UpdateAsync(Guid id, CreateUpdateCustomerDto input);

    Task DeleteAsync(Guid id);
}
