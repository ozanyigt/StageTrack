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

    /// <summary>Confirmed by the user: an unplanned (or extra) item is added to the "added products" section.</summary>
    public bool AllowUnplanned { get; set; }
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

    /// <summary>Nothing was recorded: ask "not on the quote / more than planned — add it?" and scan again with AllowUnplanned.</summary>
    public bool RequiresConfirmation { get; set; }
}

/// <summary>Scan screen: the planned list in the quote's sections with what is out / back, per line.</summary>
public class ScanSheetDto
{
    public Guid ProjectId { get; set; }
    public int Number { get; set; }
    public string Name { get; set; } = null!;
    public Projects.ProjectStatus Status { get; set; }
    public string? CustomerName { get; set; }
    public string? Venue { get; set; }
    public DateTime PlanStart { get; set; }
    public DateTime PlanEnd { get; set; }

    /// <summary>Statuses the warehouse may set (prepped, on location, returned).</summary>
    public List<Projects.ProjectStatus> AllowedStatuses { get; set; } = [];

    public List<ScanSheetSectionDto> Sections { get; set; } = [];
    public List<ScanSheetLineDto> Lines { get; set; } = [];
}

public class ScanSheetSectionDto
{
    public Guid Id { get; set; }
    public Guid? ParentId { get; set; }
    public string Name { get; set; } = null!;
    public int Depth { get; set; }
    public bool IsWarehouseExtras { get; set; }
}

public class ScanSheetLineDto
{
    public Guid LineId { get; set; }
    public Guid? ParentLineId { get; set; }
    public Guid? SectionId { get; set; }
    public Guid EquipmentId { get; set; }
    public string Code { get; set; } = null!;
    public string Name { get; set; } = null!;
    public bool IsSerialized { get; set; }
    public bool IsExtra { get; set; }
    public int Planned { get; set; }

    /// <summary>Scanned out for this line (the equipment's scans are spread over its lines in order).</summary>
    public int Out { get; set; }

    public int Returned { get; set; }

    /// <summary>Devices currently out for this line, e.g. "TR-003".</summary>
    public List<ScanSheetUnitDto> UnitsOut { get; set; } = [];

    public List<ScanSheetUnitDto> UnitsReturned { get; set; } = [];
}

public class ScanSheetUnitDto
{
    public Guid UnitId { get; set; }
    public string InternalRef { get; set; } = null!;
    public string? SerialNumber { get; set; }
}

public class SetWarehouseProjectStatusInput
{
    public Projects.ProjectStatus Status { get; set; }
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
    public string? Note { get; set; }
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

    Task<ScanSheetDto> GetScanSheetAsync(Guid projectId);

    /// <summary>Warehouse sets prepped / on location / returned without access to the project details.</summary>
    Task<ScanSheetDto> SetProjectStatusAsync(Guid projectId, SetWarehouseProjectStatusInput input);

    Task<WarehouseBoardDto> GetBoardAsync(GetWarehouseBoardInput input);

    Task<PagedResultDto<MovementDto>> GetMovementsAsync(GetMovementListInput input);
}
