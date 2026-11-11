using StageTrack.Inventory;
using StageTrack.Warehouse;
using Xunit;

namespace StageTrack.Domain.Tests;

/// <summary>
/// What scanning a case does to what is inside it. One scan of the box has to answer for every line in it,
/// and the interesting part is the lines it cannot move: the ones that make the warehouse stop and ask, and
/// the ones that are simply nothing to do.
/// </summary>
public class CaseScanTests
{
    private static readonly Guid Job = Guid.CreateVersion7();
    private static readonly Guid OtherJob = Guid.CreateVersion7();

    private static CaseLineState Device(string reference, UnitStatus status = UnitStatus.InStock, Guid? onProject = null) =>
        new(Guid.CreateVersion7(), Guid.CreateVersion7(), "MS DATATON WATCHPAX30", reference, 1, status, onProject, 0);

    private static CaseLineState Counted(string name, int quantity, int outOnProject = 0) =>
        new(Guid.CreateVersion7(), null, name, null, quantity, UnitStatus.InStock, null, outOnProject);

    [Fact]
    public void A_case_going_out_takes_everything_in_it()
    {
        var plan = CaseScanPlan.Build(ScanDirection.Out, Job, [Device("VID063 002"), Counted("XLR KABLO 10M", 8)]);

        Assert.Equal(2, plan.Moves.Count);
        Assert.Empty(plan.Skips);
        // The cable line goes out as eight, not as one scan repeated eight times.
        Assert.Equal(8, plan.Moves.Single(m => m.UnitId is null).Quantity);
    }

    [Fact]
    public void A_device_that_cannot_travel_stops_the_case_and_names_itself()
    {
        var plan = CaseScanPlan.Build(ScanDirection.Out, Job,
        [
            Device("VID063 002"),
            Device("VID063 001", UnitStatus.OnProject, OtherJob),
            Device("SHARPY 015", UnitStatus.InRepair),
        ]);

        Assert.Single(plan.Moves);
        Assert.Equal(2, plan.Blocking.Count);
        Assert.Equal(CaseScanSkipReason.OnAnotherProject, plan.Blocking.First(s => s.Label == "VID063 001").Reason);
        Assert.Equal(CaseScanSkipReason.NotAvailable, plan.Blocking.First(s => s.Label == "SHARPY 015").Reason);
    }

    [Fact]
    public void A_device_already_out_on_this_job_is_not_a_problem()
    {
        var plan = CaseScanPlan.Build(ScanDirection.Out, Job, [Device("VID063 002", UnitStatus.OnProject, Job)]);

        // Somebody scanned it on its own before the box; there is nothing to do and nothing to ask.
        Assert.Empty(plan.Moves);
        Assert.Empty(plan.Blocking);
        Assert.Equal(CaseScanSkipReason.AlreadyOut, plan.Skips.Single().Reason);
    }

    [Fact]
    public void A_case_coming_back_returns_what_went_out_in_it()
    {
        var plan = CaseScanPlan.Build(ScanDirection.In, Job,
        [
            Device("VID063 002", UnitStatus.OnProject, Job),
            Counted("XLR KABLO 10M", 8, outOnProject: 8),
        ]);

        Assert.Equal(2, plan.Moves.Count);
        Assert.Empty(plan.Skips);
    }

    [Fact]
    public void What_left_the_case_on_the_job_does_not_come_back_with_it()
    {
        var plan = CaseScanPlan.Build(ScanDirection.In, Job,
        [
            Device("VID063 002", UnitStatus.OnProject, Job),
            Device("VID063 003", UnitStatus.OnProject, OtherJob),
            Counted("XLR KABLO 10M", 8, outOnProject: 0),
        ]);

        Assert.Single(plan.Moves);
        Assert.Equal(2, plan.Missing.Count);
        Assert.Empty(plan.Blocking);
    }

    [Fact]
    public void A_counted_line_returns_no_more_than_went_out()
    {
        // Ten in the box, six went out on this job: six come back, not ten.
        var plan = CaseScanPlan.Build(ScanDirection.In, Job, [Counted("XLR KABLO 10M", 10, outOnProject: 6)]);

        Assert.Equal(6, plan.Moves.Single().Quantity);
    }

    [Fact]
    public void An_empty_case_travels_without_anything_to_say()
    {
        var plan = CaseScanPlan.Build(ScanDirection.Out, Job, []);

        Assert.Empty(plan.Moves);
        Assert.Empty(plan.Skips);
    }
}
