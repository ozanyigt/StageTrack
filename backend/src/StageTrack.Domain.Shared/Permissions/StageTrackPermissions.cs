namespace StageTrack.Permissions;

/// <summary>
/// Permission names. Controllers use them as authorization policy names and the
/// frontend hides menus/buttons with the same strings (see /api/account/me).
/// </summary>
public static class StageTrackPermissions
{
    public const string Prefix = "StageTrack";

    public static class Equipment
    {
        public const string Default = Prefix + ".Equipment";
        public const string Manage = Default + ".Manage";
        public const string Transfer = Default + ".Transfer";
    }

    public static class Labels
    {
        public const string Assign = Prefix + ".Labels.Assign";
    }

    public static class Maintenance
    {
        public const string Default = Prefix + ".Maintenance";
        public const string Manage = Default + ".Manage";
    }

    public static class Suppliers
    {
        public const string Default = Prefix + ".Suppliers";
        public const string Manage = Default + ".Manage";
    }

    public static class Customers
    {
        public const string Default = Prefix + ".Customers";
        public const string Manage = Default + ".Manage";
    }

    public static class Projects
    {
        public const string Default = Prefix + ".Projects";
        public const string Manage = Default + ".Manage";
        public const string ChangeStatus = Default + ".ChangeStatus";

        /// <summary>Crew members: only confirmed projects they are assigned to, without prices.</summary>
        public const string Assigned = Prefix + ".AssignedProjects";
    }

    public static class Warehouse
    {
        public const string Default = Prefix + ".Warehouse";
        public const string Scan = Default + ".Scan";
    }

    public static class Quotes
    {
        public const string Default = Prefix + ".Quotes";
        public const string Manage = Default + ".Manage";
    }

    /// <summary>Rental prices, line prices and totals. Without it every price field is hidden.</summary>
    public static class Prices
    {
        public const string View = Prefix + ".Prices";
    }

    public static class Settings
    {
        public const string RentalFactors = Prefix + ".Settings.RentalFactors";
        public const string StockLocations = Prefix + ".Settings.StockLocations";
        public const string LabelTemplates = Prefix + ".Settings.LabelTemplates";
    }

    public static class Identity
    {
        public const string Roles = Prefix + ".Identity.Roles";
        public const string Users = Prefix + ".Identity.Users";
        public const string Impersonate = Users + ".Impersonate";
    }

    /// <summary>
    /// The permission tree shown on the role screen (ABP's PermissionDefinitionProvider equivalent).
    /// A child can only be granted together with its parent, e.g. "manage" requires "view".
    /// Display names live in the frontend locale files under "permissions".
    /// </summary>
    public static readonly IReadOnlyList<PermissionGroupDefinition> Groups =
    [
        new("Equipment",
        [
            new(Equipment.Default),
            new(Equipment.Manage, Equipment.Default),
            new(Equipment.Transfer, Equipment.Manage),
            new(Labels.Assign, Equipment.Default)
        ]),
        new("Maintenance",
        [
            new(Maintenance.Default),
            new(Maintenance.Manage, Maintenance.Default)
        ]),
        new("Suppliers",
        [
            new(Suppliers.Default),
            new(Suppliers.Manage, Suppliers.Default)
        ]),
        new("Projects",
        [
            new(Projects.Default),
            new(Projects.Manage, Projects.Default),
            new(Projects.ChangeStatus, Projects.Default),
            new(Projects.Assigned)
        ]),
        new("Warehouse",
        [
            new(Warehouse.Default),
            new(Warehouse.Scan, Warehouse.Default)
        ]),
        new("Quotes",
        [
            new(Quotes.Default),
            new(Quotes.Manage, Quotes.Default),
            new(Prices.View)
        ]),
        new("Customers",
        [
            new(Customers.Default),
            new(Customers.Manage, Customers.Default)
        ]),
        new("Settings",
        [
            new(Settings.RentalFactors),
            new(Settings.StockLocations),
            new(Settings.LabelTemplates)
        ]),
        new("Identity",
        [
            new(Identity.Roles),
            new(Identity.Users),
            new(Identity.Impersonate, Identity.Users)
        ])
    ];

    public static IReadOnlyList<string> GetAll() => Groups.SelectMany(g => g.Permissions).Select(p => p.Name).ToList();

    public static PermissionDefinition? Find(string name) =>
        Groups.SelectMany(g => g.Permissions).FirstOrDefault(p => p.Name == name);
}

public record PermissionDefinition(string Name, string? Parent = null);

public record PermissionGroupDefinition(string Name, IReadOnlyList<PermissionDefinition> Permissions);
