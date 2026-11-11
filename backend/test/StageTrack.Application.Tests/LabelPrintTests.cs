using StageTrack.Inventory;
using Xunit;

namespace StageTrack.Application.Tests;

/// <summary>
/// Printing labels for a shelf of devices. The question each device asks is the same: is there already a
/// label on it? If there is, that code is what gets printed; if there is not, one is made - and a batch of
/// them has to come out with different numbers.
/// </summary>
public class LabelPrintTests
{
    private static readonly Guid Equipment = Guid.CreateVersion7();

    private static EquipmentLabel Label(string code, LabelType type, DateTime created)
    {
        // The constructor belongs to the domain; a test builds the read-only record it would have produced.
        var label = (EquipmentLabel)Activator.CreateInstance(typeof(EquipmentLabel), true)!;
        Set(label, nameof(EquipmentLabel.Code), code);
        Set(label, nameof(EquipmentLabel.RawValue), code);
        Set(label, nameof(EquipmentLabel.Type), type);
        Set(label, nameof(EquipmentLabel.EquipmentId), Equipment);
        Set(label, nameof(EquipmentLabel.CreationTime), created);
        return label;
    }

    private static void Set(EquipmentLabel label, string property, object value) =>
        typeof(EquipmentLabel).GetProperty(property)!.SetValue(label, value);

    [Fact]
    public void A_device_with_no_label_gets_one_made_for_it()
    {
        Assert.Null(LabelAppService.PickLabel([]));

        // Nothing to reuse, so printing asks for the next number of our own.
        Assert.Equal(LabelManager.FirstOwnLabelNumber, LabelManager.NextOwnNumber([]));
    }

    [Fact]
    public void A_device_that_already_carries_a_label_keeps_its_code()
    {
        var existing = Label("RM:16:S:19483", LabelType.ImportedQr, new DateTime(2024, 1, 1));

        var picked = LabelAppService.PickLabel([existing]);

        Assert.Same(existing, picked);
    }

    [Fact]
    public void The_label_stuck_on_the_device_wins_over_one_we_printed()
    {
        var ours = Label("RM:16:S:80000000", LabelType.Qr, new DateTime(2024, 1, 1));
        var fromRentman = Label("RM:16:S:19483", LabelType.ImportedQr, new DateTime(2025, 6, 1));

        // Ours is older, but the Rentman sticker is the one physically on the device.
        Assert.Same(fromRentman, LabelAppService.PickLabel([ours, fromRentman]));
    }

    [Fact]
    public void Two_labels_of_ours_print_the_older_one()
    {
        var first = Label("RM:16:S:80000000", LabelType.Qr, new DateTime(2024, 1, 1));
        var second = Label("RM:16:S:80000005", LabelType.Qr, new DateTime(2025, 1, 1));

        Assert.Same(first, LabelAppService.PickLabel([second, first]));
    }

    [Fact]
    public void Four_unlabelled_devices_printed_at_once_get_four_different_codes()
    {
        var printed = new List<string>();
        for (var i = 0; i < 4; i++)
        {
            // Each new label is saved before the next is asked for, which is what makes the numbers advance.
            printed.Add(LabelCodeParser.Parse(LabelManager.OwnLabelValue(LabelManager.NextOwnNumber(printed), 16, isCase: false)).Code);
        }

        Assert.Equal(4, printed.Distinct().Count());
        Assert.Equal(["RM:16:S:80000000", "RM:16:S:80000001", "RM:16:S:80000002", "RM:16:S:80000003"], printed);
    }

    [Fact]
    public void A_device_already_labelled_does_not_consume_a_number()
    {
        var onTheShelf = new[] { "RM:16:S:80000000" };

        // One of four devices has a label; the three without continue from where our numbering stands.
        Assert.Equal(80_000_001, LabelManager.NextOwnNumber(onTheShelf));
    }
}
