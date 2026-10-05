using StageTrack.Common;
using StageTrack.Dtos;
using StageTrack.Imports;
using StageTrack.Repositories;

namespace StageTrack.Customers;

public class CustomerAppService(
    ICustomerRepository customerRepository,
    CustomerManager customerManager,
    ImportRunner importRunner,
    IUnitOfWork unitOfWork) : ICustomerAppService
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

    /// <summary>Upsert: a row matches an existing customer by tax number, otherwise by name.</summary>
    public Task<ImportResultDto> ImportAsync(List<CustomerImportRow> rows) =>
        importRunner.RunAsync(rows, r => r.Row, async row =>
        {
            var name = ImportRunner.Required(row.Name, "name");
            var taxNumber = string.IsNullOrWhiteSpace(row.TaxNumber) ? null : row.TaxNumber.Trim();
            var customer = (taxNumber is null ? null : await customerRepository.FindByTaxNumberAsync(taxNumber))
                           ?? await customerRepository.FindByNameAsync(name);
            var created = customer is null;
            if (customer is null)
            {
                customer = await customerManager.CreateAsync(name, taxNumber);
                await customerRepository.InsertAsync(customer);
            }
            else
            {
                await customerManager.ChangeTaxNumberAsync(customer, taxNumber ?? customer.TaxNumber);
            }

            customer.Update(name, row.TaxOffice ?? customer.TaxOffice, row.ContactPerson ?? customer.ContactPerson,
                row.Email ?? customer.Email, row.Phone ?? customer.Phone, row.Address ?? customer.Address,
                row.City ?? customer.City, row.Country ?? customer.Country, customer.Notes);
            await unitOfWork.SaveChangesAsync();
            return created;
        });

    private static void Apply(Customer customer, CreateUpdateCustomerDto input) =>
        customer.Update(input.Name.Trim(), input.TaxOffice, input.ContactPerson, input.Email, input.Phone,
            input.Address, input.City, input.Country, input.Notes);
}
