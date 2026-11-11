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

/// <summary>Where a device stands on one job: still out, back, or out past the day the job should have ended.</summary>
public enum UnitJobState
{
    Out = 1,
    Returned = 2,
    Overdue = 3
}

/// <summary>Non-blocking warnings returned with a successful scan.</summary>
/// <summary>Why one line of a case was left out of the scan.</summary>
public enum CaseScanSkipReason
{
    /// <summary>Going out: the device is out on another job.</summary>
    OnAnotherProject = 1,

    /// <summary>Going out: the device is in repair or lost, so it is not in the box to go anywhere.</summary>
    NotAvailable = 2,

    /// <summary>Coming back: it did not go out on this job - taken out of the case, or scanned on its own.</summary>
    NotOut = 3,

    /// <summary>Going out: already scanned out on this job; there is nothing left to do.</summary>
    AlreadyOut = 4
}

public enum ScanWarning
{
    NotPlanned = 1,
    OverPlanned = 2,

    /// <summary>The device scanned on its own is packed in a case; taking it out has to be confirmed.</summary>
    InsideCase = 3,

    /// <summary>Some of what is in the case cannot go out; going out with the rest has to be confirmed.</summary>
    CaseContentUnavailable = 4,

    /// <summary>The case came back without everything that went out in it.</summary>
    CaseReturnIncomplete = 5
}
