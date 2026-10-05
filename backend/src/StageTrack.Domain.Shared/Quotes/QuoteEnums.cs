namespace StageTrack.Quotes;

public enum QuoteStatus
{
    Draft = 1,
    Sent = 2,
    Accepted = 3,
    Rejected = 4,
    Superseded = 5
}

public enum QuoteLineType
{
    Equipment = 1,
    Crew = 2,
    Transport = 3,
    Service = 4
}

public static class QuoteConsts
{
    public const int MaxNumberLength = 32;
    public const int MaxDescriptionLength = 512;
    public const int MaxNotesLength = 4000;
    public const int MaxRejectionReasonLength = 500;
    public const int MaxCurrencyLength = 3;
}

public static class RentalFactorConsts
{
    public const int MaxNameLength = 128;
    public const int MaxDays = 365;
}
