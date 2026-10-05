namespace StageTrack.Collaboration;

/// <summary>Records that can carry notes, tasks and files.</summary>
public enum OwnerType
{
    Equipment = 1,
    Unit = 2,
    Project = 3
}

public static class CollaborationConsts
{
    public const int MaxFileNameLength = 256;
    public const int MaxContentTypeLength = 128;

    /// <summary>10 MB per file.</summary>
    public const long MaxFileSize = 10 * 1024 * 1024;

    public const int MaxNoteLength = 4000;
    public const int MaxTaskTitleLength = 256;
    public const int MaxTaskDescriptionLength = 2000;
}

public static class LabelTemplateConsts
{
    public const int MaxNameLength = 128;
    public const int MinSizeMm = 10;
    public const int MaxSizeMm = 300;
}
