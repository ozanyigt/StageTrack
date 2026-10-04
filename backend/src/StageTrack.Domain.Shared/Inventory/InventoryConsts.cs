namespace StageTrack.Inventory;

public static class EquipmentConsts
{
    public const int MaxCodeLength = 64;
    public const int MaxNameLength = 256;
    public const int MaxBrandLength = 128;
    public const int MaxModelLength = 128;
    public const int MaxNotesLength = 2000;
}

public static class EquipmentFolderConsts
{
    public const int MaxNameLength = 128;
}

public static class EquipmentUnitConsts
{
    public const int MaxSerialNumberLength = 128;
    public const int MaxInternalRefLength = 128;
    public const int MaxNotesLength = 1000;
}

public static class EquipmentLabelConsts
{
    public const int MaxCodeLength = 512;
}

public static class StockLocationConsts
{
    public const int MaxNameLength = 128;
    public const int MaxAddressLength = 512;
    public const int MaxCityLength = 128;
}
