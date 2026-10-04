namespace StageTrack.Inventory;

public class StockLocationManager(IEquipmentUnitRepository unitRepository)
{
    public async Task EnsureCanDeleteAsync(StockLocation location)
    {
        if (await unitRepository.AnyInStockLocationAsync(location.Id))
        {
            throw new BusinessException(StageTrackErrorCodes.StockLocationInUse);
        }
    }
}
