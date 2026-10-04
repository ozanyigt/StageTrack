using StageTrack.Entities;
using StageTrack.Projects;
using StageTrack.Repositories;

namespace StageTrack.Customers;

public class Customer : CompanyAggregateRoot
{
    public string Name { get; private set; } = null!;

    /// <summary>VKN (10 digits) for companies, TCKN (11 digits) for individuals; free text for other countries.</summary>
    public string? TaxNumber { get; private set; }

    public string? TaxOffice { get; private set; }
    public string? ContactPerson { get; private set; }
    public string? Email { get; private set; }
    public string? Phone { get; private set; }
    public string? Address { get; private set; }
    public string? City { get; private set; }
    public string? Country { get; private set; }
    public string? Notes { get; private set; }

    private Customer()
    {
    }

    internal Customer(Guid id, string name) : base(id)
    {
        Name = name;
    }

    internal void SetTaxNumber(string? taxNumber) => TaxNumber = taxNumber;

    public void Update(string name, string? taxOffice, string? contactPerson, string? email, string? phone,
        string? address, string? city, string? country, string? notes)
    {
        Name = name;
        TaxOffice = taxOffice;
        ContactPerson = contactPerson;
        Email = email;
        Phone = phone;
        Address = address;
        City = city;
        Country = country;
        Notes = notes;
    }
}

public interface ICustomerRepository : IRepository<Customer>
{
    Task<bool> TaxNumberExistsAsync(string taxNumber, Guid? excludeId = null, CancellationToken cancellationToken = default);

    Task<List<Customer>> GetPagedListAsync(string? text, string? sorting, int skip, int take, CancellationToken cancellationToken = default);

    Task<long> GetCountAsync(string? text, CancellationToken cancellationToken = default);
}

public class CustomerManager(ICustomerRepository customerRepository, IProjectRepository projectRepository)
{
    public async Task<Customer> CreateAsync(string name, string? taxNumber)
    {
        var customer = new Customer(Guid.CreateVersion7(), name.Trim());
        await ChangeTaxNumberAsync(customer, taxNumber);
        return customer;
    }

    public async Task ChangeTaxNumberAsync(Customer customer, string? taxNumber)
    {
        taxNumber = string.IsNullOrWhiteSpace(taxNumber) ? null : taxNumber.Trim();
        if (taxNumber is not null && await customerRepository.TaxNumberExistsAsync(taxNumber, customer.Id))
        {
            throw new BusinessException(StageTrackErrorCodes.CustomerTaxNumberAlreadyExists).WithData("taxNumber", taxNumber);
        }

        customer.SetTaxNumber(taxNumber);
    }

    public async Task EnsureCanDeleteAsync(Customer customer)
    {
        if (await projectRepository.AnyForCustomerAsync(customer.Id))
        {
            throw new BusinessException(StageTrackErrorCodes.CustomerHasProjects);
        }
    }
}
