namespace StageTrack.Projects;

public enum ProjectStatus
{
    Draft = 1,
    Pending = 2,
    Confirmed = 3,
    Prepped = 4,
    OnLocation = 5,
    Returned = 6,
    Cancelled = 7
}

public static class ProjectConsts
{
    public const int MaxNameLength = 256;
    public const int MaxVenueLength = 256;
    public const int MaxColorLength = 16;
    public const int MaxProjectTypeLength = 64;
    public const int MaxNotesLength = 4000;
}
