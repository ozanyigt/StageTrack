using StageTrack.Repositories;

namespace StageTrack.Quotes;

public class QuoteFilter
{
    public string? Text { get; set; }
    public Guid? ProjectId { get; set; }
    public QuoteStatus? Status { get; set; }
}

public class QuoteListItem
{
    public required Quote Quote { get; init; }
    public required int ProjectNumber { get; init; }
    public required string ProjectName { get; init; }
    public string? CustomerName { get; init; }
}

public interface IQuoteRepository : IRepository<Quote>
{
    /// <summary>Highest sequence used in the year's quote numbers (TKL-2026-0042 → 42); revisions share a number.</summary>
    Task<int> GetLastSequenceForYearAsync(int year, CancellationToken cancellationToken = default);

    Task<List<QuoteListItem>> GetPagedListAsync(QuoteFilter filter, int skip, int take, CancellationToken cancellationToken = default);

    Task<long> GetCountAsync(QuoteFilter filter, CancellationToken cancellationToken = default);
}
