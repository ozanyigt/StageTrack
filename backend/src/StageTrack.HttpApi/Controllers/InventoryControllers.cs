using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StageTrack.Dtos;
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
    public Task<EquipmentFolderDto> CreateAsync(CreateUpdateEquipmentFolderDto input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentFolderDto> UpdateAsync(Guid id, CreateUpdateEquipmentFolderDto input) => appService.UpdateAsync(id, input);

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
    public Task<List<EquipmentLookupDto>> GetLookupAsync([FromQuery] string? text) => appService.GetLookupAsync(text);

    [HttpPost("availability")]
    public Task<List<EquipmentAvailabilityDto>> GetAvailabilityAsync(GetAvailabilityInput input) => appService.GetAvailabilityAsync(input);

    [HttpPost]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentDto> CreateAsync(CreateUpdateEquipmentDto input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentDto> UpdateAsync(Guid id, CreateUpdateEquipmentDto input) => appService.UpdateAsync(id, input);

    [HttpPost("{id:guid}/archive")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task ArchiveAsync(Guid id) => appService.ArchiveAsync(id);

    [HttpPost("{id:guid}/restore")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task RestoreAsync(Guid id) => appService.RestoreAsync(id);
}

[ApiController]
[Route("api/equipment-units")]
[Authorize(StageTrackPermissions.Equipment.Default)]
public class EquipmentUnitsController(IEquipmentUnitAppService appService) : ControllerBase
{
    [HttpGet]
    public Task<PagedResultDto<EquipmentUnitDto>> GetListAsync([FromQuery] GetEquipmentUnitListInput input) => appService.GetListAsync(input);

    [HttpGet("{id:guid}/labels")]
    public Task<List<LabelDto>> GetLabelsAsync(Guid id) => appService.GetLabelsAsync(id);

    [HttpPost]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentUnitDto> CreateAsync(CreateEquipmentUnitDto input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task<EquipmentUnitDto> UpdateAsync(Guid id, UpdateEquipmentUnitDto input) => appService.UpdateAsync(id, input);

    [HttpPost("{id:guid}/status")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task ChangeStatusAsync(Guid id, ChangeUnitStatusInput input) => appService.ChangeStatusAsync(id, input);

    [HttpPost("{id:guid}/archive")]
    [Authorize(StageTrackPermissions.Equipment.Manage)]
    public Task ArchiveAsync(Guid id) => appService.ArchiveAsync(id);
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
    public Task<StockLocationDto> CreateAsync(CreateUpdateStockLocationDto input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}")]
    [Authorize(StageTrackPermissions.Settings.StockLocations)]
    public Task<StockLocationDto> UpdateAsync(Guid id, CreateUpdateStockLocationDto input) => appService.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    [Authorize(StageTrackPermissions.Settings.StockLocations)]
    public Task DeleteAsync(Guid id) => appService.DeleteAsync(id);
}
