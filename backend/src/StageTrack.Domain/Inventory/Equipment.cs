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
    public string? CountryOfOrigin { get; private set; }

    /// <summary>Stock for quantity-tracked equipment. Ignored when <see cref="IsSerialized"/> is true.</summary>
    public int StockQuantity { get; private set; }

    /// <summary>Rental price for one day, in the company currency. Quotes multiply it by the day multiplier.</summary>
    public decimal RentalPrice { get; private set; }

    public decimal? LengthCm { get; private set; }
    public decimal? WidthCm { get; private set; }
    public decimal? HeightCm { get; private set; }
    public decimal? WeightKg { get; private set; }
    public decimal? VolumeM3 { get; private set; }
    public decimal? PowerW { get; private set; }
    public decimal? CurrentA { get; private set; }

    /// <summary>How many pieces go into one case or pack (Rentman "Packed per").</summary>
    public int PackedPer { get; private set; } = 1;

    public string? Notes { get; private set; }
    public bool IsArchived { get; private set; }
    public Guid? ImageAttachmentId { get; private set; }

    /// <summary>Periodic inspection interval (e.g. 12 months for rigging); null when the item needs none.</summary>
    public int? InspectionIntervalMonths { get; private set; }

    public string? InspectionDescription { get; private set; }

    public ICollection<EquipmentRelation> Relations { get; private set; } = new List<EquipmentRelation>();
    public ICollection<EquipmentSupplier> Suppliers { get; private set; } = new List<EquipmentSupplier>();

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

    public void Update(string name, string? brand, string? model, Guid? folderId, EquipmentType type, string? countryOfOrigin, string? notes)
    {
        Name = name;
        Brand = brand;
        Model = model;
        FolderId = folderId;
        Type = type;
        CountryOfOrigin = countryOfOrigin;
        Notes = notes;
    }

    public void UpdatePhysical(decimal? lengthCm, decimal? widthCm, decimal? heightCm, decimal? weightKg, decimal? volumeM3,
        decimal? powerW, decimal? currentA, int packedPer)
    {
        LengthCm = lengthCm;
        WidthCm = widthCm;
        HeightCm = heightCm;
        WeightKg = weightKg;
        // When dimensions are known and no volume was entered, the transport volume follows from them (cm³ → m³).
        VolumeM3 = volumeM3 ?? (lengthCm * widthCm * heightCm) / 1_000_000m;
        PowerW = powerW;
        CurrentA = currentA;
        PackedPer = Math.Max(1, packedPer);
    }

    public void SetInspection(int? intervalMonths, string? description)
    {
        InspectionIntervalMonths = intervalMonths is > 0 ? intervalMonths : null;
        InspectionDescription = InspectionIntervalMonths is null ? null : description;
    }

    public void SetImage(Guid? attachmentId) => ImageAttachmentId = attachmentId;

    public void SetRentalPrice(decimal price) => RentalPrice = Math.Max(0, Math.Round(price, 2));

    public void SetStockQuantity(int quantity) => StockQuantity = Math.Max(0, quantity);

    internal void Archive() => IsArchived = true;

    public void Restore() => IsArchived = false;

    internal EquipmentRelation AddRelation(EquipmentRelationKind kind, Guid relatedEquipmentId, int quantity)
    {
        if (relatedEquipmentId == Id)
        {
            throw new BusinessException(StageTrackErrorCodes.RelationSelf);
        }

        if (Relations.Any(r => r.Kind == kind && r.RelatedEquipmentId == relatedEquipmentId))
        {
            throw new BusinessException(StageTrackErrorCodes.RelationDuplicate);
        }

        var relation = new EquipmentRelation(Guid.CreateVersion7(), Id, kind, relatedEquipmentId, Math.Max(1, quantity),
            Relations.Count(r => r.Kind == kind) + 1);
        Relations.Add(relation);
        return relation;
    }

    public void UpdateRelation(Guid relationId, int quantity) => GetRelation(relationId).SetQuantity(Math.Max(1, quantity));

    public void RemoveRelation(Guid relationId) => Relations.Remove(GetRelation(relationId));

    internal EquipmentSupplier AddSupplier(Guid supplierId, string? supplierCode, decimal? purchasePrice, bool isPreferred)
    {
        if (Suppliers.Any(s => s.SupplierId == supplierId))
        {
            throw new BusinessException(StageTrackErrorCodes.SupplierDuplicate);
        }

        if (isPreferred)
        {
            foreach (var other in Suppliers)
            {
                other.SetPreferred(false);
            }
        }

        var link = new EquipmentSupplier(Guid.CreateVersion7(), Id, supplierId);
        link.Update(supplierCode, purchasePrice, isPreferred || Suppliers.Count == 0);
        Suppliers.Add(link);
        return link;
    }

    public void UpdateSupplier(Guid linkId, string? supplierCode, decimal? purchasePrice, bool isPreferred)
    {
        var link = Suppliers.FirstOrDefault(s => s.Id == linkId) ?? throw new EntityNotFoundException(typeof(EquipmentSupplier), linkId);
        if (isPreferred)
        {
            foreach (var other in Suppliers.Where(s => s.Id != linkId))
            {
                other.SetPreferred(false);
            }
        }

        link.Update(supplierCode, purchasePrice, isPreferred);
    }

    public void RemoveSupplier(Guid linkId) =>
        Suppliers.Remove(Suppliers.FirstOrDefault(s => s.Id == linkId) ?? throw new EntityNotFoundException(typeof(EquipmentSupplier), linkId));

    private EquipmentRelation GetRelation(Guid relationId) =>
        Relations.FirstOrDefault(r => r.Id == relationId) ?? throw new EntityNotFoundException(typeof(EquipmentRelation), relationId);
}

/// <summary>Default content, accessory or alternative of an equipment.</summary>
public class EquipmentRelation : Entity
{
    public Guid EquipmentId { get; private set; }
    public EquipmentRelationKind Kind { get; private set; }
    public Guid RelatedEquipmentId { get; private set; }
    public int Quantity { get; private set; }
    public int SortOrder { get; private set; }

    private EquipmentRelation()
    {
    }

    internal EquipmentRelation(Guid id, Guid equipmentId, EquipmentRelationKind kind, Guid relatedEquipmentId, int quantity, int sortOrder)
        : base(id)
    {
        EquipmentId = equipmentId;
        Kind = kind;
        RelatedEquipmentId = relatedEquipmentId;
        Quantity = quantity;
        SortOrder = sortOrder;
    }

    internal void SetQuantity(int quantity) => Quantity = quantity;
}

/// <summary>A supplier that sells (or repairs) this equipment, with its own code and last purchase price.</summary>
public class EquipmentSupplier : Entity
{
    public Guid EquipmentId { get; private set; }
    public Guid SupplierId { get; private set; }
    public string? SupplierCode { get; private set; }
    public decimal? PurchasePrice { get; private set; }
    public bool IsPreferred { get; private set; }

    private EquipmentSupplier()
    {
    }

    internal EquipmentSupplier(Guid id, Guid equipmentId, Guid supplierId) : base(id)
    {
        EquipmentId = equipmentId;
        SupplierId = supplierId;
    }

    internal void Update(string? supplierCode, decimal? purchasePrice, bool isPreferred)
    {
        SupplierCode = supplierCode;
        PurchasePrice = purchasePrice;
        IsPreferred = isPreferred;
    }

    internal void SetPreferred(bool isPreferred) => IsPreferred = isPreferred;
}
