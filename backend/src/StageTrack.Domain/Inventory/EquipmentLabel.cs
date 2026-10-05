using StageTrack.Entities;

namespace StageTrack.Inventory;

/// <summary>
/// A physical label (Rentman QR, own QR, barcode, RFID tag) linked to an equipment or to one device.
/// Several labels may point to the same target, so old Rentman labels keep working next to new ones.
/// </summary>
public class EquipmentLabel : CompanyAggregateRoot
{
    /// <summary>Normalized value used for lookups (see <see cref="LabelManager.Normalize"/>).</summary>
    public string Code { get; private set; } = null!;

    /// <summary>The exact text read from the label, kept for traceability.</summary>
    public string RawValue { get; private set; } = null!;

    public LabelType Type { get; private set; }
    public Guid EquipmentId { get; private set; }

    /// <summary>Set when the label belongs to a single device; null for equipment-level labels.</summary>
    public Guid? UnitId { get; private set; }

    private EquipmentLabel()
    {
    }

    internal EquipmentLabel(Guid id, string code, string rawValue, LabelType type, Guid equipmentId, Guid? unitId)
        : base(id)
    {
        Code = code;
        RawValue = rawValue;
        Type = type;
        EquipmentId = equipmentId;
        UnitId = unitId;
    }

    /// <summary>Follows its device to another location (company); called only by the transfer manager.</summary>
    internal void MoveToCompany(Guid companyId, Guid equipmentId)
    {
        CompanyId = companyId;
        EquipmentId = equipmentId;
    }
}
