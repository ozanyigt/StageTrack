using Microsoft.EntityFrameworkCore;
using StageTrack.Entities;
using StageTrack.EntityFrameworkCore;

namespace StageTrack.Repositories;

public class EfRepository<TEntity>(StageTrackDbContext dbContext) : IRepository<TEntity> where TEntity : AggregateRoot
{
    protected StageTrackDbContext DbContext => dbContext;
    protected DbSet<TEntity> DbSet => dbContext.Set<TEntity>();

    /// <summary>Overridden by aggregates that own child collections (project equipment, quote lines...).</summary>
    protected virtual IQueryable<TEntity> WithDetails(IQueryable<TEntity> query) => query;

    protected IQueryable<TEntity> Query(bool includeDetails) => includeDetails ? WithDetails(DbSet) : DbSet;

    public virtual Task<TEntity?> FindAsync(Guid id, bool includeDetails = true, CancellationToken cancellationToken = default) =>
        Query(includeDetails).FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

    public virtual async Task<TEntity> GetAsync(Guid id, bool includeDetails = true, CancellationToken cancellationToken = default) =>
        await FindAsync(id, includeDetails, cancellationToken) ?? throw new EntityNotFoundException(typeof(TEntity), id);

    public virtual Task<List<TEntity>> GetListAsync(bool includeDetails = false, CancellationToken cancellationToken = default) =>
        Query(includeDetails).ToListAsync(cancellationToken);

    public virtual Task<List<TEntity>> GetListByIdsAsync(IEnumerable<Guid> ids, bool includeDetails = false, CancellationToken cancellationToken = default)
    {
        var idList = ids.Distinct().ToList();
        return Query(includeDetails).Where(e => idList.Contains(e.Id)).ToListAsync(cancellationToken);
    }

    public virtual Task<long> GetCountAsync(CancellationToken cancellationToken = default) =>
        DbSet.LongCountAsync(cancellationToken);

    public virtual Task<TEntity> InsertAsync(TEntity entity, CancellationToken cancellationToken = default)
    {
        DbSet.Add(entity);
        return Task.FromResult(entity);
    }

    public virtual Task<TEntity> UpdateAsync(TEntity entity, CancellationToken cancellationToken = default)
    {
        if (dbContext.Entry(entity).State == EntityState.Detached)
        {
            DbSet.Update(entity);
        }

        return Task.FromResult(entity);
    }

    public virtual Task DeleteAsync(TEntity entity, CancellationToken cancellationToken = default)
    {
        DbSet.Remove(entity);
        return Task.CompletedTask;
    }
}

public class EfUnitOfWork(StageTrackDbContext dbContext) : IUnitOfWork
{
    public Task SaveChangesAsync(CancellationToken cancellationToken = default) => dbContext.SaveChangesAsync(cancellationToken);
}
