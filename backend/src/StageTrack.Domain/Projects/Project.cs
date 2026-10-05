using StageTrack.Entities;

namespace StageTrack.Projects;

/// <summary>
/// A job (concert, congress, fixed installation...). The planning period covers prep and
/// return; the usage period is the event itself and drives rental days on quotes.
/// </summary>
public class Project : CompanyAggregateRoot
{
    /// <summary>Sections can be nested once: "Ses" › "Hoparlör", "Ana sahne" › "Işık".</summary>
    public const int MaxSectionDepth = 2;

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

    /// <summary>Project lead (Rentman "Proje sorumlusu"), printed on the packing slip and quote.</summary>
    public Guid? AccountManagerId { get; private set; }

    /// <summary>Payment terms printed on documents, e.g. "İş sonrası faturalandırılacaktır".</summary>
    public string? PaymentTerms { get; private set; }

    public ICollection<ProjectEquipment> Equipment { get; private set; } = new List<ProjectEquipment>();
    public ICollection<ProjectSection> Sections { get; private set; } = new List<ProjectSection>();
    public ICollection<ProjectCrewMember> Crew { get; private set; } = new List<ProjectCrewMember>();

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

    public void SetDocumentInfo(Guid? accountManagerId, string? paymentTerms)
    {
        AccountManagerId = accountManagerId;
        PaymentTerms = paymentTerms;
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

    // ---- Sections -------------------------------------------------------------------------------------------

    public ProjectSection AddSection(string name, Guid? parentId)
    {
        EnsureEditable();
        if (parentId.HasValue)
        {
            var parent = GetSection(parentId.Value);
            if (GetDepth(parent) >= MaxSectionDepth)
            {
                throw new BusinessException(StageTrackErrorCodes.SectionTooDeep).WithData("max", MaxSectionDepth);
            }
        }

        var section = new ProjectSection(Guid.CreateVersion7(), Id, parentId, name.Trim(),
            Sections.Count(s => s.ParentId == parentId) + 1);
        Sections.Add(section);
        return section;
    }

    public void RenameSection(Guid sectionId, string name)
    {
        EnsureEditable();
        GetSection(sectionId).Rename(name.Trim());
    }

    /// <summary>Removes the section; its lines and sub-sections move up to the parent (or to "no section").</summary>
    public void RemoveSection(Guid sectionId)
    {
        EnsureEditable();
        var section = GetSection(sectionId);
        foreach (var line in Equipment.Where(e => e.SectionId == sectionId))
        {
            line.SetSection(section.ParentId, NextLineOrder(section.ParentId));
        }

        foreach (var child in Sections.Where(s => s.ParentId == sectionId))
        {
            child.SetParent(section.ParentId, Sections.Count(s => s.ParentId == section.ParentId) + 1);
        }

        Sections.Remove(section);
        Renumber(Sections.Where(s => s.ParentId == section.ParentId).OrderBy(s => s.SortOrder).ToList());
    }

    public void MoveSection(Guid sectionId, int direction)
    {
        EnsureEditable();
        var section = GetSection(sectionId);
        var siblings = Sections.Where(s => s.ParentId == section.ParentId).OrderBy(s => s.SortOrder).ToList();
        Swap(siblings, siblings.IndexOf(section), direction, (s, order) => s.SetSortOrder(order));
    }

    /// <summary>Sections in reading order (parent, then its children), with their depth and full path.</summary>
    public IReadOnlyList<(ProjectSection Section, int Depth, string Path)> GetSectionOutline()
    {
        var result = new List<(ProjectSection, int, string)>();

        void Walk(Guid? parentId, int depth, string prefix)
        {
            foreach (var section in Sections.Where(s => s.ParentId == parentId).OrderBy(s => s.SortOrder))
            {
                var path = prefix.Length == 0 ? section.Name : $"{prefix} / {section.Name}";
                result.Add((section, depth, path));
                Walk(section.Id, depth + 1, path);
            }
        }

        Walk(null, 1, string.Empty);
        return result;
    }

    // ---- Equipment lines ------------------------------------------------------------------------------------

    /// <summary>Adds the equipment to a section or, when it is already planned in that section, adds to its quantity.</summary>
    internal ProjectEquipment AddEquipment(Guid equipmentId, int quantity, Guid? sectionId)
    {
        EnsureEditable();
        EnsurePositive(quantity);
        if (sectionId.HasValue)
        {
            GetSection(sectionId.Value);
        }

        var line = Equipment.FirstOrDefault(e => e.EquipmentId == equipmentId && e.SectionId == sectionId);
        if (line is not null)
        {
            line.SetQuantity(line.Quantity + quantity);
            return line;
        }

        line = new ProjectEquipment(Guid.CreateVersion7(), Id, equipmentId, quantity, NextLineOrder(sectionId));
        line.SetSection(sectionId, line.SortOrder);
        Equipment.Add(line);
        return line;
    }

    public void UpdateEquipment(Guid lineId, int quantity, string? notes)
    {
        EnsureEditable();
        EnsurePositive(quantity);
        var line = GetLine(lineId);
        line.SetQuantity(quantity);
        line.SetNotes(notes);
    }

    public void MoveEquipmentToSection(Guid lineId, Guid? sectionId)
    {
        EnsureEditable();
        if (sectionId.HasValue)
        {
            GetSection(sectionId.Value);
        }

        var line = GetLine(lineId);
        if (line.SectionId != sectionId)
        {
            line.SetSection(sectionId, NextLineOrder(sectionId));
        }
    }

    public void MoveEquipment(Guid lineId, int direction)
    {
        EnsureEditable();
        var line = GetLine(lineId);
        var siblings = Equipment.Where(e => e.SectionId == line.SectionId).OrderBy(e => e.SortOrder).ToList();
        Swap(siblings, siblings.IndexOf(line), direction, (l, order) => l.SetSortOrder(order));
    }

    public void RemoveEquipment(Guid lineId)
    {
        EnsureEditable();
        Equipment.Remove(GetLine(lineId));
    }

    public int GetPlannedQuantity(Guid equipmentId) =>
        Equipment.Where(e => e.EquipmentId == equipmentId).Sum(e => e.Quantity);

    // ---- Crew -----------------------------------------------------------------------------------------------

    internal ProjectCrewMember AddCrew(Guid userId, string? function)
    {
        if (Crew.Any(c => c.UserId == userId))
        {
            throw new BusinessException(StageTrackErrorCodes.CrewAlreadyAssigned);
        }

        var member = new ProjectCrewMember(Guid.CreateVersion7(), Id, userId, function);
        Crew.Add(member);
        return member;
    }

    public void UpdateCrew(Guid crewId, string? function) => GetCrew(crewId).SetFunction(function);

    public void RemoveCrew(Guid crewId) => Crew.Remove(GetCrew(crewId));

    public bool HasCrewMember(Guid userId) => Crew.Any(c => c.UserId == userId);

    internal void SetStatus(ProjectStatus status) => Status = status;

    private int NextLineOrder(Guid? sectionId) =>
        Equipment.Where(e => e.SectionId == sectionId).Select(e => e.SortOrder).DefaultIfEmpty(0).Max() + 1;

    private int GetDepth(ProjectSection section)
    {
        var depth = 1;
        for (var parent = section.ParentId; parent.HasValue; parent = Sections.First(s => s.Id == parent).ParentId)
        {
            depth++;
        }

        return depth;
    }

    private static void Swap<T>(List<T> ordered, int index, int direction, Action<T, int> setOrder)
    {
        var other = index + Math.Sign(direction);
        if (index < 0 || other < 0 || other >= ordered.Count)
        {
            return;
        }

        (ordered[index], ordered[other]) = (ordered[other], ordered[index]);
        for (var i = 0; i < ordered.Count; i++)
        {
            setOrder(ordered[i], i + 1);
        }
    }

    private static void Renumber(List<ProjectSection> ordered)
    {
        for (var i = 0; i < ordered.Count; i++)
        {
            ordered[i].SetSortOrder(i + 1);
        }
    }

    private ProjectSection GetSection(Guid sectionId) =>
        Sections.FirstOrDefault(s => s.Id == sectionId) ?? throw new BusinessException(StageTrackErrorCodes.SectionNotFound);

    private ProjectEquipment GetLine(Guid lineId) =>
        Equipment.FirstOrDefault(e => e.Id == lineId) ?? throw new EntityNotFoundException(typeof(ProjectEquipment), lineId);

    private ProjectCrewMember GetCrew(Guid crewId) =>
        Crew.FirstOrDefault(c => c.Id == crewId) ?? throw new EntityNotFoundException(typeof(ProjectCrewMember), crewId);

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
    public Guid? SectionId { get; private set; }
    public int Quantity { get; private set; }

    /// <summary>Line remark printed under the item, e.g. "Ayaklı kurulacak".</summary>
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

    internal void SetSection(Guid? sectionId, int sortOrder)
    {
        SectionId = sectionId;
        SortOrder = sortOrder;
    }

    internal void SetSortOrder(int sortOrder) => SortOrder = sortOrder;
}

/// <summary>User-named group of equipment lines ("Ana sahne", "Koridor", "Ses › Hoparlör").</summary>
public class ProjectSection : Entity
{
    public Guid ProjectId { get; private set; }
    public Guid? ParentId { get; private set; }
    public string Name { get; private set; } = null!;
    public int SortOrder { get; private set; }

    private ProjectSection()
    {
    }

    internal ProjectSection(Guid id, Guid projectId, Guid? parentId, string name, int sortOrder) : base(id)
    {
        ProjectId = projectId;
        ParentId = parentId;
        Name = name;
        SortOrder = sortOrder;
    }

    internal void Rename(string name) => Name = name;

    internal void SetSortOrder(int sortOrder) => SortOrder = sortOrder;

    internal void SetParent(Guid? parentId, int sortOrder)
    {
        ParentId = parentId;
        SortOrder = sortOrder;
    }
}

/// <summary>A crew member (technician) assigned to the project; such users see the project and its material list.</summary>
public class ProjectCrewMember : Entity
{
    public Guid ProjectId { get; private set; }
    public Guid UserId { get; private set; }

    /// <summary>Role on this job, e.g. "Ses teknisyeni".</summary>
    public string? Function { get; private set; }

    private ProjectCrewMember()
    {
    }

    internal ProjectCrewMember(Guid id, Guid projectId, Guid userId, string? function) : base(id)
    {
        ProjectId = projectId;
        UserId = userId;
        Function = function;
    }

    internal void SetFunction(string? function) => Function = function;
}
