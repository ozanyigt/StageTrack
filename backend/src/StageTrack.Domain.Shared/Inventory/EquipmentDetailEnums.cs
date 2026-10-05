namespace StageTrack.Inventory;

/// <summary>How another equipment relates to an equipment (Rentman: default content, accessories, alternatives).</summary>
public enum EquipmentRelationKind
{
    /// <summary>Always travels with the item, e.g. the sections of a truss roof system.</summary>
    Content = 1,

    /// <summary>Usually rented together, e.g. a cable or a stand.</summary>
    Accessory = 2,

    /// <summary>Can replace the item when it is short.</summary>
    Alternative = 3
}

public static class EquipmentDetailConsts
{
    public const int MaxCountryLength = 64;
    public const int MaxInspectionDescriptionLength = 1000;
    public const int MaxRemarkLength = 8000;
    public const int MaxSupplierCodeLength = 64;
}
