using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using StageTrack.Collaboration;
using StageTrack.Dtos;
using StageTrack.Imports;
using StageTrack.Inventory;
using StageTrack.Permissions;

namespace StageTrack.Controllers;

[ApiController]
[Route("api/equipment-folders")]
[Authorize(StageTrackPermissions.Equipment.Default)]
public class EquipmentFoldersController(IEquipmentFolderAppService appService) : ControllerBase
{
    [HttpGet]
    public Task<List<EquipmentFolderDto>> GetListAsync() => appService.GetListAsync();

    [HttpPost]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentFolderDto> CreateAsync(CreateUpdateEquipmentFolderInput input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentFolderDto> UpdateAsync(Guid id, CreateUpdateEquipmentFolderInput input) => appService.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task DeleteAsync(Guid id) => appService.DeleteAsync(id);
}

[ApiController]
[Route("api/equipment")]
[Authorize(StageTrackPermissions.Equipment.Default)]
public class EquipmentController(IEquipmentAppService appService) : ControllerBase
{
    [HttpGet]
    public Task<PagedResultDto<EquipmentDto>> GetListAsync([FromQuery] GetEquipmentListInput input) => appService.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<EquipmentDetailDto> GetAsync(Guid id) => appService.GetAsync(id);

    [HttpGet("lookup")]
    public Task<List<EquipmentLookupDto>> GetLookupAsync([FromQuery] string? text, [FromQuery] bool forQuote = false) =>
        appService.GetLookupAsync(text, forQuote);

    [HttpPost("availability")]
    public Task<List<EquipmentAvailabilityDto>> GetAvailabilityAsync(GetAvailabilityInput input) => appService.GetAvailabilityAsync(input);

    [HttpPost]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentDto> CreateAsync(CreateUpdateEquipmentInput input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentDetailDto> UpdateAsync(Guid id, CreateUpdateEquipmentInput input) => appService.UpdateAsync(id, input);

    [HttpPost("{id:guid}/relations")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentDetailDto> AddRelationAsync(Guid id, AddEquipmentRelationInput input) => appService.AddRelationAsync(id, input);

    [HttpPut("{id:guid}/relations/{relationId:guid}")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentDetailDto> UpdateRelationAsync(Guid id, Guid relationId, UpdateEquipmentRelationInput input) =>
        appService.UpdateRelationAsync(id, relationId, input);

    [HttpDelete("{id:guid}/relations/{relationId:guid}")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentDetailDto> RemoveRelationAsync(Guid id, Guid relationId) => appService.RemoveRelationAsync(id, relationId);

    [HttpPost("{id:guid}/suppliers")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentDetailDto> AddSupplierAsync(Guid id, CreateUpdateEquipmentSupplierInput input) => appService.AddSupplierAsync(id, input);

    [HttpPut("{id:guid}/suppliers/{linkId:guid}")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentDetailDto> UpdateSupplierAsync(Guid id, Guid linkId, CreateUpdateEquipmentSupplierInput input) =>
        appService.UpdateSupplierAsync(id, linkId, input);

    [HttpDelete("{id:guid}/suppliers/{linkId:guid}")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentDetailDto> RemoveSupplierAsync(Guid id, Guid linkId) => appService.RemoveSupplierAsync(id, linkId);

    [HttpPost("{id:guid}/image")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    [RequestSizeLimit(CollaborationConsts.MaxFileSize + 64 * 1024)]
    public async Task<EquipmentDetailDto> SetImageAsync(Guid id, IFormFile file) => await appService.SetImageAsync(id, await file.ToUploadAsync());

    [HttpDelete("{id:guid}/image")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentDetailDto> RemoveImageAsync(Guid id) => appService.RemoveImageAsync(id);

    [HttpPost("move")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<int> MoveAsync(MoveEquipmentInput input) => appService.MoveAsync(input);

    [HttpPost("import")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<ImportResultDto> ImportAsync(List<EquipmentImportInput> rows) => appService.ImportAsync(rows);

    [HttpPost("{id:guid}/archive")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task ArchiveAsync(Guid id) => appService.ArchiveAsync(id);

    [HttpPost("{id:guid}/restore")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task RestoreAsync(Guid id) => appService.RestoreAsync(id);

    [HttpDelete("{id:guid}")]
    [Authorize(StageTrackPermissions.Equipment.Delete)]
    public Task DeleteAsync(Guid id) => appService.DeleteAsync(id);

    [HttpPost("{id:guid}/price-from-content")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentDetailDto> UsePriceFromContentAsync(Guid id) => appService.UsePriceFromContentAsync(id);
}

[ApiController]
[Route("api/equipment-units")]
[Authorize(StageTrackPermissions.Equipment.Default)]
public class EquipmentUnitsController(IEquipmentUnitAppService appService) : ControllerBase
{
    [HttpGet]
    public Task<PagedResultDto<EquipmentUnitDto>> GetListAsync([FromQuery] GetEquipmentUnitListInput input) => appService.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<EquipmentUnitDetailDto> GetAsync(Guid id) => appService.GetAsync(id);

    [HttpGet("{id:guid}/jobs")]
    public Task<List<UnitJobDto>> GetJobHistoryAsync(Guid id) => appService.GetJobHistoryAsync(id);

    [HttpGet("{id:guid}/labels")]
    public Task<List<LabelDto>> GetLabelsAsync(Guid id) => appService.GetLabelsAsync(id);

    [HttpPost]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentUnitDto> CreateAsync(CreateEquipmentUnitInput input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentUnitDetailDto> UpdateAsync(Guid id, UpdateEquipmentUnitInput input) => appService.UpdateAsync(id, input);

    [HttpPut("{id:guid}/status")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task ChangeStatusAsync(Guid id, ChangeUnitStatusInput input) => appService.ChangeStatusAsync(id, input);

    [HttpPost("{id:guid}/archive")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task ArchiveAsync(Guid id) => appService.ArchiveAsync(id);

    [HttpPost("{id:guid}/restore")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task RestoreAsync(Guid id) => appService.RestoreAsync(id);

    [HttpPost("{id:guid}/image")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    [RequestSizeLimit(CollaborationConsts.MaxFileSize + 64 * 1024)]
    public async Task<EquipmentUnitDetailDto> SetImageAsync(Guid id, IFormFile file) => await appService.SetImageAsync(id, await file.ToUploadAsync());

    [HttpDelete("{id:guid}/image")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentUnitDetailDto> RemoveImageAsync(Guid id) => appService.RemoveImageAsync(id);

    [HttpGet("next-internal-ref")]
    public Task<string> SuggestInternalRefAsync([FromQuery] Guid equipmentId) => appService.SuggestInternalRefAsync(equipmentId);

    [HttpPost("transfer")]
    [Authorize(StageTrackPermissions.Equipment.Transfer)]
    public Task<TransferResultDto> TransferAsync(TransferUnitsInput input) => appService.TransferAsync(input);

    [HttpPost("import")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<ImportResultDto> ImportAsync(List<UnitImportInput> rows) => appService.ImportAsync(rows);
}

[ApiController]
[Route("api/labels")]
[Authorize(StageTrackPermissions.Equipment.Default)]
public class LabelsController(ILabelAppService appService) : ControllerBase
{
    [HttpGet("resolve")]
    public Task<ResolveLabelResultDto> ResolveAsync([FromQuery] string code) => appService.ResolveAsync(code);

    [HttpPost]
    [Authorize(StageTrackPermissions.Labels.Assign)]
    public Task<LabelDto> AssignAsync(AssignLabelInput input) => appService.AssignAsync(input);

    [HttpDelete("{id:guid}")]
    [Authorize(StageTrackPermissions.Labels.Assign)]
    public Task DeleteAsync(Guid id) => appService.DeleteAsync(id);

    [HttpPost("print")]
    public Task<List<PrintLabelItemDto>> PreparePrintAsync(PrintLabelsInput input) => appService.PreparePrintAsync(input);
}

[ApiController]
[Route("api/label-templates")]
[Authorize(StageTrackPermissions.Equipment.Default)]
public class LabelTemplatesController(ILabelTemplateAppService appService) : ControllerBase
{
    [HttpGet]
    public Task<List<LabelTemplateDto>> GetListAsync() => appService.GetListAsync();

    [HttpPost]
    [Authorize(StageTrackPermissions.Settings.LabelTemplates)]
    public Task<LabelTemplateDto> CreateAsync(CreateUpdateLabelTemplateInput input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}")]
    [Authorize(StageTrackPermissions.Settings.LabelTemplates)]
    public Task<LabelTemplateDto> UpdateAsync(Guid id, CreateUpdateLabelTemplateInput input) => appService.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    [Authorize(StageTrackPermissions.Settings.LabelTemplates)]
    public Task DeleteAsync(Guid id) => appService.DeleteAsync(id);
}

[ApiController]
[Route("api/stock-locations")]
[Authorize]
public class StockLocationsController(IStockLocationAppService appService) : ControllerBase
{
    [HttpGet]
    public Task<List<StockLocationDto>> GetListAsync() => appService.GetListAsync();

    [HttpPost]
    [Authorize(StageTrackPermissions.Settings.StockLocations)]
    public Task<StockLocationDto> CreateAsync(CreateUpdateStockLocationInput input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}")]
    [Authorize(StageTrackPermissions.Settings.StockLocations)]
    public Task<StockLocationDto> UpdateAsync(Guid id, CreateUpdateStockLocationInput input) => appService.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    [Authorize(StageTrackPermissions.Settings.StockLocations)]
    public Task DeleteAsync(Guid id) => appService.DeleteAsync(id);
}
