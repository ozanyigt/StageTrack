using StageTrack.Entities;

namespace StageTrack.Identity;

public class AppUser : AggregateRoot, IAuditedObject
{
    public string UserName { get; private set; } = null!;
    public string NormalizedUserName { get; private set; } = null!;
    public string FullName { get; private set; } = null!;
    public string? Email { get; private set; }

    /// <summary>Shown in the crew directory so colleagues can reach each other.</summary>
    public string? Phone { get; private set; }

    /// <summary>Job title, e.g. "Ses teknisyeni", "Depo sorumlusu".</summary>
    public string? JobTitle { get; private set; }
    public string PasswordHash { get; private set; } = null!;
    public bool IsActive { get; private set; } = true;

    /// <summary>UI language preference: tr, en or ar.</summary>
    public string Language { get; private set; } = "tr";

    public DateTime CreationTime { get; set; }
    public Guid? CreatorId { get; set; }
    public DateTime? LastModificationTime { get; set; }
    public Guid? LastModifierId { get; set; }

    public ICollection<UserRole> Roles { get; private set; } = new List<UserRole>();
    public ICollection<UserCompany> Companies { get; private set; } = new List<UserCompany>();

    private AppUser()
    {
    }

    internal AppUser(Guid id, string userName, string fullName, string? email, string language) : base(id)
    {
        UserName = userName;
        NormalizedUserName = Normalize(userName);
        FullName = fullName;
        Email = email;
        Language = language;
    }

    public static string Normalize(string userName) => userName.Trim().ToUpperInvariant();

    internal void SetPasswordHash(string hash) => PasswordHash = hash;

    public void SetLanguage(string language) => Language = language;

    public void Update(string fullName, string? email, string? phone, string? jobTitle)
    {
        FullName = fullName;
        Email = email;
        Phone = phone;
        JobTitle = jobTitle;
    }

    internal void SetActive(bool isActive) => IsActive = isActive;

    public void AddRole(Guid roleId)
    {
        if (Roles.All(r => r.RoleId != roleId))
        {
            Roles.Add(new UserRole(Id, roleId));
        }
    }

    public void AddCompany(Guid companyId)
    {
        if (Companies.All(c => c.CompanyId != companyId))
        {
            Companies.Add(new UserCompany(Id, companyId));
        }
    }

    /// <summary>Replaces the roles; join rows that stay are not touched (EF would otherwise delete and re-insert the same key).</summary>
    internal void SetRoles(IReadOnlyCollection<Guid> roleIds)
    {
        foreach (var removed in Roles.Where(r => !roleIds.Contains(r.RoleId)).ToList())
        {
            Roles.Remove(removed);
        }

        foreach (var roleId in roleIds)
        {
            AddRole(roleId);
        }
    }

    /// <summary>
    /// Replaces the user's access only within <paramref name="manageable"/> companies, so an admin who works
    /// in Turkey cannot accidentally take away (or see) the user's access to a company the admin does not manage.
    /// </summary>
    internal void SetCompanies(IReadOnlyCollection<Guid> companyIds, IReadOnlyCollection<Guid> manageable)
    {
        foreach (var removed in Companies.Where(c => manageable.Contains(c.CompanyId) && !companyIds.Contains(c.CompanyId)).ToList())
        {
            Companies.Remove(removed);
        }

        foreach (var companyId in companyIds.Where(manageable.Contains))
        {
            AddCompany(companyId);
        }
    }

    public bool HasCompany(Guid companyId) => Companies.Any(c => c.CompanyId == companyId);
}

public class UserRole
{
    public Guid UserId { get; private set; }
    public Guid RoleId { get; private set; }

    private UserRole()
    {
    }

    public UserRole(Guid userId, Guid roleId)
    {
        UserId = userId;
        RoleId = roleId;
    }
}

public class UserCompany
{
    public Guid UserId { get; private set; }
    public Guid CompanyId { get; private set; }

    private UserCompany()
    {
    }

    public UserCompany(Guid userId, Guid companyId)
    {
        UserId = userId;
        CompanyId = companyId;
    }
}
