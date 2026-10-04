using StageTrack.Inventory;

namespace StageTrack.Projects;

public record EquipmentAvailability(Guid EquipmentId, int Stock, int PlannedElsewhere)
{
    public int Available => Stock - PlannedElsewhere;
}

/// <summary>
/// Availability = owned stock − quantities planned on other reserving projects in the same period.
/// The overlap check is period-based (not hour-by-hour peak), which errs on the safe side.
/// </summary>
public class AvailabilityManager(IEquipmentRepository equipmentRepository, IProjectRepository projectRepository)
{
    public async Task<Dictionary<Guid, EquipmentAvailability>> GetAsync(
        IReadOnlyCollection<Guid> equipmentIds, DateTime start, DateTime end, Guid? excludeProjectId)
    {
        if (equipmentIds.Count == 0)
        {
            return [];
        }

        var stock = await equipmentRepository.GetStockQuantitiesAsync(equipmentIds);
        var planned = await projectRepository.GetPlannedQuantitiesAsync(equipmentIds, start, end, excludeProjectId);

        return equipmentIds.Distinct().ToDictionary(
            id => id,
            id => new EquipmentAvailability(id, stock.GetValueOrDefault(id), planned.GetValueOrDefault(id)));
    }

    /// <summary>Availability for every equipment planned on the project, over the project's planning period.</summary>
    public Task<Dictionary<Guid, EquipmentAvailability>> GetForProjectAsync(Project project) =>
        GetAsync(project.Equipment.Select(e => e.EquipmentId).ToList(), project.PlanStart, project.PlanEnd, project.Id);

    public static int GetShortage(ProjectEquipment line, EquipmentAvailability availability) =>
        Math.Max(0, line.Quantity - Math.Max(0, availability.Available));

    /// <summary>Lines of the project that cannot be fully covered by available stock.</summary>
    public async Task<List<(ProjectEquipment Line, int Missing)>> GetShortagesAsync(Project project)
    {
        var availability = await GetForProjectAsync(project);
        return project.Equipment
            .Select(line => (Line: line, Missing: GetShortage(line, availability[line.EquipmentId])))
            .Where(x => x.Missing > 0)
            .ToList();
    }
}
