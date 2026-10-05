namespace StageTrack.Warehouse;

public enum ScanDirection
{
    Out = 1,
    In = 2
}

public enum MovementAction
{
    CheckOut = 1,
    CheckIn = 2,
    LabelAssigned = 3,
    ProjectStatusChanged = 4,

    /// <summary>Device left this location for another one (e.g. TR → Dubai).</summary>
    TransferOut = 5,

    /// <summary>Device arrived from another location.</summary>
    TransferIn = 6
}

/// <summary>Non-blocking warnings returned with a successful scan.</summary>
public enum ScanWarning
{
    NotPlanned = 1,
    OverPlanned = 2
}
