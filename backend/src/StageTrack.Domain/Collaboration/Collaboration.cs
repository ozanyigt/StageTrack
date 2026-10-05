using StageTrack.Entities;
using StageTrack.Repositories;

namespace StageTrack.Collaboration;

/// <summary>A file (photo, invoice, manual…) attached to equipment, a device or a project. Stored in the database.</summary>
public class Attachment : CompanyAggregateRoot
{
    public OwnerType OwnerType { get; private set; }
    public Guid OwnerId { get; private set; }
    public string FileName { get; private set; } = null!;
    public string ContentType { get; private set; } = null!;
    public long Size { get; private set; }
    public byte[] Content { get; private set; } = null!;

    private Attachment()
    {
    }

    internal Attachment(Guid id, OwnerType ownerType, Guid ownerId, string fileName, string contentType, byte[] content) : base(id)
    {
        OwnerType = ownerType;
        OwnerId = ownerId;
        FileName = fileName;
        ContentType = contentType;
        Content = content;
        Size = content.LongLength;
    }

    public bool IsImage => ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
}

public class Note : CompanyAggregateRoot
{
    public OwnerType OwnerType { get; private set; }
    public Guid OwnerId { get; private set; }
    public string Text { get; private set; } = null!;

    private Note()
    {
    }

    public Note(Guid id, OwnerType ownerType, Guid ownerId, string text) : base(id)
    {
        OwnerType = ownerType;
        OwnerId = ownerId;
        Text = text;
    }

    public void Edit(string text) => Text = text;
}

public class TaskItem : CompanyAggregateRoot
{
    public OwnerType OwnerType { get; private set; }
    public Guid OwnerId { get; private set; }
    public string Title { get; private set; } = null!;
    public string? Description { get; private set; }
    public Guid? AssignedUserId { get; private set; }
    public DateTime? DueDate { get; private set; }
    public bool IsCompleted { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    private TaskItem()
    {
    }

    public TaskItem(Guid id, OwnerType ownerType, Guid ownerId, string title) : base(id)
    {
        OwnerType = ownerType;
        OwnerId = ownerId;
        Title = title;
    }

    public void Update(string title, string? description, Guid? assignedUserId, DateTime? dueDate)
    {
        Title = title;
        Description = description;
        AssignedUserId = assignedUserId;
        DueDate = dueDate;
    }

    public void SetCompleted(bool completed, DateTime now)
    {
        IsCompleted = completed;
        CompletedAt = completed ? now : null;
    }
}

/// <summary>Attachment metadata without the file bytes, for lists.</summary>
public record AttachmentInfo(Guid Id, string FileName, string ContentType, long Size, DateTime CreationTime, Guid? CreatorId);

public interface IAttachmentRepository : IRepository<Attachment>
{
    Task<List<AttachmentInfo>> GetInfoListAsync(OwnerType ownerType, Guid ownerId, CancellationToken cancellationToken = default);
}

public interface INoteRepository : IRepository<Note>
{
    Task<List<Note>> GetListAsync(OwnerType ownerType, Guid ownerId, CancellationToken cancellationToken = default);
}

public interface ITaskItemRepository : IRepository<TaskItem>
{
    Task<List<TaskItem>> GetListAsync(OwnerType ownerType, Guid ownerId, CancellationToken cancellationToken = default);
}

public class AttachmentManager
{
    public Attachment Create(OwnerType ownerType, Guid ownerId, string fileName, string contentType, byte[] content, bool imageOnly)
    {
        if (content.LongLength > CollaborationConsts.MaxFileSize)
        {
            throw new BusinessException(StageTrackErrorCodes.AttachmentTooLarge).WithData("max", CollaborationConsts.MaxFileSize / 1024 / 1024);
        }

        var attachment = new Attachment(Guid.CreateVersion7(), ownerType, ownerId,
            Path.GetFileName(fileName).Trim() is { Length: > 0 } name ? name[..Math.Min(name.Length, CollaborationConsts.MaxFileNameLength)] : "file",
            string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType,
            content);

        if (imageOnly && !attachment.IsImage)
        {
            throw new BusinessException(StageTrackErrorCodes.AttachmentNotImage);
        }

        return attachment;
    }
}
