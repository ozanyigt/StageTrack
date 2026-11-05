namespace StageTrack.Design.Transport;

/// <summary>How a panel model travels: in flight cases, or on dollies (Lojistik). The case fields of the model describe either.</summary>
public enum TransportKind
{
    // One-based like every other stored enum here, so a zero in the column means "nobody set this" rather than
    // silently meaning Case.
    Case = 1,
    Dolly = 2,
}
