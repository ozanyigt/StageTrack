using StageTrack.Projects;

namespace StageTrack.Warehouse;

/// <summary>One scan of one device, with the job it was scanned against.</summary>
public sealed record UnitMovementRow(
    Guid Id,
    DateTime At,
    MovementAction Action,
    Guid? ProjectId,
    int? ProjectNumber,
    string? ProjectName,
    string? CustomerName,
    ProjectStatus? ProjectStatus,
    DateTime? PlanStart,
    DateTime? PlanEnd,
    string? UserName,
    string? Note);

/// <summary>
/// A device's stay on one job: when it left, who scanned it out, when it came back and who took it in. Several
/// scans of the same device on the same job (a part returned early and taken out again) fold into this one line;
/// the scans themselves are kept so the row can be opened.
/// </summary>
public sealed record UnitJob(
    Guid ProjectId,
    int? ProjectNumber,
    string? ProjectName,
    string? CustomerName,
    ProjectStatus? ProjectStatus,
    DateTime? PlanStart,
    DateTime? PlanEnd,
    DateTime? OutAt,
    string? OutBy,
    DateTime? InAt,
    string? InBy,
    int Days,
    UnitJobState State,
    IReadOnlyList<UnitMovementRow> Movements);

/// <summary>
/// The jobs a device has been on, read out of its scans. The warehouse records every scan on its own; what a
/// technician wants to see is one line per job - left on the 5th, back on the 8th, three days out - with the
/// scans underneath for the day somebody asks who took it.
/// </summary>
public static class UnitJobHistory
{
    /// <param name="rows">Every scan of the device, in any order.</param>
    /// <param name="today">The day the "still out" rows are measured against.</param>
    public static List<UnitJob> Build(IEnumerable<UnitMovementRow> rows, DateTime today)
    {
        // Scans with no job behind them (a label attached, a transfer between locations) belong to the device's
        // own movement log, not to its working life.
        var jobs = rows
            .Where(r => r.ProjectId.HasValue)
            .GroupBy(r => r.ProjectId!.Value)
            .Select(group => Job(group.Key, [.. group.OrderBy(r => r.At)], today))
            .OrderByDescending(j => j.OutAt ?? j.InAt ?? DateTime.MinValue)
            .ToList();

        return jobs;
    }

    private static UnitJob Job(Guid projectId, IReadOnlyList<UnitMovementRow> scans, DateTime today)
    {
        var outs = scans.Where(s => s.Action == MovementAction.CheckedOut).ToList();
        var ins = scans.Where(s => s.Action == MovementAction.CheckedIn).ToList();
        var first = outs.FirstOrDefault();
        var last = ins.LastOrDefault();

        // Out until as many came back as went out; the last scan decides a tie, because a device taken out
        // again after an early return is out.
        var back = ins.Count >= outs.Count && scans[^1].Action == MovementAction.CheckedIn;
        var head = scans[0];

        var from = first?.At ?? head.At;
        var to = back ? last?.At ?? from : today;
        var state = back ? UnitJobState.Returned
            : head.PlanEnd is { } end && end.Date < today.Date ? UnitJobState.Overdue
            : UnitJobState.Out;

        return new UnitJob(
            projectId,
            head.ProjectNumber,
            head.ProjectName,
            head.CustomerName,
            head.ProjectStatus,
            head.PlanStart,
            head.PlanEnd,
            first?.At,
            first?.UserName,
            back ? last?.At : null,
            back ? last?.UserName : null,
            Days(from, to),
            state,
            scans.Reverse().ToList());
    }

    /// <summary>Whole days on site, counting the day it left as the first one.</summary>
    private static int Days(DateTime from, DateTime to) => Math.Max(1, (int)(to.Date - from.Date).TotalDays + 1);
}
