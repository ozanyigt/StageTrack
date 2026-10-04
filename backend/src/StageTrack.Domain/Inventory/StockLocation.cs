using StageTrack.Entities;

namespace StageTrack.Inventory;

public class StockLocation : CompanyAggregateRoot
{
    public string Name { get; private set; } = null!;
    public StockLocationType Type { get; private set; }
    public string? Address { get; private set; }
    public string? City { get; private set; }
    public bool IsActive { get; private set; } = true;

    private StockLocation()
    {
    }

    public StockLocation(Guid id, string name, StockLocationType type, string? address, string? city) : base(id)
    {
        Name = name;
        Type = type;
        Address = address;
        City = city;
    }

    public void Update(string name, StockLocationType type, string? address, string? city, bool isActive)
    {
        Name = name;
        Type = type;
        Address = address;
        City = city;
        IsActive = isActive;
    }
}
