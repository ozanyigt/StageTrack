using StageTrack.Authorization;
using StageTrack.Identity;
using StageTrack.Inventory;
using StageTrack.Permissions;
using StageTrack.Projects;
using StageTrack.Session;

namespace StageTrack.Collaboration;

/// <summary>
/// Notes, tasks and files of equipment, devices and projects. Reading and writing follow the owner:
/// equipment and devices need equipment access; projects need project access (crew members only on their own).
/// </summary>
public class CollaborationAppService(
    INoteRepository noteRepository,
    ITaskItemRepository taskRepository,
    IAttachmentRepository attachmentRepository,
    IUserRepository userRepository,
    IProjectRepository projectRepository,
    AttachmentManager attachmentManager,
    ProjectAccess projectAccess,
    IPermissionChecker permissionChecker,
    ICurrentUser currentUser) : ICollaborationAppService
{
    public async Task<List<NoteDto>> GetNotesAsync(OwnerType ownerType, Guid ownerId)
    {
        await EnsureAccessAsync(ownerType, ownerId);
        var notes = await noteRepository.GetListAsync(ownerType, ownerId);
        var names = await GetUserNamesAsync(notes.Select(n => n.CreatorId));
        return notes.Select(n => ToDto(n, names)).ToList();
    }

    public async Task<NoteDto> AddNoteAsync(OwnerType ownerType, Guid ownerId, CreateUpdateNoteInput input)
    {
        await EnsureAccessAsync(ownerType, ownerId);
        var note = new Note(Guid.CreateVersion7(), ownerType, ownerId, input.Text.Trim());
        note.CreatorId = currentUser.Id;
        note.CreationTime = DateTime.UtcNow;
        await noteRepository.InsertAsync(note);
        return ToDto(note, await GetUserNamesAsync([currentUser.Id]));
    }

    public async Task<NoteDto> UpdateNoteAsync(Guid id, CreateUpdateNoteInput input)
    {
        var note = await GetOwnNoteAsync(id);
        note.Edit(input.Text.Trim());
        return ToDto(note, await GetUserNamesAsync([note.CreatorId]));
    }

    public async Task DeleteNoteAsync(Guid id) => await noteRepository.DeleteAsync(await GetOwnNoteAsync(id));

    public async Task<List<TaskItemDto>> GetTasksAsync(OwnerType ownerType, Guid ownerId)
    {
        await EnsureAccessAsync(ownerType, ownerId);
        var tasks = await taskRepository.GetListAsync(ownerType, ownerId);
        var names = await GetUserNamesAsync(tasks.Select(t => t.AssignedUserId));
        return tasks.Select(t => ToDto(t, names)).ToList();
    }

    public async Task<TaskItemDto> AddTaskAsync(OwnerType ownerType, Guid ownerId, CreateUpdateTaskInput input)
    {
        await EnsureAccessAsync(ownerType, ownerId);
        var task = new TaskItem(Guid.CreateVersion7(), ownerType, ownerId, input.Title.Trim());
        task.Update(input.Title.Trim(), input.Description, input.AssignedUserId, input.DueDate);
        task.CreationTime = DateTime.UtcNow;
        await taskRepository.InsertAsync(task);
        return ToDto(task, await GetUserNamesAsync([task.AssignedUserId]));
    }

    public async Task<TaskItemDto> UpdateTaskAsync(Guid id, CreateUpdateTaskInput input)
    {
        var task = await taskRepository.GetAsync(id);
        await EnsureAccessAsync(task.OwnerType, task.OwnerId);
        task.Update(input.Title.Trim(), input.Description, input.AssignedUserId, input.DueDate);
        return ToDto(task, await GetUserNamesAsync([task.AssignedUserId]));
    }

    public async Task<TaskItemDto> SetTaskCompletedAsync(Guid id, SetTaskCompletedInput input)
    {
        var task = await taskRepository.GetAsync(id);
        await EnsureAccessAsync(task.OwnerType, task.OwnerId);
        task.SetCompleted(input.IsCompleted, DateTime.UtcNow);
        return ToDto(task, await GetUserNamesAsync([task.AssignedUserId]));
    }

    public async Task DeleteTaskAsync(Guid id)
    {
        var task = await taskRepository.GetAsync(id);
        await EnsureAccessAsync(task.OwnerType, task.OwnerId);
        await taskRepository.DeleteAsync(task);
    }

    public async Task<List<AttachmentDto>> GetAttachmentsAsync(OwnerType ownerType, Guid ownerId)
    {
        await EnsureAccessAsync(ownerType, ownerId);
        var files = await attachmentRepository.GetInfoListAsync(ownerType, ownerId);
        var names = await GetUserNamesAsync(files.Select(f => f.CreatorId));
        return files.Select(f => new AttachmentDto
        {
            Id = f.Id, FileName = f.FileName, ContentType = f.ContentType, Size = f.Size, CreationTime = f.CreationTime,
            UploaderName = f.CreatorId.HasValue ? names.GetValueOrDefault(f.CreatorId.Value) : null
        }).ToList();
    }

    public async Task<AttachmentDto> UploadAsync(OwnerType ownerType, Guid ownerId, UploadFileInput file)
    {
        await EnsureAccessAsync(ownerType, ownerId);
        var attachment = attachmentManager.Create(ownerType, ownerId, file.FileName, file.ContentType, file.Content, imageOnly: false);
        attachment.CreationTime = DateTime.UtcNow;
        attachment.CreatorId = currentUser.Id;
        await attachmentRepository.InsertAsync(attachment);
        return new AttachmentDto
        {
            Id = attachment.Id, FileName = attachment.FileName, ContentType = attachment.ContentType, Size = attachment.Size,
            CreationTime = attachment.CreationTime, UploaderName = (await GetUserNamesAsync([currentUser.Id])).Values.FirstOrDefault()
        };
    }

    public async Task<FileContentDto> DownloadAsync(Guid id)
    {
        var attachment = await attachmentRepository.GetAsync(id);
        await EnsureAccessAsync(attachment.OwnerType, attachment.OwnerId);
        return new FileContentDto { FileName = attachment.FileName, ContentType = attachment.ContentType, Content = attachment.Content };
    }

    public async Task DeleteAttachmentAsync(Guid id)
    {
        var attachment = await attachmentRepository.GetAsync(id);
        await EnsureAccessAsync(attachment.OwnerType, attachment.OwnerId);
        await attachmentRepository.DeleteAsync(attachment);
    }

    private async Task EnsureAccessAsync(OwnerType ownerType, Guid ownerId)
    {
        switch (ownerType)
        {
            case OwnerType.Project:
                await projectAccess.EnsureCanViewAsync(await projectRepository.GetAsync(ownerId));
                return;
            default:
                if (!await permissionChecker.IsGrantedAsync(StageTrackPermissions.Equipment.Default))
                {
                    throw new BusinessException(StageTrackErrorCodes.Forbidden);
                }

                return;
        }
    }

    /// <summary>Notes can be edited or deleted only by their author.</summary>
    private async Task<Note> GetOwnNoteAsync(Guid id)
    {
        var note = await noteRepository.GetAsync(id);
        if (note.CreatorId != currentUser.Id)
        {
            throw new BusinessException(StageTrackErrorCodes.Forbidden);
        }

        return note;
    }

    private async Task<Dictionary<Guid, string>> GetUserNamesAsync(IEnumerable<Guid?> ids) =>
        (await userRepository.GetListByIdsAsync(ids.Where(i => i.HasValue).Select(i => i!.Value))).ToDictionary(u => u.Id, u => u.FullName);

    private NoteDto ToDto(Note note, Dictionary<Guid, string> names) => new()
    {
        Id = note.Id,
        Text = note.Text,
        CreationTime = note.CreationTime,
        AuthorName = note.CreatorId.HasValue ? names.GetValueOrDefault(note.CreatorId.Value) : null,
        CanEdit = note.CreatorId == currentUser.Id
    };

    private static TaskItemDto ToDto(TaskItem task, Dictionary<Guid, string> names) => new()
    {
        Id = task.Id,
        Title = task.Title,
        Description = task.Description,
        AssignedUserId = task.AssignedUserId,
        AssignedUserName = task.AssignedUserId.HasValue ? names.GetValueOrDefault(task.AssignedUserId.Value) : null,
        DueDate = task.DueDate,
        IsCompleted = task.IsCompleted,
        CompletedAt = task.CompletedAt,
        CreationTime = task.CreationTime
    };
}
