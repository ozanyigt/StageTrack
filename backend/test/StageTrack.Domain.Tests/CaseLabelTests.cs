using StageTrack.Inventory;
using Xunit;

namespace StageTrack.Domain.Tests;

/// <summary>
/// The label of a case. Rentman writes isCase on the QR of a box, and the same physical rack must not read
/// as a box when its label came from Rentman and as a single item when we printed it ourselves.
/// </summary>
public class CaseLabelTests
{
    private const int Workspace = 16;

    [Fact]
    public void A_label_printed_for_a_case_says_it_is_a_case()
    {
        var raw = LabelManager.OwnLabelValue(80_000_001, Workspace, isCase: true);

        var parsed = LabelCodeParser.Parse(raw);

        Assert.True(parsed.IsCase);
        Assert.Equal("RM:16:C:80000001", parsed.Code);
        Assert.Equal(Workspace, parsed.RentmanWorkspaceId);
    }

    [Fact]
    public void A_label_printed_for_anything_else_does_not()
    {
        var parsed = LabelCodeParser.Parse(LabelManager.OwnLabelValue(80_000_001, Workspace, isCase: false));

        Assert.False(parsed.IsCase);
        Assert.Equal("RM:16:S:80000001", parsed.Code);
    }

    [Fact]
    public void A_real_rentman_case_label_reads_as_the_same_code_we_would_print()
    {
        // What a scanner returns from a box labelled in Rentman, where isCase is a JSON boolean.
        var fromRentman = LabelCodeParser.Parse("{\"ID\":\"19483\",\"cmpID\":16,\"isCase\":true}");

        Assert.True(fromRentman.IsCase);
        Assert.Equal("RM:16:C:19483", fromRentman.Code);
        Assert.Equal(fromRentman.Code, LabelCodeParser.Parse(LabelManager.OwnLabelValue(19_483, Workspace, isCase: true)).Code);
    }

    [Fact]
    public void Our_own_numbering_starts_above_rentmans_and_keeps_going()
    {
        // Nothing printed here yet: the first one starts where our own range starts.
        Assert.Equal(LabelManager.FirstOwnLabelNumber, LabelManager.NextOwnNumber([]));

        // Rentman's own ids are far below the range and never move it.
        Assert.Equal(LabelManager.FirstOwnLabelNumber, LabelManager.NextOwnNumber(["RM:16:S:19483", "RM:16:C:900050"]));

        // A case label of ours counts towards the numbering exactly like any other.
        Assert.Equal(80_000_002, LabelManager.NextOwnNumber(["RM:16:S:80000000", "RM:16:C:80000001"]));
    }

    [Fact]
    public void A_workspace_we_do_not_know_still_produces_a_readable_label()
    {
        var parsed = LabelCodeParser.Parse(LabelManager.OwnLabelValue(80_000_003, 0, isCase: true));

        Assert.True(parsed.IsCase);
        Assert.Equal("RM:0:C:80000003", parsed.Code);
    }
}
