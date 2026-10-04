using StageTrack.Entities;

namespace StageTrack.Inventory;

/// <summary>
/// A rentable item type (e.g. "Clay Paky Sharpy"). Serialized equipment is tracked per
/// physical device (<see cref="EquipmentUnit"/>); otherwise by <see cref="StockQuantity"/>.
/// </summary>
public class Equipment : CompanyAggregateRoot
{
    public string Code { get; private set; } = null!;
    public string Name { get; private set; } = null!;
    public string? Brand { get; private set; }
    public string? Model { get; private set; }
    public Guid? FolderId { get; private set; }
    public EquipmentType Type { get; private set; }
    public bool IsSerialized { get; private set; }

    /// <summary>Stock for quantity-tracked equipment. Ignored when <see cref="IsSerialized"/> is true.</summary>
    public int StockQuantity { get; private set; }

    /// <summary>Rental price for one day, in the company currency. Quotes multiply it by the day multiplier.</summary>
    public decimal RentalPrice { get; private set; }

    public decimal? WeightKg { get; private set; }
    public decimal? VolumeM3 { get; private set; }
    public string? Notes { get; private set; }
    public bool IsArchived { get; private set; }

    private Equipment()
    {
    }

    internal Equipment(Guid id, string code, string name, EquipmentType type, bool isSerialized) : base(id)
    {
        Code = code;
        Name = name;
        Type = type;
        IsSerialized = isSerialized;
    }

    internal void SetCode(string code) => Code = code;

    internal void SetSerialized(bool isSerialized) => IsSerialized = isSerialized;

    public void Update(string name, string? brand, string? model, Guid? folderId, EquipmentType type,
        decimal? weightKg, decimal? volumeM3, string? notes)
    {
        Name = name;
        Brand = brand;
        Model = model;
        FolderId = folderId;
        Type = type;
        WeightKg = weightKg;
        VolumeM3 = volumeM3;
        Notes = notes;
    }

    public void SetRentalPrice(decimal price) => RentalPrice = Math.Max(0, Math.Round(price, 2));

    public void SetStockQuantity(int quantity) => StockQuantity = Math.Max(0, quantity);

    internal void Archive() => IsArchived = true;

    public void Restore() => IsArchived = false;
}
