namespace StageTrack.Inventory;

public enum EquipmentType
{
    Physical = 1,
    Consumable = 2,
    Sale = 3
}

/// <summary>
/// The trade a piece of equipment belongs to. A firm does not tag every product: it tags a folder, and everything
/// under it belongs to that trade until a subfolder says otherwise. This is what the five design tabs, the stock
/// tabs and the simulation read to know a speaker from a fixture.
/// </summary>
public enum EquipmentDiscipline
{
    Led = 1,
    Sound = 2,
    Light = 3,
    Truss = 4,
    Scaff = 5
}

public enum UnitStatus
{
    InStock = 1,
    OnProject = 2,
    InRepair = 3,
    Lost = 4
}

/// <summary>
/// Origin of a physical label. Existing Rentman QR codes are kept as <see cref="RentmanQr"/>;
/// labels printed by this system are <see cref="Qr"/>. RFID tags can be added later without schema changes.
/// </summary>
public enum LabelType
{
    RentmanQr = 1,
    Qr = 2,
    Barcode = 3,
    Rfid = 4
}

public enum StockLocationType
{
    Warehouse = 1,
    StorageLocation = 2
}
