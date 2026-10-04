using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StageTrack.Dtos;
using StageTrack.Identity;
using StageTrack.Permissions;

namespace StageTrack.Controllers;

[ApiController]
[Route("api/identity/roles")]
[Authorize(StageTrackPermissions.Identity.Roles)]
public class RolesController(IRoleAppService appService) : ControllerBase
{
    [HttpGet("permission-definitions")]
    public Task<List<PermissionGroupDto>> GetPermissionDefinitionsAsync() => appService.GetPermissionDefinitionsAsync();

    [HttpGet]
    public Task<List<RoleDto>> GetListAsync() => appService.GetListAsync();

    [HttpPost]
    public Task<RoleDto> CreateAsync(CreateUpdateRoleDto input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<RoleDto> UpdateAsync(Guid id, CreateUpdateRoleDto input) => appService.UpdateAsync(id, input);

    [HttpPut("{id:guid}/permissions")]
    public Task<RoleDto> UpdatePermissionsAsync(Guid id, UpdateRolePermissionsDto input) => appService.UpdatePermissionsAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => appService.DeleteAsync(id);
}

[ApiController]
[Route("api/identity/users")]
[Authorize(StageTrackPermissions.Identity.Users)]
public class UsersController(IUserAppService appService, IRoleAppService roleAppService) : ControllerBase
{
    [HttpGet]
    public Task<PagedResultDto<UserDto>> GetListAsync([FromQuery] GetUserListInput input) => appService.GetListAsync(input);

    /// <summary>Role choices for the user form; available to user managers without the role-management permission.</summary>
    [HttpGet("assignable-roles")]
    public async Task<List<LookupDto>> GetAssignableRolesAsync() =>
        (await roleAppService.GetListAsync()).Select(r => new LookupDto { Id = r.Id, Name = r.Name }).ToList();

    [HttpPost]
    public Task<UserDto> CreateAsync(CreateUserDto input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<UserDto> UpdateAsync(Guid id, UpdateUserDto input) => appService.UpdateAsync(id, input);

    [HttpPost("{id:guid}/active")]
    public Task SetActiveAsync(Guid id, SetUserActiveDto input) => appService.SetActiveAsync(id, input);

    [HttpPost("{id:guid}/reset-password")]
    public Task ResetPasswordAsync(Guid id, ResetPasswordDto input) => appService.ResetPasswordAsync(id, input);
}
