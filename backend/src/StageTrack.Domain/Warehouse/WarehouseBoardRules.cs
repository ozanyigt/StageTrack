using StageTrack.Projects;

namespace StageTrack.Warehouse;

public enum WarehouseBoardColumn
{
    Confirmed = 1,
    Prepped = 2,
    OnLocation = 3,
    ExpectedBack = 4,
    Delayed = 5
}

/// <summary>Places projects on the warehouse board for a given day, like Rentman's warehouse view.</summary>
public static class WarehouseBoardRules
{
    /// <summary>Confirmed projects that start within this many days are shown as "to prepare".</summary>
    public const int ConfirmedLookAheadDays = 7;

    public static readonly IReadOnlyList<ProjectStatus> BoardStatuses =
        [ProjectStatus.Confirmed, ProjectStatus.Prepped, ProjectStatus.OnLocation];

    public static WarehouseBoardColumn? Classify(Project project, DateTime day)
    {
        var dayStart = day.Date;
        var dayEnd = dayStart.AddDays(1);

        return project.Status switch
        {
            ProjectStatus.Confirmed when project.PlanStart < dayStart.AddDays(ConfirmedLookAheadDays + 1) => WarehouseBoardColumn.Confirmed,
            ProjectStatus.Prepped => WarehouseBoardColumn.Prepped,
            ProjectStatus.OnLocation when project.PlanEnd < dayStart => WarehouseBoardColumn.Delayed,
            ProjectStatus.OnLocation when project.PlanEnd < dayEnd => WarehouseBoardColumn.ExpectedBack,
            ProjectStatus.OnLocation => WarehouseBoardColumn.OnLocation,
            _ => null
        };
    }
}
