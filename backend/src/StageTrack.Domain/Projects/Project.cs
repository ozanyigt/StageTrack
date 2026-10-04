using StageTrack.Entities;

namespace StageTrack.Projects;

/// <summary>
/// A job (concert, congress, fixed installation...). The planning period covers prep and
/// return; the usage period is the event itself and drives rental days on quotes.
/// </summary>
public class Project : CompanyAggregateRoot
{
    public int Number { get; private set; }
    public string Name { get; private set; } = null!;
    public Guid? CustomerId { get; private set; }
    public string? Venue { get; private set; }
    public DateTime PlanStart { get; private set; }
    public DateTime PlanEnd { get; private set; }
    public DateTime? UseStart { get; private set; }
    public DateTime? UseEnd { get; private set; }
    public ProjectStatus Status { get; private set; } = ProjectStatus.Draft;
    public string Color { get; private set; } = "#1677ff";
    public string? ProjectType { get; private set; }
    public Guid? StockLocationId { get; private set; }
    public string? Notes { get; private set; }

    public ICollection<ProjectEquipment> Equipment { get; private set; } = new List<ProjectEquipment>();

    private Project()
    {
    }

    internal Project(Guid id, int number, string name, DateTime planStart, DateTime planEnd) : base(id)
    {
        Number = number;
        Name = name;
        SetPlanPeriod(planStart, planEnd);
    }

    public bool IsEditable => Status is not (ProjectStatus.Returned or ProjectStatus.Cancelled);

    /// <summary>Rental days used by quotes: usage period when set, otherwise the planning period (inclusive).</summary>
    public int RentalDays
    {
        get
        {
            var start = UseStart ?? PlanStart;
            var end = UseEnd ?? PlanEnd;
            return Math.Max(1, (end.Date - start.Date).Days + 1);
        }
    }

    public void Update(string name, Guid? customerId, string? venue, string color, string? projectType,
        Guid? stockLocationId, string? notes)
    {
        EnsureEditable();
        Name = name;
        CustomerId = customerId;
        Venue = venue;
        Color = color;
        ProjectType = projectType;
        StockLocationId = stockLocationId;
        Notes = notes;
    }

    public void SetPlanPeriod(DateTime start, DateTime end)
    {
        if (end < start)
        {
            throw new BusinessException(StageTrackErrorCodes.ProjectInvalidDateRange);
        }

        PlanStart = start;
        PlanEnd = end;
    }

    public void SetUsePeriod(DateTime? start, DateTime? end)
    {
        if (start.HasValue && end.HasValue && end < start)
        {
            throw new BusinessException(StageTrackErrorCodes.ProjectInvalidDateRange);
        }

        UseStart = start;
        UseEnd = end;
    }

    /// <summary>Adds the equipment or, when it is already planned, adds to its quantity.</summary>
    internal ProjectEquipment AddEquipment(Guid equipmentId, int quantity)
    {
        EnsureEditable();
        EnsurePositive(quantity);

        var line = Equipment.FirstOrDefault(e => e.EquipmentId == equipmentId);
        if (line is not null)
        {
            line.SetQuantity(line.Quantity + quantity);
            return line;
        }

        line = new ProjectEquipment(Guid.CreateVersion7(), Id, equipmentId, quantity, Equipment.Count + 1);
        Equipment.Add(line);
        return line;
    }

    public void UpdateEquipment(Guid lineId, int quantity, string? notes)
    {
        EnsureEditable();
        EnsurePositive(quantity);
        var line = Equipment.FirstOrDefault(e => e.Id == lineId) ?? throw new EntityNotFoundException(typeof(ProjectEquipment), lineId);
        line.SetQuantity(quantity);
        line.SetNotes(notes);
    }

    public void RemoveEquipment(Guid lineId)
    {
        EnsureEditable();
        var line = Equipment.FirstOrDefault(e => e.Id == lineId) ?? throw new EntityNotFoundException(typeof(ProjectEquipment), lineId);
        Equipment.Remove(line);
    }

    public int GetPlannedQuantity(Guid equipmentId) =>
        Equipment.Where(e => e.EquipmentId == equipmentId).Sum(e => e.Quantity);

    internal void SetStatus(ProjectStatus status) => Status = status;

    private void EnsureEditable()
    {
        if (!IsEditable)
        {
            throw new BusinessException(StageTrackErrorCodes.ProjectNotEditable).WithData("status", Status);
        }
    }

    private static void EnsurePositive(int quantity)
    {
        if (quantity <= 0)
        {
            throw new BusinessException(StageTrackErrorCodes.ProjectQuantityMustBePositive);
        }
    }
}

public class ProjectEquipment : Entity
{
    public Guid ProjectId { get; private set; }
    public Guid EquipmentId { get; private set; }
    public int Quantity { get; private set; }
    public string? Notes { get; private set; }
    public int SortOrder { get; private set; }

    private ProjectEquipment()
    {
    }

    internal ProjectEquipment(Guid id, Guid projectId, Guid equipmentId, int quantity, int sortOrder) : base(id)
    {
        ProjectId = projectId;
        EquipmentId = equipmentId;
        Quantity = quantity;
        SortOrder = sortOrder;
    }

    internal void SetQuantity(int quantity) => Quantity = quantity;

    internal void SetNotes(string? notes) => Notes = notes;
}
