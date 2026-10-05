using StageTrack.Inventory;
using StageTrack.Warehouse;

namespace StageTrack.Projects;

/// <param name="PlannedElsewhere">Highest quantity reserved by other projects at any moment of the period.</param>
public record EquipmentAvailability(Guid EquipmentId, int Stock, int PlannedElsewhere)
{
    public int Available => Stock - PlannedElsewhere;
}

/// <summary>
/// Availability = owned stock − the peak quantity that other reserving projects hold at the same time.
/// The reservations are swept along the time line, so two projects that do not overlap each other are
/// not added together just because both overlap a long project.
/// </summary>
public class AvailabilityManager(
    IEquipmentRepository equipmentRepository,
    IProjectRepository projectRepository,
    IWarehouseMovementRepository movementRepository)
{
    public async Task<Dictionary<Guid, EquipmentAvailability>> GetAsync(
        IReadOnlyCollection<Guid> equipmentIds, DateTime start, DateTime end, Guid? excludeProjectId)
    {
        if (equipmentIds.Count == 0)
        {
            return [];
        }

        var stock = await equipmentRepository.GetStockQuantitiesAsync(equipmentIds);
        var reservations = (await projectRepository.GetReservationsAsync(equipmentIds, start, end, excludeProjectId))
            .ToLookup(r => r.EquipmentId);

        return equipmentIds.Distinct().ToDictionary(
            id => id,
            id => new EquipmentAvailability(id, stock.GetValueOrDefault(id), GetPeak(reservations[id], start, end)));
    }

    /// <summary>Availability for every equipment planned on the project, over the project's planning period.</summary>
    public Task<Dictionary<Guid, EquipmentAvailability>> GetForProjectAsync(Project project) =>
        GetAsync(project.Equipment.Select(e => e.EquipmentId).Distinct().ToList(), project.PlanStart, project.PlanEnd, project.Id);

    /// <summary>
    /// Missing pieces of one equipment on a project. Pieces already checked out on this project are physically
    /// with it, so only the remaining need competes with other projects; the conflict is then shown on the
    /// project that still has to pick the items, not on the one that already has them.
    /// </summary>
    public static int GetShortage(int needed, int outOnProject, EquipmentAvailability availability) =>
        Math.Max(0, needed - Math.Max(0, outOnProject) - Math.Max(0, availability.Available));

    /// <summary>Missing quantity per equipment for the project (only equipment that is short).</summary>
    public async Task<Dictionary<Guid, int>> GetShortagesAsync(Project project)
    {
        var availability = await GetForProjectAsync(project);
        var balances = (await movementRepository.GetBalancesAsync(project.Id)).ToDictionary(b => b.EquipmentId, b => b.Out);

        return project.Equipment
            .GroupBy(e => e.EquipmentId)
            .Select(g => (EquipmentId: g.Key, Missing: GetShortage(g.Sum(e => e.Quantity), balances.GetValueOrDefault(g.Key), availability[g.Key])))
            .Where(x => x.Missing > 0)
            .ToDictionary(x => x.EquipmentId, x => x.Missing);
    }

    /// <summary>Highest simultaneous reserved quantity within [start, end]; a reservation ending when another starts does not overlap it.</summary>
    internal static int GetPeak(IEnumerable<EquipmentReservation> reservations, DateTime start, DateTime end)
    {
        var events = reservations
            .Select(r => (From: r.Start < start ? start : r.Start, To: r.End > end ? end : r.End, r.Quantity))
            .Where(r => r.From <= r.To)
            .SelectMany(r => new[] { (Time: r.From, Delta: r.Quantity), (Time: r.To, Delta: -r.Quantity) })
            .OrderBy(e => e.Time)
            .ThenBy(e => e.Delta) // releases before new reservations at the same moment
            .ToList();

        int current = 0, peak = 0;
        foreach (var (_, delta) in events)
        {
            current += delta;
            peak = Math.Max(peak, current);
        }

        return peak;
    }
}
