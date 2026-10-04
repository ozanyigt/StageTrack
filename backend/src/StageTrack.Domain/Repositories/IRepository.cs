using StageTrack.Entities;

namespace StageTrack.Repositories;

/// <summary>
/// Generic repository for aggregate roots. It deliberately does not expose IQueryable:
/// every query lives as a named method in the EF Core layer.
/// </summary>
public interface IRepository<TEntity> where TEntity : AggregateRoot
{
    Task<TEntity?> FindAsync(Guid id, bool includeDetails = true, CancellationToken cancellationToken = default);

    /// <exception cref="EntityNotFoundException">When no entity has the given id.</exception>
    Task<TEntity> GetAsync(Guid id, bool includeDetails = true, CancellationToken cancellationToken = default);

    Task<List<TEntity>> GetListAsync(bool includeDetails = false, CancellationToken cancellationToken = default);

    Task<List<TEntity>> GetListByIdsAsync(IEnumerable<Guid> ids, bool includeDetails = false, CancellationToken cancellationToken = default);

    Task<long> GetCountAsync(CancellationToken cancellationToken = default);

    Task<TEntity> InsertAsync(TEntity entity, CancellationToken cancellationToken = default);

    Task<TEntity> UpdateAsync(TEntity entity, CancellationToken cancellationToken = default);

    Task DeleteAsync(TEntity entity, CancellationToken cancellationToken = default);
}

/// <summary>Commits the changes collected during a request. Called once at the end of each API call.</summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
