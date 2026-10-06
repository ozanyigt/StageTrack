using StageTrack.Companies;
using StageTrack.Repositories;
using StageTrack.Session;
using StageTrack.Warehouse;

namespace StageTrack.Inventory;

public record TransferResult(Guid TargetCompanyId, string TargetCompanyName, int UnitCount, string TargetLocationName);

/// <summary>
/// Sends devices from the current location to another one (e.g. Staras TR → Dubai). Each location keeps its
/// own catalog, so the device is attached to the target's equipment with the same code (created there when
/// missing), keeps its labels, and both locations get a movement log line.
/// </summary>
public class TransferManager(
    IEquipmentRepository equipmentRepository,
    IEquipmentUnitRepository unitRepository,
    IEquipmentLabelRepository labelRepository,
    IStockLocationRepository locationRepository,
    IWarehouseMovementRepository movementRepository,
    ICompanyRepository companyRepository,
    EquipmentManager equipmentManager,
    ICurrentCompany currentCompany,
    IUnitOfWork unitOfWork)
{
    public async Task<TransferResult> TransferUnitsAsync(IReadOnlyCollection<Guid> unitIds, Guid targetCompanyId, Guid? userId)
    {
        var sourceCompanyId = currentCompany.Id!.Value;
        if (sourceCompanyId == targetCompanyId)
        {
            throw new BusinessException(StageTrackErrorCodes.TransferSameCompany);
        }

        var target = await companyRepository.GetAsync(targetCompanyId);
        var source = await companyRepository.GetAsync(sourceCompanyId);

        // Source side: only devices that are in the warehouse can travel.
        var units = await unitRepository.GetListByIdsAsync(unitIds);
        if (units.Count != unitIds.Distinct().Count())
        {
            throw new EntityNotFoundException(typeof(EquipmentUnit));
        }

        if (units.Any(u => u.Status != UnitStatus.InStock || u.IsArchived))
        {
            throw new BusinessException(StageTrackErrorCodes.UnitNotInStock);
        }

        var sourceEquipment = (await equipmentRepository.GetListByIdsAsync(units.Select(u => u.EquipmentId))).ToDictionary(e => e.Id);
        var labels = new Dictionary<Guid, List<EquipmentLabel>>();
        foreach (var unit in units)
        {
            labels[unit.Id] = await labelRepository.GetListByUnitAsync(unit.Id);
        }

        // Target side: matching equipment (by code), the main warehouse, and no clashing references or labels.
        var targetEquipment = new Dictionary<Guid, Guid>();
        StockLocation warehouse;
        using (currentCompany.Change(targetCompanyId))
        {
            warehouse = await locationRepository.FindFirstWarehouseAsync()
                        ?? throw new BusinessException(StageTrackErrorCodes.TransferNoWarehouse).WithData("company", target.Name);

            foreach (var equipment in sourceEquipment.Values)
            {
                var existing = await equipmentRepository.FindByCodeAsync(equipment.Code);
                if (existing is null)
                {
                    existing = await equipmentManager.CreateAsync(equipment.Code, equipment.Name, equipment.Type, equipment.IsSerialized);
                    existing.Update(equipment.Name, equipment.Brand, equipment.Model, null, equipment.Type, equipment.CountryOfOrigin, equipment.Notes);
                    existing.UpdatePhysical(equipment.LengthCm, equipment.WidthCm, equipment.HeightCm, equipment.WeightKg,
                        equipment.VolumeM3, equipment.PowerW, equipment.CurrentA, equipment.PackedPer);
                    existing.CompanyId = targetCompanyId;
                    await equipmentRepository.InsertAsync(existing);
                }

                targetEquipment[equipment.Id] = existing.Id;
            }

            foreach (var unit in units)
            {
                if (await unitRepository.InternalRefExistsAsync(targetEquipment[unit.EquipmentId], unit.InternalRef))
                {
                    throw new BusinessException(StageTrackErrorCodes.UnitInternalRefAlreadyExists).WithData("reference", unit.InternalRef);
                }

                foreach (var label in labels[unit.Id])
                {
                    if (await labelRepository.FindTargetByCodeAsync(label.Code) is not null)
                    {
                        throw new BusinessException(StageTrackErrorCodes.TransferLabelConflict).WithData("code", label.Code);
                    }
                }
            }
        }

        foreach (var unit in units)
        {
            var sourceEquipmentId = unit.EquipmentId;
            var newEquipmentId = targetEquipment[sourceEquipmentId];

            await movementRepository.InsertAsync(WarehouseMovement.CreateTransfer(MovementAction.TransferOut, sourceCompanyId,
                sourceEquipmentId, unit.Id, userId, $"{unit.InternalRef} → {target.Name}"));
            await movementRepository.InsertAsync(WarehouseMovement.CreateTransfer(MovementAction.TransferIn, targetCompanyId,
                newEquipmentId, unit.Id, userId, $"{unit.InternalRef} ← {source.Name}"));

            unit.MoveToCompany(targetCompanyId, newEquipmentId, warehouse.Id);
            foreach (var label in labels[unit.Id])
            {
                label.MoveToCompany(targetCompanyId, newEquipmentId);
            }
        }

        await unitOfWork.SaveChangesAsync();
        return new TransferResult(targetCompanyId, target.Name, units.Count, warehouse.Name);
    }
}
