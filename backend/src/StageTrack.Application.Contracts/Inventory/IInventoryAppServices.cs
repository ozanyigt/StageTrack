using StageTrack.Dtos;

namespace StageTrack.Inventory;

public interface IEquipmentFolderAppService
{
    Task<List<EquipmentFolderDto>> GetListAsync();

    Task<EquipmentFolderDto> CreateAsync(CreateUpdateEquipmentFolderDto input);

    Task<EquipmentFolderDto> UpdateAsync(Guid id, CreateUpdateEquipmentFolderDto input);

    Task DeleteAsync(Guid id);
}

public interface IEquipmentAppService
{
    Task<PagedResultDto<EquipmentDto>> GetListAsync(GetEquipmentListInput input);

    Task<EquipmentDetailDto> GetAsync(Guid id);

    Task<List<EquipmentLookupDto>> GetLookupAsync(string? text);

    Task<EquipmentDto> CreateAsync(CreateUpdateEquipmentDto input);

    Task<EquipmentDto> UpdateAsync(Guid id, CreateUpdateEquipmentDto input);

    Task ArchiveAsync(Guid id);

    Task RestoreAsync(Guid id);

    Task<List<EquipmentAvailabilityDto>> GetAvailabilityAsync(GetAvailabilityInput input);
}

public interface IEquipmentUnitAppService
{
    Task<PagedResultDto<EquipmentUnitDto>> GetListAsync(GetEquipmentUnitListInput input);

    Task<EquipmentUnitDto> CreateAsync(CreateEquipmentUnitDto input);

    Task<EquipmentUnitDto> UpdateAsync(Guid id, UpdateEquipmentUnitDto input);

    Task ChangeStatusAsync(Guid id, ChangeUnitStatusInput input);

    Task ArchiveAsync(Guid id);

    Task<List<LabelDto>> GetLabelsAsync(Guid id);
}

public interface ILabelAppService
{
    Task<ResolveLabelResultDto> ResolveAsync(string code);

    Task<LabelDto> AssignAsync(AssignLabelInput input);

    Task DeleteAsync(Guid id);
}

public interface IStockLocationAppService
{
    Task<List<StockLocationDto>> GetListAsync();

    Task<StockLocationDto> CreateAsync(CreateUpdateStockLocationDto input);

    Task<StockLocationDto> UpdateAsync(Guid id, CreateUpdateStockLocationDto input);

    Task DeleteAsync(Guid id);
}
