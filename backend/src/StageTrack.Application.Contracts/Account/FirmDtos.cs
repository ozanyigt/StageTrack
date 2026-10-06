using StageTrack.Collaboration;
using StageTrack.Inventory;

namespace StageTrack.Account;

/// <summary>Settings of the signed-in user's firm (logo for printed documents).</summary>
public interface IFirmAppService
{
    /// <summary>Null when the firm has no logo.</summary>
    Task<FileContentDto?> GetLogoAsync();

    Task SetLogoAsync(UploadFileInput file);

    Task RemoveLogoAsync();
}
