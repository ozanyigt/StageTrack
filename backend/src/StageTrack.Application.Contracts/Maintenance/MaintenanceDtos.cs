using System.ComponentModel.DataAnnotations;
using StageTrack.Dtos;

namespace StageTrack.Maintenance;

public class RepairDto
{
    public Guid Id { get; set; }
    public int Number { get; set; }
    public Guid EquipmentId { get; set; }
    public string EquipmentCode { get; set; } = null!;
    public string EquipmentName { get; set; } = null!;
    public Guid? UnitId { get; set; }
    public string? UnitInternalRef { get; set; }
    public int Quantity { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public RepairStatus Status { get; set; }
    public DateTime ReportedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public Guid? SupplierId { get; set; }
    public string? SupplierName { get; set; }
    public decimal? Cost { get; set; }
    public List<RepairStatus> AllowedStatuses { get; set; } = [];
}

public class GetRepairListInput : PagedRequestDto
{
    public string? Text { get; set; }
    public Guid? EquipmentId { get; set; }
    public Guid? UnitId { get; set; }
    public RepairStatus? Status { get; set; }
    public bool OnlyOpen { get; set; }
}

public class CreateRepairInput
{
    [Required]
    public Guid EquipmentId { get; set; }

    public Guid? UnitId { get; set; }

    [Range(1, 10_000)]
    public int Quantity { get; set; } = 1;

    [Required, StringLength(MaintenanceConsts.MaxTitleLength)]
    public string Title { get; set; } = null!;

    [StringLength(MaintenanceConsts.MaxDescriptionLength)]
    public string? Description { get; set; }

    public Guid? SupplierId { get; set; }

    [Range(0, 100_000_000)]
    public decimal? Cost { get; set; }
}

public class UpdateRepairInput
{
    [Required, StringLength(MaintenanceConsts.MaxTitleLength)]
    public string Title { get; set; } = null!;

    [StringLength(MaintenanceConsts.MaxDescriptionLength)]
    public string? Description { get; set; }

    public Guid? SupplierId { get; set; }

    [Range(0, 100_000_000)]
    public decimal? Cost { get; set; }
}

public class ChangeRepairStatusInput
{
    public RepairStatus Status { get; set; }
}

public class InspectionDto
{
    public Guid Id { get; set; }
    public Guid UnitId { get; set; }
    public string UnitInternalRef { get; set; } = null!;
    public DateTime Date { get; set; }
    public bool Passed { get; set; }
    public string? Notes { get; set; }
    public string? InspectorName { get; set; }
}

public class RecordInspectionInput
{
    [Required]
    public Guid UnitId { get; set; }

    public DateTime Date { get; set; }
    public bool Passed { get; set; } = true;

    [StringLength(MaintenanceConsts.MaxNotesLength)]
    public string? Notes { get; set; }
}

public interface IRepairAppService
{
    Task<PagedResultDto<RepairDto>> GetListAsync(GetRepairListInput input);

    Task<RepairDto> CreateAsync(CreateRepairInput input);

    Task<RepairDto> UpdateAsync(Guid id, UpdateRepairInput input);

    Task<RepairDto> ChangeStatusAsync(Guid id, ChangeRepairStatusInput input);
}

public interface IInspectionAppService
{
    Task<List<InspectionDto>> GetListAsync(Guid? equipmentId, Guid? unitId);

    Task<InspectionDto> RecordAsync(RecordInspectionInput input);
}
