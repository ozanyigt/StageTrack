using StageTrack.Account;
using StageTrack.Companies;
using StageTrack.Customers;
using StageTrack.Inventory;
using StageTrack.Pricing;
using StageTrack.Projects;
using StageTrack.Quotes;
using StageTrack.Warehouse;

namespace StageTrack;

/// <summary>Entity → DTO mapping. Kept explicit so every exposed field is a conscious decision.</summary>
internal static class ObjectMapping
{
    public static CompanyDto ToDto(this Company c) => new()
    {
        Id = c.Id, Name = c.Name, Code = c.Code, DefaultCurrency = c.DefaultCurrency,
        DefaultVatRate = c.DefaultVatRate, CountryCode = c.CountryCode
    };

    public static EquipmentFolderDto ToDto(this EquipmentFolder f) => new()
    {
        Id = f.Id, Name = f.Name, ParentId = f.ParentId, SortOrder = f.SortOrder
    };

    public static T FillEquipment<T>(this T dto, Equipment e, int stock) where T : EquipmentDto
    {
        dto.Id = e.Id;
        dto.Code = e.Code;
        dto.Name = e.Name;
        dto.Brand = e.Brand;
        dto.Model = e.Model;
        dto.FolderId = e.FolderId;
        dto.Type = e.Type;
        dto.IsSerialized = e.IsSerialized;
        dto.Stock = stock;
        dto.RentalPrice = e.RentalPrice;
        dto.WeightKg = e.WeightKg;
        dto.VolumeM3 = e.VolumeM3;
        dto.Notes = e.Notes;
        dto.IsArchived = e.IsArchived;
        return dto;
    }

    public static EquipmentDto ToDto(this Equipment e, int stock) => new EquipmentDto().FillEquipment(e, stock);

    public static EquipmentLookupDto ToLookupDto(this Equipment e) => new()
    {
        Id = e.Id, Code = e.Code, Name = e.Name, IsSerialized = e.IsSerialized, RentalPrice = e.RentalPrice
    };

    public static EquipmentUnitDto ToDto(this EquipmentUnitListItem x) => new()
    {
        Id = x.Unit.Id,
        EquipmentId = x.Unit.EquipmentId,
        EquipmentCode = x.EquipmentCode,
        EquipmentName = x.EquipmentName,
        InternalRef = x.Unit.InternalRef,
        SerialNumber = x.Unit.SerialNumber,
        StockLocationId = x.Unit.StockLocationId,
        StockLocationName = x.StockLocationName,
        Status = x.Unit.Status,
        CurrentProjectId = x.Unit.CurrentProjectId,
        CurrentProjectNumber = x.CurrentProjectNumber,
        CurrentProjectName = x.CurrentProjectName,
        Notes = x.Unit.Notes,
        LabelCount = x.LabelCount
    };

    public static EquipmentUnitDto ToDto(this EquipmentUnit u, Equipment e) => new()
    {
        Id = u.Id,
        EquipmentId = u.EquipmentId,
        EquipmentCode = e.Code,
        EquipmentName = e.Name,
        InternalRef = u.InternalRef,
        SerialNumber = u.SerialNumber,
        StockLocationId = u.StockLocationId,
        Status = u.Status,
        CurrentProjectId = u.CurrentProjectId,
        Notes = u.Notes
    };

    public static LabelDto ToDto(this EquipmentLabel l) => new()
    {
        Id = l.Id, Code = l.Code, RawValue = l.RawValue, Type = l.Type, EquipmentId = l.EquipmentId,
        UnitId = l.UnitId, CreationTime = l.CreationTime
    };

    public static StockLocationDto ToDto(this StockLocation l) => new()
    {
        Id = l.Id, Name = l.Name, Type = l.Type, Address = l.Address, City = l.City, IsActive = l.IsActive
    };

    public static CustomerDto ToDto(this Customer c) => new()
    {
        Id = c.Id, Name = c.Name, TaxNumber = c.TaxNumber, TaxOffice = c.TaxOffice, ContactPerson = c.ContactPerson,
        Email = c.Email, Phone = c.Phone, Address = c.Address, City = c.City, Country = c.Country, Notes = c.Notes
    };

    public static T FillProject<T>(this T dto, Project p, string? customerName, string? locationName, int plannedQuantity)
        where T : ProjectListItemDto
    {
        dto.Id = p.Id;
        dto.Number = p.Number;
        dto.Name = p.Name;
        dto.CustomerId = p.CustomerId;
        dto.CustomerName = customerName;
        dto.Venue = p.Venue;
        dto.PlanStart = p.PlanStart;
        dto.PlanEnd = p.PlanEnd;
        dto.UseStart = p.UseStart;
        dto.UseEnd = p.UseEnd;
        dto.Status = p.Status;
        dto.Color = p.Color;
        dto.ProjectType = p.ProjectType;
        dto.StockLocationId = p.StockLocationId;
        dto.StockLocationName = locationName;
        dto.PlannedQuantity = plannedQuantity;
        return dto;
    }

    public static ProjectListItemDto ToDto(this ProjectListItem x) =>
        new ProjectListItemDto().FillProject(x.Project, x.CustomerName, x.StockLocationName, x.PlannedQuantity);

    public static MovementDto ToDto(this MovementListItem x) => new()
    {
        Id = x.Movement.Id,
        CreationTime = x.Movement.CreationTime,
        Action = x.Movement.Action,
        EquipmentId = x.Movement.EquipmentId,
        EquipmentCode = x.EquipmentCode,
        EquipmentName = x.EquipmentName,
        UnitId = x.Movement.UnitId,
        UnitInternalRef = x.UnitInternalRef,
        UnitSerialNumber = x.UnitSerialNumber,
        ProjectId = x.Movement.ProjectId,
        ProjectNumber = x.ProjectNumber,
        ProjectName = x.ProjectName,
        UserFullName = x.UserFullName,
        LabelCode = x.Movement.LabelCode,
        Quantity = x.Movement.Quantity
    };

    public static ScanResultDto ToDto(this ScanOutcome o) => new()
    {
        Direction = o.Direction,
        LabelCode = o.LabelCode,
        EquipmentId = o.Equipment.Id,
        EquipmentCode = o.Equipment.Code,
        EquipmentName = o.Equipment.Name,
        UnitId = o.Unit?.Id,
        UnitInternalRef = o.Unit?.InternalRef,
        UnitSerialNumber = o.Unit?.SerialNumber,
        PlannedQuantity = o.PlannedQuantity,
        OutQuantity = o.OutQuantity,
        AlreadyScanned = o.AlreadyScanned,
        Warnings = o.Warnings
    };

    public static RentalFactorProfileDto ToDto(this RentalFactorProfile p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        IsDefault = p.IsDefault,
        ExtraDayFactor = p.ExtraDayFactor,
        Steps = p.Steps.OrderBy(s => s.Days).Select(s => new RentalFactorStepDto { Days = s.Days, Factor = s.Factor }).ToList()
    };

    public static T FillQuote<T>(this T dto, Quote q, int projectNumber, string projectName, string? customerName)
        where T : QuoteListItemDto
    {
        dto.Id = q.Id;
        dto.Number = q.Number;
        dto.Revision = q.Revision;
        dto.Status = q.Status;
        dto.IssueDate = q.IssueDate;
        dto.ValidUntil = q.ValidUntil;
        dto.Currency = q.Currency;
        dto.GrandTotal = q.GrandTotal;
        dto.ProjectId = q.ProjectId;
        dto.ProjectNumber = projectNumber;
        dto.ProjectName = projectName;
        dto.CustomerName = customerName;
        return dto;
    }

    public static QuoteListItemDto ToDto(this QuoteListItem x) =>
        new QuoteListItemDto().FillQuote(x.Quote, x.ProjectNumber, x.ProjectName, x.CustomerName);
}
