using StageTrack.Inventory;
using Xunit;

namespace StageTrack.Domain.Tests;

public class EquipmentDisciplineTests
{
    /// <summary>Ses &gt; Line array &gt; Sub, with Işık beside it and an untagged Depo on its own.</summary>
    private static (Dictionary<Guid, EquipmentFolder> ById, EquipmentFolder Sound, EquipmentFolder LineArray, EquipmentFolder Sub, EquipmentFolder Light, EquipmentFolder Store) Tree()
    {
        var sound = new EquipmentFolder(Guid.CreateVersion7(), "Ses", null, 0);
        sound.SetDiscipline(EquipmentDiscipline.Sound);
        var lineArray = new EquipmentFolder(Guid.CreateVersion7(), "Line array", sound.Id, 0);
        var sub = new EquipmentFolder(Guid.CreateVersion7(), "Sub", lineArray.Id, 0);
        var light = new EquipmentFolder(Guid.CreateVersion7(), "Işık", null, 1);
        light.SetDiscipline(EquipmentDiscipline.Light);
        var store = new EquipmentFolder(Guid.CreateVersion7(), "Depo", null, 2);

        var byId = new[] { sound, lineArray, sub, light, store }.ToDictionary(f => f.Id);
        return (byId, sound, lineArray, sub, light, store);
    }

    [Fact]
    public void A_folder_takes_the_trade_of_the_nearest_one_above_it()
    {
        var (byId, sound, lineArray, sub, _, _) = Tree();

        Assert.Equal(EquipmentDiscipline.Sound, EquipmentDisciplines.Of(byId, sound.Id));
        Assert.Equal(EquipmentDiscipline.Sound, EquipmentDisciplines.Of(byId, lineArray.Id));
        Assert.Equal(EquipmentDiscipline.Sound, EquipmentDisciplines.Of(byId, sub.Id));
    }

    [Fact]
    public void A_subfolder_may_say_something_else_and_what_it_holds_follows_it()
    {
        var (byId, _, lineArray, sub, _, _) = Tree();
        lineArray.SetDiscipline(EquipmentDiscipline.Truss);

        Assert.Equal(EquipmentDiscipline.Truss, EquipmentDisciplines.Of(byId, lineArray.Id));
        Assert.Equal(EquipmentDiscipline.Truss, EquipmentDisciplines.Of(byId, sub.Id));
    }

    [Fact]
    public void Outside_a_tagged_folder_there_is_no_trade()
    {
        var (byId, _, _, _, _, store) = Tree();

        Assert.Null(EquipmentDisciplines.Of(byId, store.Id));
        Assert.Null(EquipmentDisciplines.Of(byId, null));
        Assert.Null(EquipmentDisciplines.Of(byId, Guid.CreateVersion7()));
    }

    [Fact]
    public void The_folders_of_a_trade_are_the_tagged_one_and_everything_under_it()
    {
        var (byId, sound, lineArray, sub, light, store) = Tree();

        var folders = EquipmentDisciplines.FoldersOf(byId.Values, EquipmentDiscipline.Sound);

        Assert.Equal(3, folders.Count);
        Assert.Contains(sound.Id, folders);
        Assert.Contains(lineArray.Id, folders);
        Assert.Contains(sub.Id, folders);
        Assert.DoesNotContain(light.Id, folders);
        Assert.DoesNotContain(store.Id, folders);
    }

    [Fact]
    public void A_cycle_ends_the_walk_instead_of_hanging()
    {
        var a = new EquipmentFolder(Guid.CreateVersion7(), "A", null, 0);
        var b = new EquipmentFolder(Guid.CreateVersion7(), "B", a.Id, 0);
        a.SetParent(b.Id);

        Assert.Null(EquipmentDisciplines.Of(new[] { a, b }.ToDictionary(f => f.Id), a.Id));
    }
}
