using StageTrack.Inventory;

namespace StageTrack.Warehouse;

/// <summary>
/// One line of a case as the plan has to see it: what it is, and where that thing stands right now.
/// </summary>
/// <param name="Quantity">Pieces in the box; always 1 for a device.</param>
/// <param name="UnitStatus">Only meaningful for a device line.</param>
/// <param name="CurrentProjectId">The job the device is out on, if any.</param>
/// <param name="OutOnProject">For a counted line: how many of that equipment are out on this job already.</param>
public sealed record CaseLineState(
    Guid EquipmentId,
    Guid? UnitId,
    string EquipmentName,
    string? UnitRef,
    int Quantity,
    UnitStatus UnitStatus,
    Guid? CurrentProjectId,
    int OutOnProject)
{
    /// <summary>What to call this line on screen: the device if there is one, else the equipment.</summary>
    public string Label => UnitRef ?? EquipmentName;
}

/// <summary>One movement the case scan will write.</summary>
public sealed record CaseScanMove(Guid EquipmentId, Guid? UnitId, int Quantity, string Label);

/// <summary>One line the case scan will not touch, and why.</summary>
public sealed record CaseScanSkip(Guid EquipmentId, Guid? UnitId, string Label, CaseScanSkipReason Reason);

/// <summary>
/// Scanning a case moves everything in it. What that means is worked out here, without a database: the box
/// is read line by line against where each thing currently stands, and the answer is a list of movements to
/// write plus a list of lines that were left behind with the reason.
///
/// Two of the reasons are not problems. On the way out, a device already scanned out on this job needs
/// nothing; on the way back, a line that never went out (it was taken out of the case, or walked out on its
/// own scan) has nothing to return. Only a device that cannot go out at all - on another job, in repair,
/// lost - makes the scan incomplete, and that is the question the warehouse is asked before anything is
/// written.
/// </summary>
public sealed record CaseScanPlan(IReadOnlyList<CaseScanMove> Moves, IReadOnlyList<CaseScanSkip> Skips)
{
    /// <summary>Lines the warehouse has to be told about before the scan goes through.</summary>
    public IReadOnlyList<CaseScanSkip> Blocking =>
        Skips.Where(s => s.Reason is CaseScanSkipReason.OnAnotherProject or CaseScanSkipReason.NotAvailable).ToList();

    /// <summary>Lines that should have come back with the box but did not.</summary>
    public IReadOnlyList<CaseScanSkip> Missing =>
        Skips.Where(s => s.Reason == CaseScanSkipReason.NotOut).ToList();

    public static CaseScanPlan Build(ScanDirection direction, Guid projectId, IReadOnlyList<CaseLineState> contents)
    {
        var moves = new List<CaseScanMove>();
        var skips = new List<CaseScanSkip>();

        foreach (var line in contents)
        {
            var skip = direction == ScanDirection.Out ? OutReason(line, projectId) : InReason(line, projectId);
            if (skip is { } reason)
            {
                skips.Add(new CaseScanSkip(line.EquipmentId, line.UnitId, line.Label, reason));
                continue;
            }

            var quantity = line.UnitId.HasValue
                ? 1
                : direction == ScanDirection.Out ? line.Quantity : Math.Min(line.Quantity, line.OutOnProject);
            moves.Add(new CaseScanMove(line.EquipmentId, line.UnitId, quantity, line.Label));
        }

        return new CaseScanPlan(moves, skips);
    }

    private static CaseScanSkipReason? OutReason(CaseLineState line, Guid projectId)
    {
        if (line.UnitId is null)
        {
            // A counted line has no state of its own: what is in the box goes out with the box.
            return null;
        }

        if (line.CurrentProjectId == projectId)
        {
            return CaseScanSkipReason.AlreadyOut;
        }

        if (line.CurrentProjectId.HasValue || line.UnitStatus == UnitStatus.OnProject)
        {
            return CaseScanSkipReason.OnAnotherProject;
        }

        return line.UnitStatus == UnitStatus.InStock ? null : CaseScanSkipReason.NotAvailable;
    }

    private static CaseScanSkipReason? InReason(CaseLineState line, Guid projectId)
    {
        if (line.UnitId is null)
        {
            return line.OutOnProject > 0 ? null : CaseScanSkipReason.NotOut;
        }

        return line.CurrentProjectId == projectId ? null : CaseScanSkipReason.NotOut;
    }
}
