using StageTrack.Inventory;
using StageTrack.Repositories;

namespace StageTrack.Design;

/// <summary>An equipment item together with its LED data; the pair every LED screen and calculation works from.</summary>
/// <typeparam name="TSpec">The role's spec type.</typeparam>
public record LedItem<TSpec>(Equipment Equipment, TSpec Spec) where TSpec : EquipmentLedSpec;

public class LedCatalogFilter
{
    public string? Text { get; set; }

    /// <summary>Null = every role; otherwise panels, processors or extenders only.</summary>
    public LedRole? Role { get; set; }

    public LedPanelGroup? Group { get; set; }
    public IReadOnlyCollection<Guid>? FolderIds { get; set; }

    /// <summary>Archived equipment is left out unless this is set.</summary>
    public bool IncludeArchived { get; set; }
}

public interface IEquipmentLedSpecRepository : IRepository<EquipmentLedSpec>
{
    Task<EquipmentLedSpec?> FindByEquipmentAsync(Guid equipmentId, CancellationToken cancellationToken = default);

    Task<List<EquipmentLedSpec>> GetListByEquipmentAsync(IReadOnlyCollection<Guid> equipmentIds, CancellationToken cancellationToken = default);

    /// <summary>Panels with their equipment, in catalogue order (equipment code).</summary>
    Task<List<LedItem<LedPanelSpec>>> GetPanelsAsync(LedCatalogFilter filter, CancellationToken cancellationToken = default);

    Task<List<LedItem<LedProcessorSpec>>> GetProcessorsAsync(LedCatalogFilter filter, CancellationToken cancellationToken = default);

    Task<List<LedItem<LedExtenderSpec>>> GetExtendersAsync(LedCatalogFilter filter, CancellationToken cancellationToken = default);

    /// <summary>
    /// Stock of the given equipment per warehouse: devices counted per location for serial-tracked items, the plain
    /// stock count under <c>null</c> for quantity-tracked ones (they are not kept per warehouse).
    /// </summary>
    Task<Dictionary<(Guid EquipmentId, Guid? StockLocationId), int>> GetStockByLocationAsync(IReadOnlyCollection<Guid> equipmentIds,
        CancellationToken cancellationToken = default);

    /// <summary>For each panel: the processors it is restricted to (empty when it works with any).</summary>
    Task<Dictionary<Guid, List<Guid>>> GetCompatibleProcessorsAsync(IReadOnlyCollection<Guid> panelEquipmentIds,
        CancellationToken cancellationToken = default);
}

public interface IStageSettingsRepository : IRepository<StageSettings>
{
    Task<StageSettings?> FindForCompanyAsync(CancellationToken cancellationToken = default);
}

public interface ITransportSettingsRepository : IRepository<TransportSettings>
{
    Task<TransportSettings?> FindForCompanyAsync(CancellationToken cancellationToken = default);
}

public interface ITransportVehicleRepository : IRepository<TransportVehicle>
{
    Task<List<TransportVehicle>> GetListOrderedAsync(CancellationToken cancellationToken = default);

}

public interface ILedPanelFavoriteRepository : IRepository<LedPanelFavorite>
{
    Task<List<Guid>> GetEquipmentIdsAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<LedPanelFavorite?> FindAsync(Guid userId, Guid equipmentId, CancellationToken cancellationToken = default);
}
