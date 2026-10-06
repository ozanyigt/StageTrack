using StageTrack.Authorization;
using StageTrack.Collaboration;
using StageTrack.Inventory;
using StageTrack.Tenants;

namespace StageTrack.Account;

public class FirmAppService(CurrentTenant currentTenant, ITenantRepository tenantRepository) : IFirmAppService
{
    public async Task<FileContentDto?> GetLogoAsync()
    {
        var tenant = await GetTenantAsync();
        return tenant?.LogoContent is null
            ? null
            : new FileContentDto { FileName = "logo", ContentType = tenant.LogoContentType!, Content = tenant.LogoContent };
    }

    public async Task SetLogoAsync(UploadFileInput file) =>
        (await GetTenantAsync() ?? throw new BusinessException(StageTrackErrorCodes.Forbidden)).SetLogo(file.Content, file.ContentType);

    public async Task RemoveLogoAsync() =>
        (await GetTenantAsync() ?? throw new BusinessException(StageTrackErrorCodes.Forbidden)).SetLogo(null, null);

    private async Task<Tenant?> GetTenantAsync() =>
        await currentTenant.GetIdAsync() is { } id ? await tenantRepository.GetAsync(id) : null;
}
