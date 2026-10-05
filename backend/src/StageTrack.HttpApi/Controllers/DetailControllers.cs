using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using StageTrack.Collaboration;
using StageTrack.Dtos;
using StageTrack.Inventory;
using StageTrack.Maintenance;
using StageTrack.Permissions;
using StageTrack.Suppliers;

namespace StageTrack.Controllers;

public static class FormFileExtensions
{
    public static async Task<UploadFileInput> ToUploadAsync(this IFormFile file)
    {
        using var stream = new MemoryStream();
        await file.CopyToAsync(stream);
        return new UploadFileInput
        {
            FileName = Path.GetFileName(file.FileName),
            ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
            Content = stream.ToArray()
        };
    }
}

[ApiController]
[Route("api/suppliers")]
[Authorize(StageTrackPermissions.Suppliers.Default)]
public class SuppliersController(ISupplierAppService appService) : ControllerBase
{
    [HttpGet]
    public Task<PagedResultDto<SupplierDto>> GetListAsync([FromQuery] GetSupplierListInput input) => appService.GetListAsync(input);

    [HttpGet("lookup")]
    [Authorize(StageTrackPermissions.Equipment.Default)]
    public Task<List<LookupDto>> GetLookupAsync([FromQuery] string? text) => appService.GetLookupAsync(text);

    [HttpPost]
    [Authorize(StageTrackPermissions.Suppliers.Manage)]
    public Task<SupplierDto> CreateAsync(CreateUpdateSupplierDto input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}")]
    [Authorize(StageTrackPermissions.Suppliers.Manage)]
    public Task<SupplierDto> UpdateAsync(Guid id, CreateUpdateSupplierDto input) => appService.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    [Authorize(StageTrackPermissions.Suppliers.Manage)]
    public Task DeleteAsync(Guid id) => appService.DeleteAsync(id);
}

[ApiController]
[Route("api/repairs")]
[Authorize(StageTrackPermissions.Maintenance.Default)]
public class RepairsController(IRepairAppService appService) : ControllerBase
{
    [HttpGet]
    public Task<PagedResultDto<RepairDto>> GetListAsync([FromQuery] GetRepairListInput input) => appService.GetListAsync(input);

    [HttpPost]
    [Authorize(StageTrackPermissions.Maintenance.Manage)]
    public Task<RepairDto> CreateAsync(CreateRepairInput input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}")]
    [Authorize(StageTrackPermissions.Maintenance.Manage)]
    public Task<RepairDto> UpdateAsync(Guid id, UpdateRepairInput input) => appService.UpdateAsync(id, input);

    [HttpPost("{id:guid}/status")]
    [Authorize(StageTrackPermissions.Maintenance.Manage)]
    public Task<RepairDto> ChangeStatusAsync(Guid id, ChangeRepairStatusInput input) => appService.ChangeStatusAsync(id, input);
}

[ApiController]
[Route("api/inspections")]
[Authorize(StageTrackPermissions.Maintenance.Default)]
public class InspectionsController(IInspectionAppService appService) : ControllerBase
{
    [HttpGet]
    public Task<List<InspectionDto>> GetListAsync([FromQuery] Guid? equipmentId, [FromQuery] Guid? unitId) =>
        appService.GetListAsync(equipmentId, unitId);

    [HttpPost]
    [Authorize(StageTrackPermissions.Maintenance.Manage)]
    public Task<InspectionDto> RecordAsync(RecordInspectionInput input) => appService.RecordAsync(input);
}

/// <summary>Notes, tasks and files; access is checked per owner in the app service.</summary>
[ApiController]
[Route("api/collaboration")]
[Authorize]
public class CollaborationController(ICollaborationAppService appService) : ControllerBase
{
    [HttpGet("{ownerType}/{ownerId:guid}/notes")]
    public Task<List<NoteDto>> GetNotesAsync(OwnerType ownerType, Guid ownerId) => appService.GetNotesAsync(ownerType, ownerId);

    [HttpPost("{ownerType}/{ownerId:guid}/notes")]
    public Task<NoteDto> AddNoteAsync(OwnerType ownerType, Guid ownerId, CreateUpdateNoteInput input) =>
        appService.AddNoteAsync(ownerType, ownerId, input);

    [HttpPut("notes/{id:guid}")]
    public Task<NoteDto> UpdateNoteAsync(Guid id, CreateUpdateNoteInput input) => appService.UpdateNoteAsync(id, input);

    [HttpDelete("notes/{id:guid}")]
    public Task DeleteNoteAsync(Guid id) => appService.DeleteNoteAsync(id);

    [HttpGet("{ownerType}/{ownerId:guid}/tasks")]
    public Task<List<TaskItemDto>> GetTasksAsync(OwnerType ownerType, Guid ownerId) => appService.GetTasksAsync(ownerType, ownerId);

    [HttpPost("{ownerType}/{ownerId:guid}/tasks")]
    public Task<TaskItemDto> AddTaskAsync(OwnerType ownerType, Guid ownerId, CreateUpdateTaskInput input) =>
        appService.AddTaskAsync(ownerType, ownerId, input);

    [HttpPut("tasks/{id:guid}")]
    public Task<TaskItemDto> UpdateTaskAsync(Guid id, CreateUpdateTaskInput input) => appService.UpdateTaskAsync(id, input);

    [HttpPost("tasks/{id:guid}/completed")]
    public Task<TaskItemDto> SetTaskCompletedAsync(Guid id, SetTaskCompletedInput input) => appService.SetTaskCompletedAsync(id, input);

    [HttpDelete("tasks/{id:guid}")]
    public Task DeleteTaskAsync(Guid id) => appService.DeleteTaskAsync(id);

    [HttpGet("{ownerType}/{ownerId:guid}/files")]
    public Task<List<AttachmentDto>> GetAttachmentsAsync(OwnerType ownerType, Guid ownerId) => appService.GetAttachmentsAsync(ownerType, ownerId);

    [HttpPost("{ownerType}/{ownerId:guid}/files")]
    [RequestSizeLimit(CollaborationConsts.MaxFileSize + 64 * 1024)]
    public async Task<AttachmentDto> UploadAsync(OwnerType ownerType, Guid ownerId, IFormFile file) =>
        await appService.UploadAsync(ownerType, ownerId, await file.ToUploadAsync());

    [HttpGet("files/{id:guid}")]
    public async Task<IActionResult> DownloadAsync(Guid id)
    {
        var file = await appService.DownloadAsync(id);
        return File(file.Content, file.ContentType, file.FileName);
    }

    [HttpDelete("files/{id:guid}")]
    public Task DeleteAttachmentAsync(Guid id) => appService.DeleteAttachmentAsync(id);
}
