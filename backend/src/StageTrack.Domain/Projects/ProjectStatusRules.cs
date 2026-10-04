namespace StageTrack.Projects;

public static class ProjectStatusRules
{
    /// <summary>Statuses whose planned equipment is subtracted from availability.</summary>
    public static readonly IReadOnlyList<ProjectStatus> Reserving =
        [ProjectStatus.Pending, ProjectStatus.Confirmed, ProjectStatus.Prepped, ProjectStatus.OnLocation];

    /// <summary>Statuses in which the warehouse can scan equipment out or in.</summary>
    public static readonly IReadOnlyList<ProjectStatus> Scannable =
        [ProjectStatus.Confirmed, ProjectStatus.Prepped, ProjectStatus.OnLocation];

    private static readonly Dictionary<ProjectStatus, ProjectStatus[]> Transitions = new()
    {
        [ProjectStatus.Draft] = [ProjectStatus.Pending, ProjectStatus.Confirmed, ProjectStatus.Cancelled],
        [ProjectStatus.Pending] = [ProjectStatus.Draft, ProjectStatus.Confirmed, ProjectStatus.Cancelled],
        [ProjectStatus.Confirmed] = [ProjectStatus.Pending, ProjectStatus.Prepped, ProjectStatus.OnLocation, ProjectStatus.Cancelled],
        [ProjectStatus.Prepped] = [ProjectStatus.Confirmed, ProjectStatus.OnLocation, ProjectStatus.Cancelled],
        [ProjectStatus.OnLocation] = [ProjectStatus.Prepped, ProjectStatus.Returned],
        [ProjectStatus.Returned] = [ProjectStatus.OnLocation],
        [ProjectStatus.Cancelled] = [ProjectStatus.Draft]
    };

    public static IReadOnlyList<ProjectStatus> GetAllowedTargets(ProjectStatus from) =>
        Transitions.TryGetValue(from, out var targets) ? targets : [];

    public static bool CanTransition(ProjectStatus from, ProjectStatus to) => GetAllowedTargets(from).Contains(to);
}
