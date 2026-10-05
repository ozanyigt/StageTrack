using StageTrack.Entities;
using StageTrack.Repositories;

namespace StageTrack.Suppliers;

/// <summary>A company we buy equipment from or send it to for repair.</summary>
public class Supplier : CompanyAggregateRoot
{
    public string Name { get; private set; } = null!;
    public string? ContactPerson { get; private set; }
    public string? Email { get; private set; }
    public string? Phone { get; private set; }
    public string? TaxNumber { get; private set; }
    public string? TaxOffice { get; private set; }
    public string? Address { get; private set; }
    public string? City { get; private set; }
    public string? Country { get; private set; }
    public string? Website { get; private set; }
    public string? Notes { get; private set; }

    private Supplier()
    {
    }

    internal Supplier(Guid id, string name) : base(id)
    {
        Name = name;
    }

    internal void Rename(string name) => Name = name;

    public void Update(string? contactPerson, string? email, string? phone, string? taxNumber, string? taxOffice,
        string? address, string? city, string? country, string? website, string? notes)
    {
        ContactPerson = contactPerson;
        Email = email;
        Phone = phone;
        TaxNumber = taxNumber;
        TaxOffice = taxOffice;
        Address = address;
        City = city;
        Country = country;
        Website = website;
        Notes = notes;
    }
}

public interface ISupplierRepository : IRepository<Supplier>
{
    Task<bool> NameExistsAsync(string name, Guid? excludeId = null, CancellationToken cancellationToken = default);

    Task<List<Supplier>> GetPagedListAsync(string? text, int skip, int take, CancellationToken cancellationToken = default);

    Task<long> GetCountAsync(string? text, CancellationToken cancellationToken = default);

    /// <summary>True when equipment, devices or repairs still point to the supplier.</summary>
    Task<bool> IsInUseAsync(Guid supplierId, CancellationToken cancellationToken = default);
}

public class SupplierManager(ISupplierRepository supplierRepository)
{
    public async Task<Supplier> CreateAsync(string name)
    {
        name = name.Trim();
        await EnsureNameIsUniqueAsync(name, null);
        return new Supplier(Guid.CreateVersion7(), name);
    }

    public async Task RenameAsync(Supplier supplier, string name)
    {
        name = name.Trim();
        if (supplier.Name == name)
        {
            return;
        }

        await EnsureNameIsUniqueAsync(name, supplier.Id);
        supplier.Rename(name);
    }

    public async Task EnsureCanDeleteAsync(Supplier supplier)
    {
        if (await supplierRepository.IsInUseAsync(supplier.Id))
        {
            throw new BusinessException(StageTrackErrorCodes.SupplierInUse);
        }
    }

    private async Task EnsureNameIsUniqueAsync(string name, Guid? excludeId)
    {
        if (await supplierRepository.NameExistsAsync(name, excludeId))
        {
            throw new BusinessException(StageTrackErrorCodes.SupplierNameAlreadyExists).WithData("name", name);
        }
    }
}
