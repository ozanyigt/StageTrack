using StageTrack.Account;
using StageTrack.Companies;
using StageTrack.Dtos;
using StageTrack.Identity;
using StageTrack.Repositories;
using StageTrack.Tenants;

namespace StageTrack.Host;

public class TenantAppService(
    ITenantRepository tenantRepository,
    ICompanyRepository companyRepository,
    IUserRepository userRepository,
    TenantManager tenantManager,
    TenantProvisioningManager provisioningManager,
    UserManager userManager,
    IUnitOfWork unitOfWork) : ITenantAppService
{
    public async Task<HostSummaryDto> GetSummaryAsync()
    {
        var today = DateTime.Today;
        var tenants = await tenantRepository.GetListAsync();
        var statuses = tenants.Select(t => (Tenant: t, Status: t.GetStatus(today))).ToList();
        return new HostSummaryDto
        {
            Total = tenants.Count,
            Active = statuses.Count(x => x.Status == TenantStatus.Active),
            Suspended = statuses.Count(x => x.Status == TenantStatus.Suspended),
            Expired = statuses.Count(x => x.Status == TenantStatus.Expired),
            ExpiringSoon = statuses.Count(x => x.Status == TenantStatus.Active && x.Tenant.EndDate.HasValue &&
                                               x.Tenant.EndDate.Value <= today.AddDays(TenantConsts.ExpiryWarningDays))
        };
    }

    public async Task<PagedResultDto<TenantDto>> GetListAsync(GetTenantListInput input)
    {
        var total = await tenantRepository.GetCountAsync(input.Text);
        var items = await tenantRepository.GetPagedListAsync(input.Text, input.SkipCount, input.MaxResultCount);
        return new PagedResultDto<TenantDto>(total, items.Select(x => Fill(new TenantDto(), x.Tenant, x.UserCount, x.LocationCount)).ToList());
    }

    public Task<TenantDetailDto> GetAsync(Guid id) => BuildDetailAsync(id);

    public async Task<TenantDetailDto> CreateAsync(CreateTenantInput input)
    {
        var tenant = await tenantManager.CreateAsync(input.Name, input.Code);
        Apply(tenant, input);
        await tenantRepository.InsertAsync(tenant);
        await unitOfWork.SaveChangesAsync();

        await provisioningManager.ProvisionAsync(tenant, ToSetup(input.Location),
            new TenantProvisioningManager.AdminSetup(input.Admin.UserName, input.Admin.FullName, input.Admin.Email, input.Admin.Password,
                input.Admin.Language));
        return await BuildDetailAsync(tenant.Id);
    }

    public async Task<TenantDetailDto> UpdateAsync(Guid id, UpdateTenantInput input)
    {
        var tenant = await tenantRepository.GetAsync(id);
        await tenantManager.ChangeCodeAsync(tenant, input.Code);
        Apply(tenant, input);
        await unitOfWork.SaveChangesAsync();
        return await BuildDetailAsync(id);
    }

    public async Task<TenantDetailDto> SetActiveAsync(Guid id, SetTenantActiveInput input)
    {
        var tenant = await tenantRepository.GetAsync(id);
        tenant.SetActive(input.IsActive);
        await unitOfWork.SaveChangesAsync();
        return await BuildDetailAsync(id);
    }

    public async Task<TenantDetailDto> AddLocationAsync(Guid id, TenantLocationInput input)
    {
        var tenant = await tenantRepository.GetAsync(id);
        var company = await provisioningManager.AddLocationAsync(tenant, ToSetup(input));

        // The firm's administrators work in every location from the start.
        foreach (var (user, roles) in await userRepository.GetListByTenantAsync(id))
        {
            if (roles.Contains(AppRole.AdminRoleName))
            {
                (await userRepository.GetAsync(user.Id)).AddCompany(company.Id);
            }
        }

        await unitOfWork.SaveChangesAsync();
        return await BuildDetailAsync(id);
    }

    public async Task<TenantDetailDto> UpdateLocationAsync(Guid id, Guid locationId, TenantLocationInput input)
    {
        var company = await companyRepository.GetAsync(locationId);
        if (company.TenantId != id)
        {
            throw new EntityNotFoundException(typeof(Company), locationId);
        }

        company.Update(input.Name, input.Currency, input.VatRate, input.CountryCode);
        company.SetRentmanWorkspace(input.RentmanWorkspaceId);
        await unitOfWork.SaveChangesAsync();
        return await BuildDetailAsync(id);
    }

    public async Task ResetUserPasswordAsync(Guid id, Guid userId, ResetTenantUserPasswordInput input)
    {
        var user = await userRepository.GetAsync(userId);
        if (user.TenantId != id)
        {
            throw new EntityNotFoundException(typeof(AppUser), userId);
        }

        userManager.SetPassword(user, input.NewPassword);
    }

    private static void Apply(Tenant tenant, UpdateTenantInput input)
    {
        tenant.Update(input.Name, input.ContactName, input.Email, input.Phone, input.Notes);
        tenant.SetSubscription(input.PlanName, input.StartDate, input.EndDate, input.MaxUsers, input.MaxLocations);
    }

    private static TenantProvisioningManager.LocationSetup ToSetup(TenantLocationInput input) =>
        new(input.Name, input.Code, input.Currency, input.VatRate, input.CountryCode, input.RentmanWorkspaceId,
            string.IsNullOrWhiteSpace(input.WarehouseName) ? (input.CountryCode.Equals("TR", StringComparison.OrdinalIgnoreCase) ? "ANA DEPO" : "MAIN WAREHOUSE") : input.WarehouseName);

    private async Task<TenantDetailDto> BuildDetailAsync(Guid id)
    {
        var tenant = await tenantRepository.GetAsync(id);
        var locations = await companyRepository.GetListByTenantAsync(id);
        var users = await userRepository.GetListByTenantAsync(id);
        var dto = Fill(new TenantDetailDto(), tenant, users.Count, locations.Count);
        dto.Locations = locations.Select(c => new TenantLocationDto
        {
            Id = c.Id,
            Name = c.Name,
            Code = c.Code,
            DefaultCurrency = c.DefaultCurrency,
            DefaultVatRate = c.DefaultVatRate,
            CountryCode = c.CountryCode,
            RentmanWorkspaceId = c.RentmanWorkspaceId
        }).ToList();
        dto.Users = users.Select(u => new TenantUserDto
        {
            Id = u.User.Id,
            UserName = u.User.UserName,
            FullName = u.User.FullName,
            Email = u.User.Email,
            IsActive = u.User.IsActive,
            Roles = u.Roles,
            CreationTime = u.User.CreationTime
        }).ToList();
        return dto;
    }

    private static T Fill<T>(T dto, Tenant t, int userCount, int locationCount) where T : TenantDto
    {
        var today = DateTime.Today;
        dto.Id = t.Id;
        dto.Name = t.Name;
        dto.Code = t.Code;
        dto.ContactName = t.ContactName;
        dto.Email = t.Email;
        dto.Phone = t.Phone;
        dto.Notes = t.Notes;
        dto.IsActive = t.IsActive;
        dto.Status = t.GetStatus(today);
        dto.PlanName = t.PlanName;
        dto.StartDate = t.StartDate;
        dto.EndDate = t.EndDate;
        dto.MaxUsers = t.MaxUsers;
        dto.MaxLocations = t.MaxLocations;
        dto.UserCount = userCount;
        dto.LocationCount = locationCount;
        dto.CreationTime = t.CreationTime;
        dto.DaysLeft = t.EndDate.HasValue ? (int)(t.EndDate.Value - today).TotalDays : null;
        return dto;
    }
}
