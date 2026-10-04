using StageTrack.Inventory;

namespace StageTrack.Domain.Tests;

public class LabelCodeParserTests
{
    // Exactly what a phone camera returned for the LED FLOOR 321-330 case label.
    private const string RealRentmanLabel = "{\"ID\":\"19483\",\"cmpID\":16,\"isCase\":0}";

    [Fact]
    public void Rentman_json_label_becomes_canonical_code()
    {
        var parsed = LabelCodeParser.Parse(RealRentmanLabel);

        Assert.Equal("RM:16:S:19483", parsed.Code);
        Assert.Equal(16, parsed.RentmanWorkspaceId);
        Assert.False(parsed.IsCase);
    }

    [Theory]
    [InlineData("{ \"ID\": \"19483\", \"cmpID\": 16, \"isCase\": 0 }")]
    [InlineData("{\"isCase\":0,\"cmpID\":16,\"ID\":\"19483\"}")]
    [InlineData("{\"ID\":19483,\"cmpID\":\"16\",\"isCase\":\"0\"}")]
    [InlineData("{\"id\":\"19483\",\"cmpid\":16,\"iscase\":0}")]
    [InlineData("  {\"ID\":\"19483\",\"cmpID\":16,\"isCase\":0}\r\n")]
    public void Spacing_key_order_types_and_case_do_not_change_the_code(string scanned)
    {
        Assert.Equal("RM:16:S:19483", LabelCodeParser.Parse(scanned).Code);
    }

    [Fact]
    public void Case_label_is_marked_as_case()
    {
        var parsed = LabelCodeParser.Parse("{\"ID\":\"512\",\"cmpID\":16,\"isCase\":1}");

        Assert.Equal("RM:16:C:512", parsed.Code);
        Assert.True(parsed.IsCase);
    }

    /// <summary>
    /// A handheld scanner set to a US keyboard, typing into a Windows machine with the Turkish-Q layout,
    /// produces this text for the real label: { → Ğ, " → İ, : → Ş, , → ö, } → Ü and i → ı.
    /// </summary>
    [Fact]
    public void Label_garbled_by_turkish_q_keyboard_is_recovered()
    {
        const string garbled = "ĞİIDİŞİ19483İöİcmpIDİŞ16öİısCaseİŞ0Ü";

        var parsed = LabelCodeParser.Parse(garbled);

        Assert.Equal("RM:16:S:19483", parsed.Code);
        Assert.Equal(16, parsed.RentmanWorkspaceId);
    }

    [Theory]
    [InlineData("RM:16:S:19483", "RM:16:S:19483", 16)]
    [InlineData("rm:16:s:19483", "RM:16:S:19483", 16)]
    [InlineData("RM:S:19483", "RM:S:19483", null)]
    public void Canonical_code_typed_by_hand_is_accepted(string typed, string expected, int? workspace)
    {
        var parsed = LabelCodeParser.Parse(typed);

        Assert.Equal(expected, parsed.Code);
        Assert.Equal(workspace, parsed.RentmanWorkspaceId);
    }

    [Theory]
    [InlineData("104210", "104210")]
    [InlineData("  ABC-12 ", "ABC-12")]
    [InlineData("https://staras.rentman.net/qr?code=998877", "998877")]
    [InlineData("https://example.com/labels/LBL-55", "LBL-55")]
    public void Plain_and_url_labels_keep_working(string scanned, string expected)
    {
        Assert.Equal(expected, LabelCodeParser.Parse(scanned).Code);
    }

    [Theory]
    [InlineData("Işık konsolu")]
    [InlineData("Ğ")]
    [InlineData("{not json}")]
    [InlineData("{\"cmpID\":16}")]
    public void Text_that_is_not_a_rentman_label_is_left_as_is(string scanned)
    {
        var parsed = LabelCodeParser.Parse(scanned);

        Assert.Equal(scanned.Trim(), parsed.Code);
        Assert.Null(parsed.RentmanWorkspaceId);
    }

    [Fact]
    public void Empty_scan_gives_empty_code()
    {
        Assert.Equal(string.Empty, LabelCodeParser.Parse("\r\n ").Code);
    }
}
