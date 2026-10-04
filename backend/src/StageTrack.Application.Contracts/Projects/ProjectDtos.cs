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
    public int ShortageCount { get; set; }
}

public class ProjectEquipmentDto
{
    public Guid Id { get; set; }
    public Guid EquipmentId { get; set; }
    public string EquipmentCode { get; set; } = null!;
    public string EquipmentName { get; set; } = null!;
    public bool IsSerialized { get; set; }
    public decimal RentalPrice { get; set; }
    public int Quantity { get; set; }
    public string? Notes { get; set; }
    public int Stock { get; set; }
    public int PlannedElsewhere { get; set; }
    public int Available { get; set; }
    public int Shortage { get; set; }
    public int OutQuantity { get; set; }
    public int ReturnedQuantity { get; set; }
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
}

public class AddProjectEquipmentInput
{
    [Required]
    public Guid EquipmentId { get; set; }

    [Range(1, 100_000)]
    public int Quantity { get; set; } = 1;
}

public class UpdateProjectEquipmentInput
{
    [Range(1, 100_000)]
    public int Quantity { get; set; }

    [StringLength(1000)]
    public string? Notes { get; set; }
}

public class ChangeProjectStatusInput
{
    public ProjectStatus Status { get; set; }
}

public interface IProjectAppService
{
    Task<PagedResultDto<ProjectListItemDto>> GetListAsync(GetProjectListInput input);

    Task<ProjectDto> GetAsync(Guid id);

    Task<ProjectDto> CreateAsync(CreateUpdateProjectDto input);

    Task<ProjectDto> UpdateAsync(Guid id, CreateUpdateProjectDto input);

    Task DeleteAsync(Guid id);

    Task<ProjectDto> ChangeStatusAsync(Guid id, ChangeProjectStatusInput input);

    Task<ProjectDto> AddEquipmentAsync(Guid id, AddProjectEquipmentInput input);

    Task<ProjectDto> UpdateEquipmentAsync(Guid id, Guid lineId, UpdateProjectEquipmentInput input);

    Task<ProjectDto> RemoveEquipmentAsync(Guid id, Guid lineId);
}
