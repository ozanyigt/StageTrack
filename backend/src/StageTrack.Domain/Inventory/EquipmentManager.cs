using StageTrack.Projects;

namespace StageTrack.Inventory;

public class EquipmentManager(
    IEquipmentRepository equipmentRepository,
    IEquipmentUnitRepository unitRepository,
    IProjectRepository projectRepository)
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

    private async Task EnsureCodeIsUniqueAsync(string code, Guid? excludeId)
    {
        if (await equipmentRepository.CodeExistsAsync(code, excludeId))
        {
            throw new BusinessException(StageTrackErrorCodes.EquipmentCodeAlreadyExists).WithData("code", code);
        }
    }
}
