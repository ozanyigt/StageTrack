namespace StageTrack.Warehouse;

public enum ScanDirection
{
    Out = 1,
    In = 2
}

public enum MovementAction
{
    CheckedOut = 1,
    CheckedIn = 2,
    LabelAssigned = 3,
    ProjectStatusChanged = 4,

    /// <summary>Device left this location for another one (e.g. TR → Dubai).</summary>
    TransferredOut = 5,

    /// <summary>Device arrived from another location.</summary>
    TransferredIn = 6
}

/// <summary>Non-blocking warnings returned with a successful scan.</summary>
public enum ScanWarning
{
    NotPlanned = 1,
    OverPlanned = 2
}
