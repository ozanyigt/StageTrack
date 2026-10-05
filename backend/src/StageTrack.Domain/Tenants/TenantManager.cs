using StageTrack.Companies;
using StageTrack.Identity;
using StageTrack.Inventory;
using StageTrack.Permissions;
using StageTrack.Pricing;
using StageTrack.Repositories;
using StageTrack.Session;

namespace StageTrack.Tenants;

/// <summary>Subscription rules of customer firms: unique codes, sign-in only while subscribed, user and location limits.</summary>
public class TenantManager(ITenantRepository tenantRepository)
{
    public async Task<Tenant> CreateAsync(string name, string code)
    {
        code = NormalizeCode(code);
        await EnsureCodeIsUniqueAsync(code, null);
        return new Tenant(Guid.CreateVersion7(), name.Trim(), code);
    }

    public async Task ChangeCodeAsync(Tenant tenant, string code)
    {
        code = NormalizeCode(code);
        await EnsureCodeIsUniqueAsync(code, tenant.Id);
        tenant.SetCode(code);
    }

    /// <summary>Users of a suspended, expired or not yet started firm cannot sign in or call the API.</summary>
    public static void EnsureCanUse(Tenant tenant, DateTime today)
    {
        switch (tenant.GetStatus(today))
        {
            case TenantStatus.Suspended:
                throw new BusinessException(StageTrackErrorCodes.TenantSuspended);
            case TenantStatus.Expired:
                throw new BusinessException(StageTrackErrorCodes.TenantSubscriptionExpired)
                    .WithData("date", tenant.EndDate!.Value.ToString("dd.MM.yyyy"));
            case TenantStatus.NotStarted:
                throw new BusinessException(StageTrackErrorCodes.TenantSubscriptionNotStarted)
                    .WithData("date", tenant.StartDate.ToString("dd.MM.yyyy"));
        }
    }

    public async Task EnsureCanAddUserAsync(Guid tenantId)
    {
        var tenant = await tenantRepository.GetAsync(tenantId);
        if (tenant.MaxUsers is { } max && await tenantRepository.GetUserCountAsync(tenantId) >= max)
        {
            throw new BusinessException(StageTrackErrorCodes.TenantUserLimitReached).WithData("max", max);
        }
    }

    public async Task EnsureCanAddLocationAsync(Tenant tenant)
    {
        if (tenant.MaxLocations is { } max && await tenantRepository.GetLocationCountAsync(tenant.Id) >= max)
        {
            throw new BusinessException(StageTrackErrorCodes.TenantLocationLimitReached).WithData("max", max);
        }
    }

    private async Task EnsureCodeIsUniqueAsync(string code, Guid? excludeId)
    {
        if (await tenantRepository.CodeExistsAsync(code, excludeId))
        {
            throw new BusinessException(StageTrackErrorCodes.TenantCodeAlreadyExists).WithData("code", code);
        }
    }

    private static string NormalizeCode(string code) => code.Trim().ToUpperInvariant();
}

/// <summary>
/// Sets up a new customer firm: its first location with a warehouse, a label template and a day-multiplier table,
/// the built-in roles and the firm's administrator. The firm then adds its own data.
/// </summary>
public class TenantProvisioningManager(
    TenantManager tenantManager,
    ICompanyRepository companyRepository,
    IRoleRepository roleRepository,
    UserManager userManager,
    IStockLocationRepository stockLocationRepository,
    ILabelTemplateRepository labelTemplateRepository,
    LabelTemplateManager labelTemplateManager,
    RentalFactorManager rentalFactorManager,
    IRentalFactorProfileRepository rentalFactorRepository,
    ICurrentCompany currentCompany,
    IUnitOfWork unitOfWork)
{
    public record LocationSetup(string Name, string Code, string Currency, decimal VatRate, string CountryCode, int? RentmanWorkspaceId,
        string WarehouseName);

    public record AdminSetup(string UserName, string FullName, string? Email, string Password, string Language);

    /// <summary>Creates the firm's locations, roles and administrator. The tenant must already be inserted.</summary>
    public async Task<AppUser> ProvisionAsync(Tenant tenant, LocationSetup location, AdminSetup admin)
    {
        var company = await AddLocationAsync(tenant, location);
        var adminRole = await CreateBuiltInRolesAsync(tenant.Id);
        await unitOfWork.SaveChangesAsync();

        var user = await userManager.CreateAsync(admin.UserName, admin.FullName, admin.Password, admin.Email, admin.Language, tenant.Id);
        user.AddRole(adminRole.Id);
        user.AddCompany(company.Id);
        await unitOfWork.SaveChangesAsync();
        return user;
    }

    /// <summary>A new location (e.g. Dubai) of the firm with its own warehouse, label template and multiplier table.</summary>
    public async Task<Company> AddLocationAsync(Tenant tenant, LocationSetup setup)
    {
        await tenantManager.EnsureCanAddLocationAsync(tenant);
        var code = setup.Code.Trim().ToUpperInvariant();
        if (await companyRepository.CodeExistsAsync(tenant.Id, code))
        {
            throw new BusinessException(StageTrackErrorCodes.CompanyCodeAlreadyExists).WithData("code", code);
        }

        var company = new Company(Guid.CreateVersion7(), setup.Name.Trim(), code, setup.Currency.Trim().ToUpperInvariant(), setup.VatRate,
            setup.CountryCode.Trim().ToUpperInvariant(), tenant.Id);
        company.SetRentmanWorkspace(setup.RentmanWorkspaceId);
        await companyRepository.InsertAsync(company);
        await unitOfWork.SaveChangesAsync();

        var turkish = company.CountryCode == "TR";
        using (currentCompany.Change(company.Id))
        {
            await stockLocationRepository.InsertAsync(new StockLocation(Guid.CreateVersion7(), setup.WarehouseName.Trim(),
                StockLocationType.Warehouse, null, null));

            var template = new LabelTemplate(Guid.CreateVersion7(), turkish ? "STANDART ETİKET 6x3 cm" : "STANDARD LABEL 6x3 cm");
            template.Update(template.Name, 60, 30, 20, 7);
            template.SetFields(name: true, brand: true, model: true, code: false, internalRef: true, serialNumber: true, companyName: false);
            await labelTemplateManager.SetDefaultAsync(template);
            await labelTemplateRepository.InsertAsync(template);

            var profile = await rentalFactorManager.CreateAsync(turkish ? "Standart" : "Standard", 0.5m,
                [(1, 1m), (2, 1.5m), (3, 2m), (7, 4m)], isDefault: true);
            await rentalFactorRepository.InsertAsync(profile);
            await unitOfWork.SaveChangesAsync();
        }

        return company;
    }

    /// <summary>admin (all permissions, locked), warehouse, sales and member — the firm's admin can change all but admin.</summary>
    private async Task<AppRole> CreateBuiltInRolesAsync(Guid tenantId)
    {
        var admin = new AppRole(Guid.CreateVersion7(), AppRole.AdminRoleName, tenantId, isStatic: true);
        await roleRepository.InsertAsync(admin);

        foreach (var (name, permissions) in BuiltInRoles)
        {
            var role = new AppRole(Guid.CreateVersion7(), name, tenantId);
            foreach (var permission in permissions)
            {
                role.Grant(permission);
            }

            await roleRepository.InsertAsync(role);
        }

        return admin;
    }

    public static readonly IReadOnlyList<(string Name, string[] Permissions)> BuiltInRoles =
    [
        ("warehouse",
        [
            StageTrackPermissions.Equipment.Default, StageTrackPermissions.Labels.Assign,
            StageTrackPermissions.Maintenance.Default, StageTrackPermissions.Maintenance.Manage,
            StageTrackPermissions.Suppliers.Default,
            StageTrackPermissions.Projects.Default, StageTrackPermissions.Projects.ChangeStatus,
            StageTrackPermissions.Warehouse.Default, StageTrackPermissions.Warehouse.Scan
        ]),
        ("sales",
        [
            StageTrackPermissions.Equipment.Default, StageTrackPermissions.Customers.Default,
            StageTrackPermissions.Customers.Manage, StageTrackPermissions.Projects.Default,
            StageTrackPermissions.Projects.Manage, StageTrackPermissions.Projects.ChangeStatus,
            StageTrackPermissions.Quotes.Default, StageTrackPermissions.Quotes.Manage,
            StageTrackPermissions.Prices.View, StageTrackPermissions.Warehouse.Default
        ]),
        // Crew members: only the confirmed projects they are assigned to, without any prices.
        ("member", [StageTrackPermissions.Projects.Assigned])
    ];
}
