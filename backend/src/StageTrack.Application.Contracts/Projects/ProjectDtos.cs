using System.ComponentModel.DataAnnotations;
using StageTrack.Dtos;

namespace StageTrack.Projects;

public class ProjectListItemDto
{
    public Guid Id { get; set; }
    public int Number { get; set; }
    public string Name { get; set; } = null!;
    public Guid? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public string? Venue { get; set; }
    public DateTime PlanStart { get; set; }
    public DateTime PlanEnd { get; set; }
    public DateTime? UseStart { get; set; }
    public DateTime? UseEnd { get; set; }
    public ProjectStatus Status { get; set; }
    public string Color { get; set; } = null!;
    public string? ProjectType { get; set; }
    public Guid? StockLocationId { get; set; }
    public string? StockLocationName { get; set; }
    public int PlannedQuantity { get; set; }
}

public class ProjectDto : ProjectListItemDto
{
    public string? Notes { get; set; }
    public int RentalDays { get; set; }
    public bool IsEditable { get; set; }
    public List<ProjectStatus> AllowedStatuses { get; set; } = [];
    public List<ProjectEquipmentDto> Equipment { get; set; } = [];
    public List<ProjectSectionDto> Sections { get; set; } = [];
    public List<ProjectCrewDto> Crew { get; set; } = [];
    public int ShortageCount { get; set; }
    public Guid? AccountManagerId { get; set; }
    public string? AccountManagerName { get; set; }
    public string? PaymentTerms { get; set; }

    /// <summary>True for crew members' read-only view (no prices, no editing).</summary>
    public bool IsCrewView { get; set; }
}

public class ProjectSectionDto
{
    public Guid Id { get; set; }
    public Guid? ParentId { get; set; }
    public string Name { get; set; } = null!;
    public int SortOrder { get; set; }
    public int Depth { get; set; }
    public string Path { get; set; } = null!;
}

public class ProjectEquipmentDto
{
    public Guid Id { get; set; }
    public Guid EquipmentId { get; set; }
    public Guid? SectionId { get; set; }
    public int SortOrder { get; set; }
    public string EquipmentCode { get; set; } = null!;
    public string EquipmentName { get; set; } = null!;
    public bool IsSerialized { get; set; }

    /// <summary>Null when the user may not see prices.</summary>
    public decimal? RentalPrice { get; set; }

    public int Quantity { get; set; }
    public string? Notes { get; set; }
    public int Stock { get; set; }
    public int PlannedElsewhere { get; set; }
    public int Available { get; set; }

    /// <summary>Missing pieces of this equipment for the whole project (same value on each of its lines).</summary>
    public int Shortage { get; set; }

    public int OutQuantity { get; set; }
    public int ReturnedQuantity { get; set; }
    public List<AlternativeDto> Alternatives { get; set; } = [];
}

public class AlternativeDto
{
    public Guid EquipmentId { get; set; }
    public string Code { get; set; } = null!;
    public string Name { get; set; } = null!;
    public int Available { get; set; }
}

public class ProjectCrewDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string FullName { get; set; } = null!;
    public string? JobTitle { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Function { get; set; }
}

public class GetProjectListInput : PagedRequestDto
{
    public string? Text { get; set; }
    public List<ProjectStatus>? Statuses { get; set; }
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
    public Guid? CustomerId { get; set; }
}

public class CreateUpdateProjectDto
{
    [Required, StringLength(ProjectConsts.MaxNameLength)]
    public string Name { get; set; } = null!;

    public Guid? CustomerId { get; set; }

    [StringLength(ProjectConsts.MaxVenueLength)]
    public string? Venue { get; set; }

    public DateTime PlanStart { get; set; }
    public DateTime PlanEnd { get; set; }
    public DateTime? UseStart { get; set; }
    public DateTime? UseEnd { get; set; }

    [Required, StringLength(ProjectConsts.MaxColorLength)]
    public string Color { get; set; } = "#1677ff";

    [StringLength(ProjectConsts.MaxProjectTypeLength)]
    public string? ProjectType { get; set; }

    public Guid? StockLocationId { get; set; }

    [StringLength(ProjectConsts.MaxNotesLength)]
    public string? Notes { get; set; }

    public Guid? AccountManagerId { get; set; }

    [StringLength(256)]
    public string? PaymentTerms { get; set; }
}

public class AddProjectEquipmentInput
{
    [Required]
    public Guid EquipmentId { get; set; }

    [Range(1, 100_000)]
    public int Quantity { get; set; } = 1;

    public Guid? SectionId { get; set; }

    /// <summary>Also add the equipment's accessories (Rentman "Accessories") to the same section.</summary>
    public bool IncludeAccessories { get; set; }
}

public class UpdateProjectEquipmentInput
{
    [Range(1, 100_000)]
    public int Quantity { get; set; }

    [StringLength(1000)]
    public string? Notes { get; set; }
}

public class MoveProjectEquipmentInput
{
    /// <summary>Target section (null = no section). Ignored when <see cref="Direction"/> is set.</summary>
    public Guid? SectionId { get; set; }

    /// <summary>-1 = up, 1 = down within the section.</summary>
    public int? Direction { get; set; }
}

public class CreateUpdateSectionInput
{
    [Required, StringLength(128)]
    public string Name { get; set; } = null!;

    public Guid? ParentId { get; set; }
}

public class MoveSectionInput
{
    public int Direction { get; set; }
}

public class AddCrewInput
{
    [Required]
    public Guid UserId { get; set; }

    [StringLength(128)]
    public string? Function { get; set; }
}

public class UpdateCrewInput
{
    [StringLength(128)]
    public string? Function { get; set; }
}

public class ChangeProjectStatusInput
{
    public ProjectStatus Status { get; set; }
}

/// <summary>Price-free material list (Rentman "Depo fişi" / packing slip), grouped by sections.</summary>
public class PackingSlipDto
{
    public Guid ProjectId { get; set; }
    public int ProjectNumber { get; set; }
    public string ProjectName { get; set; } = null!;
    public string? CustomerName { get; set; }
    public string? Venue { get; set; }
    public string? AccountManagerName { get; set; }
    public string? PaymentTerms { get; set; }
    public DateTime PlanStart { get; set; }
    public DateTime PlanEnd { get; set; }
    public DateTime? UseStart { get; set; }
    public DateTime? UseEnd { get; set; }
    public DateTime CreatedAt { get; set; }
    public string CompanyName { get; set; } = null!;
    public List<PackingSlipSectionDto> Sections { get; set; } = [];
    public List<ProjectCrewDto> Crew { get; set; } = [];
}

public class PackingSlipSectionDto
{
    /// <summary>Null for lines without a section.</summary>
    public string? Name { get; set; }

    public int Depth { get; set; }
    public List<PackingSlipLineDto> Lines { get; set; } = [];
}

public class PackingSlipLineDto
{
    public string Code { get; set; } = null!;
    public string Name { get; set; } = null!;
    public int Quantity { get; set; }
    public string? Notes { get; set; }

    /// <summary>Default content of a kit (e.g. truss roof system sections), printed indented.</summary>
    public List<PackingSlipLineDto> Content { get; set; } = [];
}

public class CrewDirectoryEntryDto
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = null!;
    public string? JobTitle { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public List<string> Roles { get; set; } = [];
}

public interface IProjectAppService
{
    Task<PagedResultDto<ProjectListItemDto>> GetListAsync(GetProjectListInput input);

    Task<ProjectDto> GetAsync(Guid id);

    Task<PackingSlipDto> GetPackingSlipAsync(Guid id);

    Task<ProjectDto> CreateAsync(CreateUpdateProjectDto input);

    Task<ProjectDto> UpdateAsync(Guid id, CreateUpdateProjectDto input);

    Task DeleteAsync(Guid id);

    Task<ProjectDto> ChangeStatusAsync(Guid id, ChangeProjectStatusInput input);

    Task<ProjectDto> AddEquipmentAsync(Guid id, AddProjectEquipmentInput input);

    Task<ProjectDto> UpdateEquipmentAsync(Guid id, Guid lineId, UpdateProjectEquipmentInput input);

    Task<ProjectDto> MoveEquipmentAsync(Guid id, Guid lineId, MoveProjectEquipmentInput input);

    Task<ProjectDto> RemoveEquipmentAsync(Guid id, Guid lineId);

    Task<ProjectDto> AddSectionAsync(Guid id, CreateUpdateSectionInput input);

    Task<ProjectDto> RenameSectionAsync(Guid id, Guid sectionId, CreateUpdateSectionInput input);

    Task<ProjectDto> MoveSectionAsync(Guid id, Guid sectionId, MoveSectionInput input);

    Task<ProjectDto> RemoveSectionAsync(Guid id, Guid sectionId);

    Task<ProjectDto> AddCrewAsync(Guid id, AddCrewInput input);

    Task<ProjectDto> UpdateCrewAsync(Guid id, Guid crewId, UpdateCrewInput input);

    Task<ProjectDto> RemoveCrewAsync(Guid id, Guid crewId);
}

public interface ICrewAppService
{
    Task<List<CrewDirectoryEntryDto>> GetDirectoryAsync();
}
