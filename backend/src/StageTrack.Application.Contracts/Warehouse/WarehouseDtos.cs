using System.ComponentModel.DataAnnotations;
using StageTrack.Dtos;
using StageTrack.Inventory;
using StageTrack.Projects;

namespace StageTrack.Warehouse;

public class ScanInput
{
    [Required]
    public Guid ProjectId { get; set; }

    [Required, StringLength(EquipmentLabelConsts.MaxCodeLength)]
    public string Code { get; set; } = null!;

    public ScanDirection Direction { get; set; } = ScanDirection.Out;
}

public class ScanResultDto
{
    public ScanDirection Direction { get; set; }
    public string LabelCode { get; set; } = null!;
    public Guid EquipmentId { get; set; }
    public string EquipmentCode { get; set; } = null!;
    public string EquipmentName { get; set; } = null!;
    public Guid? UnitId { get; set; }
    public string? UnitInternalRef { get; set; }
    public string? UnitSerialNumber { get; set; }
    public int PlannedQuantity { get; set; }
    public int OutQuantity { get; set; }
    public bool AlreadyScanned { get; set; }
    public List<ScanWarning> Warnings { get; set; } = [];
}

public class PackingListDto
{
    public Guid ProjectId { get; set; }
    public int Number { get; set; }
    public string Name { get; set; } = null!;
    public ProjectStatus Status { get; set; }
    public string? CustomerName { get; set; }
    public string? Venue { get; set; }
    public DateTime PlanStart { get; set; }
    public DateTime PlanEnd { get; set; }
    public List<PackingLineDto> Lines { get; set; } = [];
    public int TotalPlanned { get; set; }
    public int TotalOut { get; set; }
}

public class PackingLineDto
{
    public Guid EquipmentId { get; set; }
    public string EquipmentCode { get; set; } = null!;
    public string EquipmentName { get; set; } = null!;
    public bool IsSerialized { get; set; }
    public int Planned { get; set; }
    public int Out { get; set; }
    public int Returned { get; set; }
    public List<string> UnitsOut { get; set; } = [];
}

public class GetWarehouseBoardInput
{
    public DateTime? Date { get; set; }
    public Guid? StockLocationId { get; set; }
}

public class WarehouseBoardDto
{
    public DateTime Date { get; set; }
    public List<ProjectListItemDto> Confirmed { get; set; } = [];
    public List<ProjectListItemDto> Prepped { get; set; } = [];
    public List<ProjectListItemDto> OnLocation { get; set; } = [];
    public List<ProjectListItemDto> ExpectedBack { get; set; } = [];
    public List<ProjectListItemDto> Delayed { get; set; } = [];
}

public class MovementDto
{
    public Guid Id { get; set; }
    public DateTime CreationTime { get; set; }
    public MovementAction Action { get; set; }
    public Guid EquipmentId { get; set; }
    public string EquipmentCode { get; set; } = null!;
    public string EquipmentName { get; set; } = null!;
    public Guid? UnitId { get; set; }
    public string? UnitInternalRef { get; set; }
    public string? UnitSerialNumber { get; set; }
    public Guid? ProjectId { get; set; }
    public int? ProjectNumber { get; set; }
    public string? ProjectName { get; set; }
    public string? UserFullName { get; set; }
    public string? LabelCode { get; set; }
    public int Quantity { get; set; }
}

public class GetMovementListInput : PagedRequestDto
{
    public string? Text { get; set; }
    public Guid? ProjectId { get; set; }
    public Guid? EquipmentId { get; set; }
    public Guid? UnitId { get; set; }
    public MovementAction? Action { get; set; }
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
}

public interface IWarehouseAppService
{
    Task<ScanResultDto> ScanAsync(ScanInput input);

    Task<PackingListDto> GetPackingListAsync(Guid projectId);

    Task<WarehouseBoardDto> GetBoardAsync(GetWarehouseBoardInput input);

    Task<PagedResultDto<MovementDto>> GetMovementsAsync(GetMovementListInput input);
}
