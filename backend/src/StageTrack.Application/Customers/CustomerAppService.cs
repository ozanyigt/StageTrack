using StageTrack.Dtos;

namespace StageTrack.Customers;

public class CustomerAppService(ICustomerRepository customerRepository, CustomerManager customerManager) : ICustomerAppService
{
    public async Task<PagedResultDto<CustomerDto>> GetListAsync(GetCustomerListInput input)
    {
        var total = await customerRepository.GetCountAsync(input.Text);
        var items = await customerRepository.GetPagedListAsync(input.Text, input.Sorting, input.SkipCount, input.MaxResultCount);
        return new PagedResultDto<CustomerDto>(total, items.Select(c => c.ToDto()).ToList());
    }

    public async Task<CustomerDto> GetAsync(Guid id) => (await customerRepository.GetAsync(id)).ToDto();

    public async Task<List<LookupDto>> GetLookupAsync(string? text) =>
        (await customerRepository.GetPagedListAsync(text, null, 0, 30))
        .Select(c => new LookupDto { Id = c.Id, Name = c.Name, Code = c.TaxNumber })
        .ToList();

    public async Task<CustomerDto> CreateAsync(CreateUpdateCustomerDto input)
    {
        var customer = await customerManager.CreateAsync(input.Name, input.TaxNumber);
        Apply(customer, input);
        await customerRepository.InsertAsync(customer);
        return customer.ToDto();
    }

    public async Task<CustomerDto> UpdateAsync(Guid id, CreateUpdateCustomerDto input)
    {
        var customer = await customerRepository.GetAsync(id);
        await customerManager.ChangeTaxNumberAsync(customer, input.TaxNumber);
        Apply(customer, input);
        return customer.ToDto();
    }

    public async Task DeleteAsync(Guid id)
    {
        var customer = await customerRepository.GetAsync(id);
        await customerManager.EnsureCanDeleteAsync(customer);
        await customerRepository.DeleteAsync(customer);
    }

    private static void Apply(Customer customer, CreateUpdateCustomerDto input) =>
        customer.Update(input.Name.Trim(), input.TaxOffice, input.ContactPerson, input.Email, input.Phone,
            input.Address, input.City, input.Country, input.Notes);
}
