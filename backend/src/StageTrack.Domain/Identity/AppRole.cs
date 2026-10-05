using StageTrack.Entities;

namespace StageTrack.Identity;

public class AppRole : AggregateRoot
{
    public const string AdminRoleName = "admin";

    /// <summary>Built-in keys (admin, warehouse, sales) are translated by the frontend; custom roles show the name as typed.</summary>
    public string Name { get; private set; } = null!;

    /// <summary>The customer firm the role belongs to; null for the platform administrator role.</summary>
    public Guid? TenantId { get; private set; }

    /// <summary>
    /// The built-in administrator role. It always holds every permission and can be neither edited nor
    /// deleted, so an administrator can never lock everybody out of role and user management.
    /// </summary>
    public bool IsStatic { get; private set; }

    public ICollection<RolePermission> Permissions { get; private set; } = new List<RolePermission>();

    private AppRole()
    {
    }

    internal AppRole(Guid id, string name, Guid? tenantId, bool isStatic = false) : base(id)
    {
        TenantId = tenantId;
        Name = name;
        IsStatic = isStatic;
    }

    internal void Rename(string name) => Name = name;

    public bool IsGranted(string permission) => IsStatic || Permissions.Any(p => p.Name == permission);

    /// <summary>Replaces the granted permissions; unchanged rows are kept so EF does not delete and re-insert them.</summary>
    internal void SetPermissions(IReadOnlyCollection<string> permissions)
    {
        foreach (var removed in Permissions.Where(p => !permissions.Contains(p.Name)).ToList())
        {
            Permissions.Remove(removed);
        }

        foreach (var added in permissions.Where(name => Permissions.All(p => p.Name != name)))
        {
            Permissions.Add(new RolePermission(Id, added));
        }
    }

    internal void Grant(string permission) => SetPermissions([.. Permissions.Select(p => p.Name), permission]);
}

public class RolePermission
{
    public Guid RoleId { get; private set; }
    public string Name { get; private set; } = null!;

    private RolePermission()
    {
    }

    public RolePermission(Guid roleId, string name)
    {
        RoleId = roleId;
        Name = name;
    }
}
