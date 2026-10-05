using StageTrack.Account;
using StageTrack.Companies;
using StageTrack.Customers;
using StageTrack.Inventory;
using StageTrack.Maintenance;
using StageTrack.Pricing;
using StageTrack.Projects;
using StageTrack.Quotes;
using StageTrack.Suppliers;
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

    /// <param name="showPrice">False hides the rental price (users without the price permission).</param>
    public static T FillEquipment<T>(this T dto, Equipment e, int stock, bool showPrice = true) where T : EquipmentDto
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
        dto.RentalPrice = showPrice ? e.RentalPrice : null;
        dto.WeightKg = e.WeightKg;
        dto.VolumeM3 = e.VolumeM3;
        dto.Notes = e.Notes;
        dto.IsArchived = e.IsArchived;
        return dto;
    }

    public static EquipmentDto ToDto(this Equipment e, int stock, bool showPrice = true) => new EquipmentDto().FillEquipment(e, stock, showPrice);

    public static EquipmentLookupDto ToLookupDto(this Equipment e, bool showPrice) => new()
    {
        Id = e.Id, Code = e.Code, Name = e.Name, IsSerialized = e.IsSerialized, RentalPrice = showPrice ? e.RentalPrice : null
    };

    public static T FillUnit<T>(this T dto, EquipmentUnit u, int? inspectionIntervalMonths = null) where T : EquipmentUnitDto
    {
        dto.Id = u.Id;
        dto.EquipmentId = u.EquipmentId;
        dto.InternalRef = u.InternalRef;
        dto.SerialNumber = u.SerialNumber;
        dto.StockLocationId = u.StockLocationId;
        dto.Status = u.Status;
        dto.CurrentProjectId = u.CurrentProjectId;
        dto.Notes = u.Notes;
        dto.IsArchived = u.IsArchived;
        dto.PurchaseDate = u.PurchaseDate;
        dto.WarrantyDate = u.WarrantyDate;
        dto.ReplacementDate = u.ReplacementDate;
        dto.SupplierId = u.SupplierId;
        dto.LastInspectionDate = u.LastInspectionDate;
        dto.NextInspectionDate = u.GetNextInspectionDate(inspectionIntervalMonths);
        dto.ImageAttachmentId = u.ImageAttachmentId;
        return dto;
    }

    public static T FillUnit<T>(this T dto, EquipmentUnitListItem x) where T : EquipmentUnitDto
    {
        dto.FillUnit(x.Unit, x.InspectionIntervalMonths);
        dto.EquipmentCode = x.EquipmentCode;
        dto.EquipmentName = x.EquipmentName;
        dto.StockLocationName = x.StockLocationName;
        dto.CurrentProjectNumber = x.CurrentProjectNumber;
        dto.CurrentProjectName = x.CurrentProjectName;
        dto.LabelCount = x.LabelCount;
        dto.SupplierName = x.SupplierName;
        return dto;
    }

    public static EquipmentUnitDto ToDto(this EquipmentUnitListItem x) => new EquipmentUnitDto().FillUnit(x);

    public static EquipmentUnitDto ToDto(this EquipmentUnit u, Equipment e)
    {
        var dto = new EquipmentUnitDto().FillUnit(u, e.InspectionIntervalMonths);
        dto.EquipmentCode = e.Code;
        dto.EquipmentName = e.Name;
        return dto;
    }

    public static LabelTemplateDto ToDto(this LabelTemplate t) => new()
    {
        Id = t.Id, Name = t.Name, WidthMm = t.WidthMm, HeightMm = t.HeightMm, QrSizeMm = t.QrSizeMm, FontSizePt = t.FontSizePt,
        ShowName = t.ShowName, ShowBrand = t.ShowBrand, ShowModel = t.ShowModel, ShowCode = t.ShowCode,
        ShowInternalRef = t.ShowInternalRef, ShowSerialNumber = t.ShowSerialNumber, ShowCompanyName = t.ShowCompanyName,
        IsDefault = t.IsDefault
    };

    public static SupplierDto ToDto(this Supplier s) => new()
    {
        Id = s.Id, Name = s.Name, ContactPerson = s.ContactPerson, Email = s.Email, Phone = s.Phone, TaxNumber = s.TaxNumber,
        TaxOffice = s.TaxOffice, Address = s.Address, City = s.City, Country = s.Country, Website = s.Website, Notes = s.Notes
    };

    public static RepairDto ToDto(this RepairListItem x) => new()
    {
        Id = x.Repair.Id,
        Number = x.Repair.Number,
        EquipmentId = x.Repair.EquipmentId,
        EquipmentCode = x.EquipmentCode,
        EquipmentName = x.EquipmentName,
        UnitId = x.Repair.UnitId,
        UnitInternalRef = x.UnitInternalRef,
        Quantity = x.Repair.Quantity,
        Title = x.Repair.Title,
        Description = x.Repair.Description,
        Status = x.Repair.Status,
        ReportedAt = x.Repair.ReportedAt,
        CompletedAt = x.Repair.CompletedAt,
        SupplierId = x.Repair.SupplierId,
        SupplierName = x.SupplierName,
        Cost = x.Repair.Cost,
        AllowedStatuses = RepairManager.GetAllowedTargets(x.Repair.Status).ToList()
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
        Quantity = x.Movement.Quantity,
        Note = x.Movement.Note
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
        dto.RejectionReason = q.RejectionReason;
        return dto;
    }

    public static QuoteListItemDto ToDto(this QuoteListItem x) =>
        new QuoteListItemDto().FillQuote(x.Quote, x.ProjectNumber, x.ProjectName, x.CustomerName);
}
