using StageTrack.Projects;
using StageTrack.Suppliers;

namespace StageTrack.Inventory;

public class EquipmentManager(
    IEquipmentRepository equipmentRepository,
    IEquipmentUnitRepository unitRepository,
    IProjectRepository projectRepository,
    ISupplierRepository supplierRepository)
{
    public async Task<Equipment> CreateAsync(string code, string name, EquipmentType type, bool isSerialized)
    {
        code = code.Trim();
        await EnsureCodeIsUniqueAsync(code, null);
        return new Equipment(Guid.CreateVersion7(), code, name.Trim(), type, isSerialized);
    }

    public async Task ChangeCodeAsync(Equipment equipment, string code)
    {
        code = code.Trim();
        if (string.Equals(equipment.Code, code, StringComparison.Ordinal))
        {
            return;
        }

        await EnsureCodeIsUniqueAsync(code, equipment.Id);
        equipment.SetCode(code);
    }

    /// <summary>Switching to quantity tracking is not allowed once devices are registered.</summary>
    public async Task SetSerializedAsync(Equipment equipment, bool isSerialized)
    {
        if (equipment.IsSerialized == isSerialized)
        {
            return;
        }

        if (!isSerialized && await unitRepository.AnyForEquipmentAsync(equipment.Id))
        {
            throw new BusinessException(StageTrackErrorCodes.EquipmentHasUnits);
        }

        equipment.SetSerialized(isSerialized);
    }

    public async Task ArchiveAsync(Equipment equipment)
    {
        if (await projectRepository.IsEquipmentPlannedOnActiveProjectsAsync(equipment.Id))
        {
            throw new BusinessException(StageTrackErrorCodes.EquipmentPlannedOnProjects);
        }

        equipment.Archive();
    }

    /// <summary>Content, accessory or alternative; the related equipment must exist and be active.</summary>
    public async Task<EquipmentRelation> AddRelationAsync(Equipment equipment, EquipmentRelationKind kind, Guid relatedEquipmentId, int quantity)
    {
        var related = await equipmentRepository.GetAsync(relatedEquipmentId, includeDetails: false);
        if (related.IsArchived)
        {
            throw new EntityNotFoundException(typeof(Equipment), relatedEquipmentId);
        }

        return equipment.AddRelation(kind, related.Id, quantity);
    }

    public async Task<EquipmentSupplier> AddSupplierAsync(Equipment equipment, Guid supplierId, string? supplierCode, decimal? purchasePrice, bool isPreferred)
    {
        var supplier = await supplierRepository.GetAsync(supplierId, includeDetails: false);
        return equipment.AddSupplier(supplier.Id, supplierCode, purchasePrice, isPreferred);
    }

    private async Task EnsureCodeIsUniqueAsync(string code, Guid? excludeId)
    {
        if (await equipmentRepository.CodeExistsAsync(code, excludeId))
        {
            throw new BusinessException(StageTrackErrorCodes.EquipmentCodeAlreadyExists).WithData("code", code);
        }
    }
}
