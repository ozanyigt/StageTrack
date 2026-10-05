using Microsoft.Extensions.Localization;
using StageTrack.Authorization;
using StageTrack.Imports;
using StageTrack.Localization;
using StageTrack.Permissions;

namespace StageTrack.Common;

/// <summary>Whether the current user may see prices (rental prices, line prices, totals).</summary>
public class PriceVisibility(IPermissionChecker permissionChecker)
{
    private bool? _canSee;

    public async Task<bool> CanSeeAsync() =>
        _canSee ??= await permissionChecker.IsGrantedAsync(StageTrackPermissions.Prices.View);
}

/// <summary>
/// Runs an Excel import row by row: a failing row is reported with its localized message and the
/// remaining rows still go through, like importing in Rentman.
/// </summary>
public class ImportRunner(IStringLocalizer<StageTrackResource> localizer)
{
    public async Task<ImportResultDto> RunAsync<TRow>(IEnumerable<TRow> rows, Func<TRow, int> rowNumber, Func<TRow, Task<bool>> importRow)
    {
        var result = new ImportResultDto();
        foreach (var row in rows)
        {
            try
            {
                if (await importRow(row))
                {
                    result.Created++;
                }
                else
                {
                    result.Updated++;
                }
            }
            catch (BusinessException ex)
            {
                result.Errors.Add(new ImportErrorDto
                {
                    Row = rowNumber(row),
                    Code = ex.Code,
                    Message = localizer is JsonStringLocalizer json ? json.Format(ex.Code, ex.Details) : localizer[ex.Code].Value,
                    Details = ex.Details.ToDictionary(x => x.Key, x => x.Value is Enum e ? e.ToString() : x.Value)
                });
            }
        }

        return result;
    }

    public static string Required(string? value, string field) =>
        string.IsNullOrWhiteSpace(value)
            ? throw new BusinessException(StageTrackErrorCodes.ImportInvalidRow).WithData("field", field)
            : value.Trim();
}
