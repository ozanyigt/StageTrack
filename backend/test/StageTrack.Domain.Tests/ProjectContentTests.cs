using StageTrack.Projects;
using Xunit;

namespace StageTrack.Domain.Tests;

public class ProjectContentTests
{
    private static readonly Guid Case = Guid.CreateVersion7();
    private static readonly Guid Monitor = Guid.CreateVersion7();
    private static readonly Guid Cable = Guid.CreateVersion7();

    private static (Project Project, ProjectEquipment CaseLine) ProjectWithCase(int cases)
    {
        var project = new Project(Guid.CreateVersion7(), 1, "Test", DateTime.Today, DateTime.Today.AddDays(2));
        var line = project.AddEquipment(Case, cases, null);
        project.SetContent(line, [(Monitor, 2), (Cable, 4)]);
        return (project, line);
    }

    [Fact]
    public void Case_content_is_planned_as_child_lines_multiplied_by_the_case_quantity()
    {
        var (project, line) = ProjectWithCase(2);

        Assert.Equal(4, project.GetPlannedQuantity(Monitor));
        Assert.Equal(8, project.GetPlannedQuantity(Cable));
        Assert.All(project.Equipment.Where(e => e.EquipmentId != Case), e => Assert.Equal(line.Id, e.ParentLineId));
    }

    [Fact]
    public void Changing_the_case_quantity_updates_its_content()
    {
        var (project, line) = ProjectWithCase(1);

        project.UpdateEquipment(line.Id, 3, null);

        Assert.Equal(6, project.GetPlannedQuantity(Monitor));
        Assert.Equal(12, project.GetPlannedQuantity(Cable));
    }

    [Fact]
    public void Content_lines_follow_their_case_and_cannot_be_removed_alone()
    {
        var (project, line) = ProjectWithCase(1);
        var monitorLine = project.Equipment.Single(e => e.EquipmentId == Monitor);

        var ex = Assert.Throws<BusinessException>(() => project.RemoveEquipment(monitorLine.Id));
        Assert.Equal(StageTrackErrorCodes.ProjectContentLineLocked, ex.Code);

        project.RemoveEquipment(line.Id);
        Assert.Empty(project.Equipment);
    }

    [Fact]
    public void Warehouse_extras_go_to_one_added_products_section()
    {
        var (project, _) = ProjectWithCase(1);

        project.AddWarehouseExtra(Monitor);
        project.AddWarehouseExtra(Monitor);

        var section = Assert.Single(project.Sections, s => s.IsWarehouseExtras);
        var extra = Assert.Single(project.Equipment, e => e.IsExtra);
        Assert.Equal(section.Id, extra.SectionId);
        Assert.Equal(2, extra.Quantity);
        Assert.Equal(4, project.GetPlannedQuantity(Monitor));
    }
}
