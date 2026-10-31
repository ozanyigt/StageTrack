using StageTrack.Led.Calculation;

namespace StageTrack.Led;

/// <summary>
/// Reads the firm's LED inventory into the shape the maths wants. One loader for every LED service, so a screen
/// calculation, a loading plan and a quote all see the same catalogue — the equipment of the current location,
/// archived items left out.
/// </summary>
public class LedCatalogLoader(IEquipmentLedSpecRepository specRepository)
{
    public async Task<LedCalculationCatalog> LoadAsync(CancellationToken cancellationToken = default)
    {
        var filter = new LedCatalogFilter();
        var panels = await specRepository.GetPanelsAsync(filter, cancellationToken);
        var processors = await specRepository.GetProcessorsAsync(filter, cancellationToken);
        var extenders = await specRepository.GetExtendersAsync(filter, cancellationToken);

        // Only exclusive panels restrict their processors, so the link table is read for those alone.
        var exclusive = panels.Where(p => p.Spec.HasExclusiveProcessors).Select(p => p.Equipment.Id).ToList();
        var compatible = exclusive.Count == 0
            ? []
            : await specRepository.GetCompatibleProcessorsAsync(exclusive, cancellationToken);

        return new LedCalculationCatalog(
            panels.Select(p => LedSpecMapper.ToPanelSpec(p.Equipment, p.Spec, compatible.GetValueOrDefault(p.Equipment.Id))).ToList(),
            processors.Select(p => LedSpecMapper.ToProcessorSpec(p.Equipment, p.Spec)).ToList(),
            extenders.Select(e => LedSpecMapper.ToExtenderSpec(e.Equipment, e.Spec)).ToList());
    }

    /// <summary>The panels of the catalogue with their equipment, for screens that need a name or a case size.</summary>
    public Task<List<LedItem<LedPanelSpec>>> LoadPanelItemsAsync(CancellationToken cancellationToken = default) =>
        specRepository.GetPanelsAsync(new LedCatalogFilter(), cancellationToken);
}
