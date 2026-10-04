using System.ComponentModel.DataAnnotations;

namespace StageTrack.Dtos;

public class PagedResultDto<T>(long totalCount, IReadOnlyList<T> items)
{
    public long TotalCount { get; } = totalCount;
    public IReadOnlyList<T> Items { get; } = items;
}

public class PagedRequestDto
{
    public const int MaxPageSize = 1000;

    [Range(0, int.MaxValue)]
    public int SkipCount { get; set; }

    [Range(1, MaxPageSize)]
    public int MaxResultCount { get; set; } = 20;

    public string? Sorting { get; set; }
}

public class LookupDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Code { get; set; }
}
