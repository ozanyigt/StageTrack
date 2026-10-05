using StageTrack.Dtos;
using StageTrack.Permissions;
using StageTrack.Session;

namespace StageTrack.Identity;

public class RoleAppService(IRoleRepository roleRepository, RoleManager roleManager) : IRoleAppService
{
    public Task<List<PermissionGroupDto>> GetPermissionDefinitionsAsync() =>
        Task.FromResult(StageTrackPermissions.Groups.Select(g => new PermissionGroupDto
        {
            Name = g.Name,
            Permissions = g.Permissions.Select(p => new PermissionDefinitionDto { Name = p.Name, Parent = p.Parent }).ToList()
        }).ToList());

    public async Task<List<RoleDto>> GetListAsync()
    {
        var roles = await roleRepository.GetListAsync(includeDetails: true);
        var counts = await roleRepository.GetUserCountsAsync();
        return roles.Select(r => ToDto(r, counts.GetValueOrDefault(r.Id))).ToList();
    }

    public async Task<RoleDto> CreateAsync(CreateUpdateRoleDto input)
    {
        var role = await roleManager.CreateAsync(input.Name);
        await roleRepository.InsertAsync(role);
        return ToDto(role, 0);
    }

    public async Task<RoleDto> UpdateAsync(Guid id, CreateUpdateRoleDto input)
    {
        var role = await roleRepository.GetAsync(id);
        await roleManager.RenameAsync(role, input.Name);
        return ToDto(role, (await roleRepository.GetUserCountsAsync()).GetValueOrDefault(id));
    }

    public async Task<RoleDto> UpdatePermissionsAsync(Guid id, UpdateRolePermissionsDto input)
    {
        var role = await roleRepository.GetAsync(id);
        roleManager.SetPermissions(role, input.Permissions);
        return ToDto(role, (await roleRepository.GetUserCountsAsync()).GetValueOrDefault(id));
    }

    public async Task DeleteAsync(Guid id)
    {
        var role = await roleRepository.GetAsync(id);
        await roleManager.EnsureCanDeleteAsync(role);
        await roleRepository.DeleteAsync(role);
    }

    private static RoleDto ToDto(AppRole role, int userCount) => new()
    {
        Id = role.Id,
        Name = role.Name,
        IsStatic = role.IsStatic,
        UserCount = userCount,
        Permissions = role.IsStatic ? StageTrackPermissions.GetAll().ToList() : role.Permissions.Select(p => p.Name).ToList()
    };
}

/// <summary>Users of the company the admin is working in (X-Company-Id).</summary>
public class UserAppService(
    IUserRepository userRepository,
    UserManager userManager,
    ICurrentUser currentUser,
    ICurrentCompany currentCompany) : IUserAppService
{
    public async Task<PagedResultDto<UserDto>> GetListAsync(GetUserListInput input)
    {
        var companyId = currentCompany.Id!.Value;
        var total = await userRepository.GetCountAsync(companyId, input.Text);
        var items = await userRepository.GetPagedListAsync(companyId, input.Text, input.SkipCount, input.MaxResultCount);
        var acting = await GetActingUserAsync();
        return new PagedResultDto<UserDto>(total, items.Select(x => ToDto(x.User, x.RoleIds, x.CompanyIds, acting)).ToList());
    }

    public async Task<UserDto> CreateAsync(CreateUserDto input)
    {
        var acting = await GetActingUserAsync();
        var user = await userManager.CreateAsync(input.UserName, input.FullName, input.Password, input.Email, input.Language);
        user.Update(user.FullName, user.Email, input.Phone, input.JobTitle);
        await userManager.SetRolesAsync(user, input.RoleIds);
        userManager.SetCompanies(user, input.CompanyIds, acting);
        return ToDto(user, acting);
    }

    public async Task<UserDto> UpdateAsync(Guid id, UpdateUserDto input)
    {
        var acting = await GetActingUserAsync();
        var user = await GetInCurrentCompanyAsync(id);
        user.Update(input.FullName.Trim(), input.Email, input.Phone, input.JobTitle);
        await userManager.SetRolesAsync(user, input.RoleIds);
        userManager.SetCompanies(user, input.CompanyIds, acting);
        return ToDto(user, acting);
    }

    public async Task SetActiveAsync(Guid id, SetUserActiveDto input)
    {
        var user = await GetInCurrentCompanyAsync(id);
        userManager.SetActive(user, input.IsActive, currentUser.Id!.Value);
    }

    public async Task ResetPasswordAsync(Guid id, ResetPasswordDto input)
    {
        var user = await GetInCurrentCompanyAsync(id);
        userManager.SetPassword(user, input.NewPassword);
    }

    private Task<AppUser> GetActingUserAsync() => userRepository.GetAsync(currentUser.Id!.Value);

    /// <summary>An admin can only manage users who belong to the company they are working in.</summary>
    private async Task<AppUser> GetInCurrentCompanyAsync(Guid id)
    {
        var user = await userRepository.GetAsync(id);
        if (!user.HasCompany(currentCompany.Id!.Value))
        {
            throw new EntityNotFoundException(typeof(AppUser), id);
        }

        return user;
    }

    private static UserDto ToDto(AppUser user, AppUser acting) =>
        ToDto(user, user.Roles.Select(r => r.RoleId).ToList(), user.Companies.Select(c => c.CompanyId).ToList(), acting);

    /// <summary>Only companies the acting admin also belongs to are exposed.</summary>
    private static UserDto ToDto(AppUser user, List<Guid> roleIds, List<Guid> companyIds, AppUser acting) => new()
    {
        Id = user.Id,
        UserName = user.UserName,
        FullName = user.FullName,
        Phone = user.Phone,
        JobTitle = user.JobTitle,
        Email = user.Email,
        IsActive = user.IsActive,
        Language = user.Language,
        CreationTime = user.CreationTime,
        RoleIds = roleIds,
        CompanyIds = companyIds.Where(acting.HasCompany).ToList()
    };
}
