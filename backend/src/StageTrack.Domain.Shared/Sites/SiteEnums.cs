namespace StageTrack.Sites;

public static class SiteConsts
{
    public const int MaxNameLength = 128;

    /// <summary>A room is at least this and at most this, metres; wide enough for a club and a stadium bowl.</summary>
    public const double MinVenueM = 1;

    public const double MaxVenueM = 1000;

    /// <summary>Clear height; above this it is open air, and 0 means nobody entered one.</summary>
    public const double MaxVenueHeightM = 200;
}
