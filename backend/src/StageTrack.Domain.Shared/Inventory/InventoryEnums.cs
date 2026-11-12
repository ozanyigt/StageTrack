namespace StageTrack.Inventory;

public enum EquipmentType
{
    Physical = 1,
    Consumable = 2,
    ForSale = 3,

    /// <summary>
    /// A box that travels with several devices inside it (a rack, a flight case). One record is one physical
    /// box: never serial-tracked, always one in stock, and what is inside it is named device by device.
    /// </summary>
    Case = 4
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
    Scaffold = 5,

    /// <summary>Screens, projectors, media servers and the processing between them - LED walls excepted.</summary>
    Video = 6
}

public enum UnitStatus
{
    InStock = 1,
    OnProject = 2,
    InRepair = 3,
    Lost = 4
}

/// <summary>What scanning a label at an open case did, so the screen can say it in one line.</summary>
public enum CaseScanOutcome
{
    /// <summary>A new line: the device, or the first pieces of a counted item.</summary>
    Added = 1,

    /// <summary>A counted item that was already in the box; its count went up by one.</summary>
    Increased = 2,

    /// <summary>This very device is already in this box; nothing changed.</summary>
    AlreadyHere = 3,

    /// <summary>The device sits in another case; the user has to say whether to move it.</summary>
    NeedsConfirmation = 4
}

/// <summary>
/// Origin of a physical label. Existing Rentman QR codes are kept as <see cref="ImportedQr"/>;
/// labels printed by this system are <see cref="Qr"/>. RFID tags can be added later without schema changes.
/// </summary>
public enum LabelType
{
    ImportedQr = 1,
    Qr = 2,
    Barcode = 3,
    Rfid = 4
}

public enum StockLocationType
{
    Warehouse = 1,
    Storage = 2
}
