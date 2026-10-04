namespace StageTrack.Entities;

public abstract class Entity
{
    public Guid Id { get; protected set; }

    protected Entity()
    {
    }

    protected Entity(Guid id)
    {
        Id = id;
    }
}

/// <summary>Root of a consistency boundary; repositories exist only for aggregate roots.</summary>
public abstract class AggregateRoot : Entity
{
    protected AggregateRoot()
    {
    }

    protected AggregateRoot(Guid id) : base(id)
    {
    }
}

public interface IHasCreationTime
{
    DateTime CreationTime { get; set; }
}

public interface IAuditedObject : IHasCreationTime
{
    Guid? CreatorId { get; set; }
    DateTime? LastModificationTime { get; set; }
    Guid? LastModifierId { get; set; }
}

/// <summary>Deleting the entity only flags it; a global query filter hides it.</summary>
public interface ISoftDelete
{
    bool IsDeleted { get; set; }
    DateTime? DeletionTime { get; set; }
}

/// <summary>
/// Data that belongs to one company (Staras TR, Staras Dubai...). CompanyId is filled
/// from the current company on insert and a global query filter isolates the data.
/// </summary>
public interface IMultiCompany
{
    Guid CompanyId { get; set; }
}

/// <summary>Audited, soft-deletable, company-scoped aggregate root — the default base for business data.</summary>
public abstract class CompanyAggregateRoot : AggregateRoot, IAuditedObject, ISoftDelete, IMultiCompany
{
    public Guid CompanyId { get; set; }
    public DateTime CreationTime { get; set; }
    public Guid? CreatorId { get; set; }
    public DateTime? LastModificationTime { get; set; }
    public Guid? LastModifierId { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletionTime { get; set; }

    protected CompanyAggregateRoot()
    {
    }

    protected CompanyAggregateRoot(Guid id) : base(id)
    {
    }
}
