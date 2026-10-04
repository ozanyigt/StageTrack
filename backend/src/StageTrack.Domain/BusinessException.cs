namespace StageTrack;

/// <summary>
/// A rule violation that the user can understand and fix. The <see cref="Code"/> is translated
/// on both sides (backend JSON + frontend "errors" namespace); <see cref="Details"/> fills the placeholders.
/// </summary>
public class BusinessException : Exception
{
    public string Code { get; }

    public Dictionary<string, object?> Details { get; } = new();

    public BusinessException(string code) : base(code)
    {
        Code = code;
    }

    public BusinessException WithData(string name, object? value)
    {
        Details[name] = value;
        return this;
    }
}

public class EntityNotFoundException : BusinessException
{
    public EntityNotFoundException(Type entityType, object? id = null)
        : base(StageTrackErrorCodes.EntityNotFound)
    {
        WithData("entity", entityType.Name);
        WithData("id", id);
    }
}
