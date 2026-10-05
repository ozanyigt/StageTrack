using System.ComponentModel.DataAnnotations;
using StageTrack.Inventory;

namespace StageTrack.Collaboration;

public class NoteDto
{
    public Guid Id { get; set; }
    public string Text { get; set; } = null!;
    public DateTime CreationTime { get; set; }
    public string? AuthorName { get; set; }
    public bool CanEdit { get; set; }
}

public class CreateUpdateNoteInput
{
    [Required, StringLength(CollaborationConsts.MaxNoteLength)]
    public string Text { get; set; } = null!;
}

public class TaskItemDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public Guid? AssignedUserId { get; set; }
    public string? AssignedUserName { get; set; }
    public DateTime? DueDate { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime CreationTime { get; set; }
}

public class CreateUpdateTaskInput
{
    [Required, StringLength(CollaborationConsts.MaxTaskTitleLength)]
    public string Title { get; set; } = null!;

    [StringLength(CollaborationConsts.MaxTaskDescriptionLength)]
    public string? Description { get; set; }

    public Guid? AssignedUserId { get; set; }
    public DateTime? DueDate { get; set; }
}

public class SetTaskCompletedInput
{
    public bool IsCompleted { get; set; }
}

public class AttachmentDto
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = null!;
    public string ContentType { get; set; } = null!;
    public long Size { get; set; }
    public DateTime CreationTime { get; set; }
    public string? UploaderName { get; set; }
}

public class FileContentDto
{
    public required string FileName { get; init; }
    public required string ContentType { get; init; }
    public required byte[] Content { get; init; }
}

public interface ICollaborationAppService
{
    Task<List<NoteDto>> GetNotesAsync(OwnerType ownerType, Guid ownerId);

    Task<NoteDto> AddNoteAsync(OwnerType ownerType, Guid ownerId, CreateUpdateNoteInput input);

    Task<NoteDto> UpdateNoteAsync(Guid id, CreateUpdateNoteInput input);

    Task DeleteNoteAsync(Guid id);

    Task<List<TaskItemDto>> GetTasksAsync(OwnerType ownerType, Guid ownerId);

    Task<TaskItemDto> AddTaskAsync(OwnerType ownerType, Guid ownerId, CreateUpdateTaskInput input);

    Task<TaskItemDto> UpdateTaskAsync(Guid id, CreateUpdateTaskInput input);

    Task<TaskItemDto> SetTaskCompletedAsync(Guid id, SetTaskCompletedInput input);

    Task DeleteTaskAsync(Guid id);

    Task<List<AttachmentDto>> GetAttachmentsAsync(OwnerType ownerType, Guid ownerId);

    Task<AttachmentDto> UploadAsync(OwnerType ownerType, Guid ownerId, UploadFileInput file);

    Task<FileContentDto> DownloadAsync(Guid id);

    Task DeleteAttachmentAsync(Guid id);
}
