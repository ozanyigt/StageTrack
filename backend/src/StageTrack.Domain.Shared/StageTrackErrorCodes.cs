namespace StageTrack;

/// <summary>
/// Error codes thrown by the domain. Every code has a translation in
/// Localization/Resources/*.json (backend) and in the frontend locale files under "errors".
/// </summary>
public static class StageTrackErrorCodes
{
    public const string EntityNotFound = "Common.EntityNotFound";
    public const string Validation = "Common.Validation";
    public const string Unauthorized = "Common.Unauthorized";
    public const string Forbidden = "Common.Forbidden";
    public const string Unexpected = "Common.Unexpected";

    public const string InvalidCredentials = "Account.InvalidCredentials";
    public const string UserInactive = "Account.UserInactive";
    public const string CompanyAccessDenied = "Account.CompanyAccessDenied";

    public const string RoleNameAlreadyExists = "Role.NameAlreadyExists";
    public const string RoleStaticCannotBeChanged = "Role.StaticCannotBeChanged";
    public const string RoleInUse = "Role.InUse";
    public const string PermissionUnknown = "Permission.Unknown";
    public const string PermissionParentRequired = "Permission.ParentRequired";

    public const string UserNameAlreadyExists = "User.UserNameAlreadyExists";
    public const string UserPasswordTooWeak = "User.PasswordTooWeak";
    public const string UserCannotDeactivateSelf = "User.CannotDeactivateSelf";
    public const string UserCompanyRequired = "User.CompanyRequired";
    public const string UserRoleRequired = "User.RoleRequired";

    public const string ImpersonationNotAllowed = "Impersonation.NotAllowed";
    public const string ImpersonationNotActive = "Impersonation.NotActive";

    public const string EquipmentCodeAlreadyExists = "Equipment.CodeAlreadyExists";
    public const string EquipmentHasUnits = "Equipment.HasUnits";
    public const string EquipmentNotSerialized = "Equipment.NotSerialized";
    public const string EquipmentPlannedOnProjects = "Equipment.PlannedOnProjects";
    public const string FolderHasChildren = "Folder.HasChildren";
    public const string FolderHasEquipment = "Folder.HasEquipment";
    public const string FolderCycle = "Folder.Cycle";
    public const string UnitInternalRefAlreadyExists = "Unit.InternalRefAlreadyExists";
    public const string UnitNotInStock = "Unit.NotInStock";
    public const string StockLocationInUse = "StockLocation.InUse";

    public const string LabelEmpty = "Label.Empty";
    public const string LabelAlreadyAssigned = "Label.AlreadyAssigned";
    public const string LabelNotFound = "Label.NotFound";
    public const string LabelTargetRequired = "Label.TargetRequired";
    public const string LabelOtherCompany = "Label.OtherCompany";
    public const string LabelUnknownWorkspace = "Label.UnknownWorkspace";

    public const string CustomerTaxNumberAlreadyExists = "Customer.TaxNumberAlreadyExists";
    public const string CustomerHasProjects = "Customer.HasProjects";

    public const string ProjectInvalidDateRange = "Project.InvalidDateRange";
    public const string ProjectInvalidStatusTransition = "Project.InvalidStatusTransition";
    public const string ProjectQuantityMustBePositive = "Project.QuantityMustBePositive";
    public const string ProjectNotEditable = "Project.NotEditable";
    public const string ProjectHasEquipmentOut = "Project.HasEquipmentOut";
    public const string ProjectCannotDelete = "Project.CannotDelete";

    public const string WarehouseProjectNotScannable = "Warehouse.ProjectNotScannable";
    public const string WarehouseUnitOnAnotherProject = "Warehouse.UnitOnAnotherProject";
    public const string WarehouseUnitNotAvailable = "Warehouse.UnitNotAvailable";
    public const string WarehouseUnitNotOnThisProject = "Warehouse.UnitNotOnThisProject";
    public const string WarehouseNothingToReturn = "Warehouse.NothingToReturn";
    public const string WarehouseSerializedNeedsUnitLabel = "Warehouse.SerializedNeedsUnitLabel";

    public const string RentalFactorDuplicateDays = "RentalFactor.DuplicateDays";
    public const string RentalFactorInvalidDays = "RentalFactor.InvalidDays";
    public const string RentalFactorInvalidFactor = "RentalFactor.InvalidFactor";
    public const string RentalFactorStepsRequired = "RentalFactor.StepsRequired";
    public const string RentalFactorFirstStepMustBeOneDay = "RentalFactor.FirstStepMustBeOneDay";
    public const string RentalFactorCannotDeleteDefault = "RentalFactor.CannotDeleteDefault";

    public const string QuoteNotEditable = "Quote.NotEditable";
    public const string QuoteProjectHasNoDates = "Quote.ProjectHasNoDates";
    public const string QuoteInvalidDiscount = "Quote.InvalidDiscount";
    public const string QuoteInvalidVatRate = "Quote.InvalidVatRate";
    public const string QuoteLineNotFound = "Quote.LineNotFound";
    public const string QuoteInvalidStatusTransition = "Quote.InvalidStatusTransition";
    public const string QuoteHasNoLines = "Quote.HasNoLines";

    public const string RelationSelf = "Relation.Self";
    public const string RelationDuplicate = "Relation.Duplicate";
    public const string SupplierNameAlreadyExists = "Supplier.NameAlreadyExists";
    public const string SupplierInUse = "Supplier.InUse";
    public const string SupplierDuplicate = "Supplier.Duplicate";
    public const string RepairInvalidStatusTransition = "Repair.InvalidStatusTransition";
    public const string RepairUnitRequired = "Repair.UnitRequired";
    public const string InspectionNotConfigured = "Inspection.NotConfigured";
    public const string SectionTooDeep = "Section.TooDeep";
    public const string SectionNotFound = "Section.NotFound";
    public const string CrewAlreadyAssigned = "Crew.AlreadyAssigned";
    public const string CrewUserNotInCompany = "Crew.UserNotInCompany";
    public const string TransferSameCompany = "Transfer.SameCompany";
    public const string TransferNoWarehouse = "Transfer.NoWarehouse";
    public const string TransferLabelConflict = "Transfer.LabelConflict";
    public const string AttachmentTooLarge = "Attachment.TooLarge";
    public const string AttachmentNotImage = "Attachment.NotImage";
    public const string LabelTemplateInvalidSize = "LabelTemplate.InvalidSize";
    public const string ImportInvalidRow = "Import.InvalidRow";
    public const string QuoteCannotDelete = "Quote.CannotDelete";
    public const string QuoteLineDescriptionRequired = "Quote.LineDescriptionRequired";
}
