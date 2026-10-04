using StageTrack.Entities;
using StageTrack.Repositories;

namespace StageTrack.Companies;

/// <summary>A legal entity using the system (e.g. Staras Technical TR, Staras Dubai). Owns all business data.</summary>
public class Company : AggregateRoot
{
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

    public Company(Guid id, string name, string code, string defaultCurrency, decimal defaultVatRate, string countryCode)
        : base(id)
    {
        Name = name;
        Code = code;
        DefaultCurrency = defaultCurrency;
        DefaultVatRate = defaultVatRate;
        CountryCode = countryCode;
    }

    public void SetRentmanWorkspace(int? workspaceId) => RentmanWorkspaceId = workspaceId;
}

public interface ICompanyRepository : IRepository<Company>
{
}
