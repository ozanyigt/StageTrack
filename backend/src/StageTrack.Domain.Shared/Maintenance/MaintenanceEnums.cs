namespace StageTrack.Maintenance;

public enum RepairStatus
{
    Open = 1,
    InProgress = 2,
    Completed = 3,
    Cancelled = 4
}

public static class MaintenanceConsts
{
    public const int MaxTitleLength = 256;
    public const int MaxDescriptionLength = 4000;
    public const int MaxNotesLength = 2000;
}
