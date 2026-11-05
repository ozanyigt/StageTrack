using System.ComponentModel.DataAnnotations;

namespace StageTrack.Design;

/// <summary>A processor, extender or other equipment the calculation picked, and how many.</summary>
public sealed record DraftToJobItemRequest(Guid EquipmentId, int Count);

/// <summary>
/// A calculated LED job on its way to a real job: the screens (as the stock status sees them), the processors and
/// extenders chosen for them, and anything else the user added. What the panels come to is worked out here rather
/// than trusted from the client — the same count the stock status and the loading plan use.
/// </summary>
public class DraftToJobInput
{
    [Required]
    public List<LedStockScreenRequest> Screens { get; set; } = [];

    public List<DraftToJobItemRequest> Processors { get; set; } = [];
    public List<DraftToJobItemRequest> Extenders { get; set; } = [];
    public List<DraftToJobItemRequest> Equipment { get; set; } = [];

    /// <summary>
    /// Section to put the lines in; null = a new section is made for them. The name is only used for a new one.
    /// </summary>
    public Guid? SectionId { get; set; }

    [StringLength(128)]
    public string? SectionName { get; set; }

    /// <summary>
    /// Add to what the job already plans instead of replacing the section's lines. Off (the default) is what the
    /// user expects after changing a screen and sending it over again.
    /// </summary>
    public bool Append { get; set; }
}

/// <summary>What one line of the transfer came from, so the screen can explain the result.</summary>
public enum DraftToJobLineSource
{
    Panel = 1,
    Processor = 2,
    Extender = 3,
    Equipment = 4
}

public sealed record DraftToJobLineDto(DraftToJobLineSource Source, Guid EquipmentId, string Code, string Name, int Quantity, bool Added, string? Problem);

/// <summary>
/// The result of the transfer: what was planned, and what could not be (archived equipment, items the firm keeps
/// off quotes). The section the lines landed in is returned so the screen can link straight to it.
/// </summary>
public sealed record DraftToJobResultDto(Guid ProjectId, Guid? SectionId, string SectionName, IReadOnlyList<DraftToJobLineDto> Lines);

/// <summary>Turns a calculated LED job into planned equipment on a real job; its draft quote follows along.</summary>
public interface IDraftToJobAppService
{
    /// <summary>What the transfer would plan, without changing anything.</summary>
    Task<DraftToJobResultDto> PreviewAsync(Guid projectId, DraftToJobInput input);

    Task<DraftToJobResultDto> TransferAsync(Guid projectId, DraftToJobInput input);
}
