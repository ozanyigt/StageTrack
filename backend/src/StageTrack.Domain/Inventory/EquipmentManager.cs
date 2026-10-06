using StageTrack.Projects;
using StageTrack.Suppliers;

namespace StageTrack.Inventory;

public class EquipmentManager(
    IEquipmentRepository equipmentRepository,
    IEquipmentUnitRepository unitRepository,
    IProjectRepository projectRepository,
    ISupplierRepository supplierRepository,
    IEquipmentLabelRepository labelRepository,
    Auditing.AuditLogManager auditLogManager)
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

    /// <summary>
    /// Deletes equipment that was entered by mistake, together with its devices and labels (their codes become free
    /// again) and writes the deletion to the audit log. Equipment that has been on a project or quote is part of the
    /// history and can only be archived.
    /// </summary>
    public async Task DeleteAsync(Equipment equipment)
    {
        if (await projectRepository.IsEquipmentUsedInHistoryAsync(equipment.Id))
        {
            throw new BusinessException(StageTrackErrorCodes.EquipmentUsedInHistory).WithData("code", equipment.Code);
        }

        var units = await unitRepository.GetListByEquipmentAsync(equipment.Id, includeArchived: true);
        foreach (var label in await labelRepository.GetListByEquipmentAsync(equipment.Id))
        {
            await labelRepository.DeleteAsync(label);
        }

        foreach (var unit in units)
        {
            await unitRepository.DeleteAsync(unit);
        }

        await equipmentRepository.DeleteAsync(equipment);

        var description = $"{equipment.Code} {equipment.Name}";
        if (units.Count > 0)
        {
            description += $" ({string.Join(", ", units.Select(u => u.InternalRef))})";
        }

        await auditLogManager.LogAsync(Auditing.AuditLogConsts.EquipmentDeleted, nameof(Equipment), equipment.Id, description);
    }

    /// <summary>Total rental price of the default content (price × quantity).</summary>
    public async Task<decimal> GetContentPriceTotalAsync(Equipment equipment)
    {
        var content = equipment.Relations.Where(r => r.Kind == EquipmentRelationKind.Content).ToList();
        if (content.Count == 0)
        {
            return 0;
        }

        var prices = (await equipmentRepository.GetListByIdsAsync(content.Select(r => r.RelatedEquipmentId))).ToDictionary(e => e.Id, e => e.RentalPrice);
        return content.Sum(r => prices.GetValueOrDefault(r.RelatedEquipmentId) * r.Quantity);
    }

    /// <summary>A case's price is the total of its content, until someone types a different price.</summary>
    public async Task ApplyContentPriceAsync(Equipment equipment)
    {
        if (!equipment.IsPriceManual && equipment.Relations.Any(r => r.Kind == EquipmentRelationKind.Content))
        {
            equipment.SetRentalPrice(await GetContentPriceTotalAsync(equipment));
        }
    }

    private async Task EnsureCodeIsUniqueAsync(string code, Guid? excludeId)
    {
        if (await equipmentRepository.CodeExistsAsync(code, excludeId))
        {
            throw new BusinessException(StageTrackErrorCodes.EquipmentCodeAlreadyExists).WithData("code", code);
        }
    }
}
