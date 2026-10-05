using StageTrack.Projects;
using Xunit;

namespace StageTrack.Domain.Tests;

public class ProjectSectionTests
{
    private static Project NewProject() => new(Guid.CreateVersion7(), 1, "Test", DateTime.Today, DateTime.Today.AddDays(2));

    [Fact]
    public void Outline_lists_children_under_their_parent_with_full_path()
    {
        var project = NewProject();
        var sound = project.AddSection("SES", null);
        var light = project.AddSection("IŞIK", null);
        project.AddSection("Hoparlör", sound.Id);

        var outline = project.GetSectionOutline();

        Assert.Equal(["SES", "SES / Hoparlör", "IŞIK"], outline.Select(o => o.Path));
        Assert.Equal([1, 2, 1], outline.Select(o => o.Depth));
        Assert.Equal(light.Id, outline[2].Section.Id);
    }

    [Fact]
    public void Sections_cannot_be_nested_deeper_than_two_levels()
    {
        var project = NewProject();
        var stage = project.AddSection("ANA SAHNE", null);
        var corridor = project.AddSection("Koridor", stage.Id);

        var ex = Assert.Throws<BusinessException>(() => project.AddSection("Alt", corridor.Id));
        Assert.Equal(StageTrackErrorCodes.SectionTooDeep, ex.Code);
    }

    [Fact]
    public void Same_equipment_in_another_section_is_a_separate_line()
    {
        var project = NewProject();
        var stage = project.AddSection("ANA SAHNE", null);
        var corridor = project.AddSection("KORİDOR", null);
        var speaker = Guid.CreateVersion7();

        project.AddEquipment(speaker, 4, stage.Id);
        project.AddEquipment(speaker, 2, corridor.Id);
        project.AddEquipment(speaker, 1, stage.Id);

        Assert.Equal(2, project.Equipment.Count);
        Assert.Equal(5, project.Equipment.Single(e => e.SectionId == stage.Id).Quantity);
        Assert.Equal(7, project.GetPlannedQuantity(speaker));
    }

    [Fact]
    public void Removing_a_section_keeps_its_lines_in_the_parent()
    {
        var project = NewProject();
        var sound = project.AddSection("SES", null);
        var speakers = project.AddSection("Hoparlör", sound.Id);
        var line = project.AddEquipment(Guid.CreateVersion7(), 2, speakers.Id);

        project.RemoveSection(speakers.Id);

        Assert.Equal(sound.Id, line.SectionId);
        Assert.Single(project.Sections);
    }
}

public class AvailabilityTests
{
    private static readonly Guid Speaker = Guid.CreateVersion7();

    [Fact]
    public void Items_already_out_on_the_project_are_not_reported_as_missing()
    {
        // 10 owned, all 10 out on this project; another overlapping project reserves 4.
        // The shortage belongs to the other project, not to the one that already has the items.
        var availability = new EquipmentAvailability(Speaker, Stock: 10, PlannedElsewhere: 4);

        Assert.Equal(0, AvailabilityManager.GetShortage(needed: 10, outOnProject: 10, availability));
    }

    [Fact]
    public void Remaining_need_competes_with_other_projects()
    {
        var availability = new EquipmentAvailability(Speaker, Stock: 10, PlannedElsewhere: 7);

        Assert.Equal(2, AvailabilityManager.GetShortage(needed: 8, outOnProject: 3, availability));
    }

    [Fact]
    public void Projects_that_do_not_overlap_each_other_are_not_added_together()
    {
        var start = new DateTime(2026, 10, 1);
        var reservations = new[]
        {
            new EquipmentReservation(Speaker, 6, start, start.AddDays(2)),
            new EquipmentReservation(Speaker, 5, start.AddDays(3), start.AddDays(5)),
        };

        Assert.Equal(6, AvailabilityManager.GetPeak(reservations, start, start.AddDays(10)));
    }
}
