namespace StageTrack.Session;

public interface ICurrentUser
{
    bool IsAuthenticated { get; }
    Guid? Id { get; }
    string? UserName { get; }

    /// <summary>Set while an admin is signed in as this user ("log in as"); the real person behind the session.</summary>
    Guid? ImpersonatorId { get; }
}

public interface ICurrentCompany
{
    /// <summary>Company selected by the client (X-Company-Id header) or set with <see cref="Change"/>.</summary>
    Guid? Id { get; }

    /// <summary>Runs the following code in another company's context (seeding, background work); dispose to restore.</summary>
    IDisposable Change(Guid? companyId);
}

/// <summary>Async-flow scoped override used by <see cref="ICurrentCompany.Change"/> implementations.</summary>
public static class CompanyScope
{
    private static readonly AsyncLocal<Guid?[]?> Override = new();

    /// <summary>Null when no override is active; otherwise a one-element array holding the (possibly null) company id.</summary>
    public static Guid?[]? Current => Override.Value;

    public static IDisposable Begin(Guid? companyId)
    {
        var previous = Override.Value;
        Override.Value = [companyId];
        return new Restore(previous);
    }

    private sealed class Restore(Guid?[]? previous) : IDisposable
    {
        public void Dispose() => Override.Value = previous;
    }
}
