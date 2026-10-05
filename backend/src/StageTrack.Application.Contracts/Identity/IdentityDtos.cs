using System.ComponentModel.DataAnnotations;
using StageTrack.Dtos;

namespace StageTrack.Identity;

public class PermissionDefinitionDto
{
    public string Name { get; set; } = null!;
    public string? Parent { get; set; }
}

public class PermissionGroupDto
{
    public string Name { get; set; } = null!;
    public List<PermissionDefinitionDto> Permissions { get; set; } = [];
}

public class RoleDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public bool IsStatic { get; set; }
    public int UserCount { get; set; }
    public List<string> Permissions { get; set; } = [];
}

public class CreateUpdateRoleDto
{
    [Required, StringLength(64, MinimumLength = 2)]
    public string Name { get; set; } = null!;
}

public class UpdateRolePermissionsDto
{
    [Required]
    public List<string> Permissions { get; set; } = [];
}

public class UserDto
{
    public Guid Id { get; set; }
    public string UserName { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? JobTitle { get; set; }
    public bool IsActive { get; set; }
    public string Language { get; set; } = null!;
    public DateTime CreationTime { get; set; }
    public List<Guid> RoleIds { get; set; } = [];
    public List<Guid> CompanyIds { get; set; } = [];
}

public class GetUserListInput : PagedRequestDto
{
    public string? Text { get; set; }
}

public class CreateUserDto
{
    [Required, StringLength(64, MinimumLength = 3), RegularExpression("^[A-Za-z0-9._@-]+$")]
    public string UserName { get; set; } = null!;

    [Required, StringLength(128)]
    public string FullName { get; set; } = null!;

    [EmailAddress, StringLength(256)]
    public string? Email { get; set; }

    [StringLength(32)]
    public string? Phone { get; set; }

    [StringLength(128)]
    public string? JobTitle { get; set; }

    [Required, StringLength(128)]
    public string Password { get; set; } = null!;

    [RegularExpression("^(tr|en|ar)$")]
    public string Language { get; set; } = "tr";

    public List<Guid> RoleIds { get; set; } = [];
    public List<Guid> CompanyIds { get; set; } = [];
}

public class UpdateUserDto
{
    [Required, StringLength(128)]
    public string FullName { get; set; } = null!;

    [EmailAddress, StringLength(256)]
    public string? Email { get; set; }

    [StringLength(32)]
    public string? Phone { get; set; }

    [StringLength(128)]
    public string? JobTitle { get; set; }

    public List<Guid> RoleIds { get; set; } = [];
    public List<Guid> CompanyIds { get; set; } = [];
}

public class SetUserActiveDto
{
    public bool IsActive { get; set; }
}

public class ResetPasswordDto
{
    [Required, StringLength(128)]
    public string NewPassword { get; set; } = null!;
}

public interface IRoleAppService
{
    Task<List<PermissionGroupDto>> GetPermissionDefinitionsAsync();

    Task<List<RoleDto>> GetListAsync();

    Task<RoleDto> CreateAsync(CreateUpdateRoleDto input);

    Task<RoleDto> UpdateAsync(Guid id, CreateUpdateRoleDto input);

    Task<RoleDto> UpdatePermissionsAsync(Guid id, UpdateRolePermissionsDto input);

    Task DeleteAsync(Guid id);
}

public interface IUserAppService
{
    Task<PagedResultDto<UserDto>> GetListAsync(GetUserListInput input);

    Task<UserDto> CreateAsync(CreateUserDto input);

    Task<UserDto> UpdateAsync(Guid id, UpdateUserDto input);

    Task SetActiveAsync(Guid id, SetUserActiveDto input);

    Task ResetPasswordAsync(Guid id, ResetPasswordDto input);
}
