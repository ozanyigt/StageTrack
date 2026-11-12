using StageTrack.Design;
using StageTrack.Inventory;
using Xunit;

namespace StageTrack.Domain.Tests;

/// <summary>
/// The video trade as the demo set arranges it: VIDEO holds the screens, the projectors and the processing,
/// and the LED screens sit inside it saying something else. The awkward part is the processors - a LED wall
/// cannot be driven without them, but they are video gear, and moving them must not take them out of the LED
/// designer's reach.
/// </summary>
public class VideoTradeTests
{
    private static (Dictionary<Guid, EquipmentFolder> ById, EquipmentFolder Video, EquipmentFolder LedScreen,
        EquipmentFolder Processor, EquipmentFolder Projection) Tree()
    {
        var video = new EquipmentFolder(Guid.CreateVersion7(), "VIDEO", null, 0);
        video.SetDiscipline(EquipmentDiscipline.Video);
        var ledScreen = new EquipmentFolder(Guid.CreateVersion7(), "Led Screen", video.Id, 0);
        ledScreen.SetDiscipline(EquipmentDiscipline.Led);
        var processor = new EquipmentFolder(Guid.CreateVersion7(), "Processor", video.Id, 1);
        var projection = new EquipmentFolder(Guid.CreateVersion7(), "Projeksiyon", video.Id, 2);

        return (new[] { video, ledScreen, processor, projection }.ToDictionary(f => f.Id), video, ledScreen, processor, projection);
    }

    [Fact]
    public void Video_holds_the_trade_and_led_screen_keeps_its_own()
    {
        var (byId, video, ledScreen, processor, projection) = Tree();

        Assert.Equal(EquipmentDiscipline.Video, EquipmentDisciplines.Of(byId, video.Id));
        Assert.Equal(EquipmentDiscipline.Led, EquipmentDisciplines.Of(byId, ledScreen.Id));
        // The two folders without a tag of their own follow VIDEO, not Led Screen beside them.
        Assert.Equal(EquipmentDiscipline.Video, EquipmentDisciplines.Of(byId, processor.Id));
        Assert.Equal(EquipmentDiscipline.Video, EquipmentDisciplines.Of(byId, projection.Id));
    }

    [Fact]
    public void A_panel_under_led_screen_is_not_swept_into_the_video_trade()
    {
        var (byId, _, ledScreen, _, _) = Tree();
        var cabinets = new EquipmentFolder(Guid.CreateVersion7(), "Kabinler", ledScreen.Id, 0);
        byId[cabinets.Id] = cabinets;

        Assert.Equal(EquipmentDiscipline.Led, EquipmentDisciplines.Of(byId, cabinets.Id));
        Assert.DoesNotContain(cabinets.Id, EquipmentDisciplines.FoldersOf(byId.Values, EquipmentDiscipline.Video));
        Assert.Contains(cabinets.Id, EquipmentDisciplines.FoldersOf(byId.Values, EquipmentDiscipline.Led));
    }

    [Fact]
    public void The_video_trade_is_everything_under_video_except_the_led_screens()
    {
        var (byId, video, ledScreen, processor, projection) = Tree();

        var folders = EquipmentDisciplines.FoldersOf(byId.Values, EquipmentDiscipline.Video);

        Assert.Equal(3, folders.Count);
        Assert.Contains(video.Id, folders);
        Assert.Contains(processor.Id, folders);
        Assert.Contains(projection.Id, folders);
        Assert.DoesNotContain(ledScreen.Id, folders);
    }

    [Fact]
    public void A_processor_in_the_video_folder_is_still_a_processor()
    {
        var (byId, _, _, processor, _) = Tree();
        var equipment = (Equipment)Activator.CreateInstance(typeof(Equipment), true)!;
        var spec = new LedProcessorSpec(Guid.CreateVersion7(), equipment.Id);

        // What the LED designer offers is decided by the spec's role, which no folder can take away: moving a
        // VX400 into VIDEO / Processor changes its trade and nothing else.
        Assert.Equal(LedRole.Processor, spec.Role);
        Assert.Equal(EquipmentDiscipline.Video, EquipmentDisciplines.Of(byId, processor.Id));
    }
}
