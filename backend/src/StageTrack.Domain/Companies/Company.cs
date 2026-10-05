using StageTrack.Entities;
using StageTrack.Repositories;

namespace StageTrack.Companies;

/// <summary>
/// A location of a customer firm (e.g. Staras Technical TR, Staras Dubai). Owns all business data; each location's
/// data is separate. Belongs to one <see cref="Tenants.Tenant"/>.
/// </summary>
public class Company : AggregateRoot
{
    public Guid TenantId { get; private set; }

    public string Name { get; private set; } = null!;
    public string Code { get; private set; } = null!;
    public string DefaultCurrency { get; private set; } = null!;
    public decimal DefaultVatRate { get; private set; }
    public string CountryCode { get; private set; } = null!;

    /// <summary>
    /// Rentman workspace number (cmpID in Rentman QR labels). Used to reject labels printed for another
    /// workspace; null disables the check.
    /// </summary>
    public int? RentmanWorkspaceId { get; private set; }

    private Company()
    {
    }

    public Company(Guid id, string name, string code, string defaultCurrency, decimal defaultVatRate, string countryCode, Guid tenantId)
        : base(id)
    {
        TenantId = tenantId;
        Name = name;
        Code = code;
        DefaultCurrency = defaultCurrency;
        DefaultVatRate = defaultVatRate;
        CountryCode = countryCode;
    }

    public void SetRentmanWorkspace(int? workspaceId) => RentmanWorkspaceId = workspaceId;

    /// <summary>Code is fixed after creation (it may be printed on documents).</summary>
    public void Update(string name, string defaultCurrency, decimal defaultVatRate, string countryCode)
    {
        Name = name.Trim();
        DefaultCurrency = defaultCurrency.Trim().ToUpperInvariant();
        DefaultVatRate = defaultVatRate;
        CountryCode = countryCode.Trim().ToUpperInvariant();
    }
}

public interface ICompanyRepository : IRepository<Company>
{
    Task<bool> CodeExistsAsync(Guid tenantId, string code, CancellationToken cancellationToken = default);

    Task<List<Company>> GetListByTenantAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
