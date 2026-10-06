using StageTrack.Dtos;
using StageTrack.Imports;

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

    /// <param name="forQuote">Projects and quotes: leaves out office equipment and equipment with nothing rentable (e.g. all in repair).</param>
    Task<List<EquipmentLookupDto>> GetLookupAsync(string? text, bool forQuote = false);

    Task<EquipmentDto> CreateAsync(CreateUpdateEquipmentDto input);

    Task<EquipmentDetailDto> UpdateAsync(Guid id, CreateUpdateEquipmentDto input);

    Task ArchiveAsync(Guid id);

    Task RestoreAsync(Guid id);

    /// <summary>Case price back to the total of its content (and following it again).</summary>
    Task<EquipmentDetailDto> UsePriceFromContentAsync(Guid id);

    /// <summary>Deletes equipment entered by mistake (never used on a project/quote); logged in the audit log.</summary>
    Task DeleteAsync(Guid id);

    Task<List<EquipmentAvailabilityDto>> GetAvailabilityAsync(GetAvailabilityInput input);

    Task<EquipmentDetailDto> AddRelationAsync(Guid id, AddEquipmentRelationInput input);

    Task<EquipmentDetailDto> UpdateRelationAsync(Guid id, Guid relationId, UpdateEquipmentRelationInput input);

    Task<EquipmentDetailDto> RemoveRelationAsync(Guid id, Guid relationId);

    Task<EquipmentDetailDto> AddSupplierAsync(Guid id, CreateUpdateEquipmentSupplierInput input);

    Task<EquipmentDetailDto> UpdateSupplierAsync(Guid id, Guid linkId, CreateUpdateEquipmentSupplierInput input);

    Task<EquipmentDetailDto> RemoveSupplierAsync(Guid id, Guid linkId);

    Task<EquipmentDetailDto> SetImageAsync(Guid id, UploadFileInput file);

    Task<EquipmentDetailDto> RemoveImageAsync(Guid id);

    Task<ImportResultDto> ImportAsync(List<EquipmentImportRow> rows);
}

public interface IEquipmentUnitAppService
{
    Task<PagedResultDto<EquipmentUnitDto>> GetListAsync(GetEquipmentUnitListInput input);

    Task<EquipmentUnitDetailDto> GetAsync(Guid id);

    Task<EquipmentUnitDto> CreateAsync(CreateEquipmentUnitDto input);

    Task<EquipmentUnitDetailDto> UpdateAsync(Guid id, UpdateEquipmentUnitDto input);

    Task ChangeStatusAsync(Guid id, ChangeUnitStatusInput input);

    Task ArchiveAsync(Guid id);

    Task RestoreAsync(Guid id);

    Task<List<LabelDto>> GetLabelsAsync(Guid id);

    Task<EquipmentUnitDetailDto> SetImageAsync(Guid id, UploadFileInput file);

    Task<EquipmentUnitDetailDto> RemoveImageAsync(Guid id);

    Task<TransferResultDto> TransferAsync(TransferUnitsInput input);

    /// <summary>Internal reference proposed for the next device of the equipment.</summary>
    Task<string> SuggestInternalRefAsync(Guid equipmentId);

    Task<ImportResultDto> ImportAsync(List<UnitImportRow> rows);
}

public interface ILabelAppService
{
    Task<ResolveLabelResultDto> ResolveAsync(string code);

    Task<LabelDto> AssignAsync(AssignLabelInput input);

    Task DeleteAsync(Guid id);

    /// <summary>Print data for the selected devices; missing labels are created in the Rentman JSON format.</summary>
    Task<List<PrintLabelItemDto>> PreparePrintAsync(PrintLabelsInput input);
}

public interface ILabelTemplateAppService
{
    Task<List<LabelTemplateDto>> GetListAsync();

    Task<LabelTemplateDto> CreateAsync(CreateUpdateLabelTemplateDto input);

    Task<LabelTemplateDto> UpdateAsync(Guid id, CreateUpdateLabelTemplateDto input);

    Task DeleteAsync(Guid id);
}

public interface IStockLocationAppService
{
    Task<List<StockLocationDto>> GetListAsync();

    Task<StockLocationDto> CreateAsync(CreateUpdateStockLocationDto input);

    Task<StockLocationDto> UpdateAsync(Guid id, CreateUpdateStockLocationDto input);

    Task DeleteAsync(Guid id);
}

/// <summary>An uploaded file, passed from the controller to the application layer.</summary>
public class UploadFileInput
{
    public required string FileName { get; init; }
    public required string ContentType { get; init; }
    public required byte[] Content { get; init; }
}
