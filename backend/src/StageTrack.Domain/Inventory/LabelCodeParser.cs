using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace StageTrack.Inventory;

/// <summary>A scanned label reduced to its lookup code, plus what we know about its Rentman origin.</summary>
/// <param name="Code">Canonical value stored in <see cref="EquipmentLabel.Code"/> and used for lookups.</param>
/// <param name="RentmanWorkspaceId">Rentman workspace (cmpID) the label was printed for, when known.</param>
/// <param name="IsCase">True for a Rentman case/combination label.</param>
public record ParsedLabel(string Code, int? RentmanWorkspaceId = null, bool IsCase = false);

/// <summary>
/// Turns whatever a camera or handheld scanner returns into one canonical code.
/// Rentman QR labels hold JSON such as <c>{"ID":"19483","cmpID":16,"isCase":0}</c>; they become
/// <c>RM:16:S:19483</c> (S = single item, C = case), so spacing or key order never matters and the
/// workspace stays known. Scanners configured for a US keyboard but typing into a Turkish-Q system turn
/// that JSON into text like <c>ĞİIDİŞİ19483İ…Ü</c>; that is mapped back before parsing.
/// </summary>
public static partial class LabelCodeParser
{
    public const string RentmanPrefix = "RM";

    private static readonly string[] UrlCodeKeys = ["code", "qr", "barcode", "id", "serial"];

    /// <summary>
    /// Character a US-layout scanner produces on a Turkish-Q keyboard → the character it meant.
    /// Only applied to text that looks like garbled JSON, so normal Turkish text is never touched.
    /// </summary>
    private static readonly Dictionary<char, char> TurkishQToUs = new()
    {
        ['Ğ'] = '{', ['Ü'] = '}', ['ğ'] = '[', ['ü'] = ']',
        ['İ'] = '"', ['i'] = '\'',
        ['Ş'] = ':', ['ş'] = ';',
        ['ö'] = ',', ['ç'] = '.', ['Ö'] = '<', ['Ç'] = '>',
        ['ı'] = 'i', ['*'] = '-', ['?'] = '_'
    };

    public static ParsedLabel Parse(string? raw)
    {
        var value = new string((raw ?? string.Empty).Where(c => !char.IsControl(c)).ToArray()).Trim();

        if (TryParseCanonical(value, out var parsed) || TryParseRentmanJson(value, out parsed))
        {
            return parsed;
        }

        if (LooksLikeTurkishLayoutJson(value) && TryParseRentmanJson(FixTurkishLayout(value), out parsed))
        {
            return parsed;
        }

        if (TryParseUrl(value, out var fromUrl))
        {
            return new ParsedLabel(fromUrl);
        }

        return new ParsedLabel(value);
    }

    public static string Format(int? workspaceId, bool isCase, string id) =>
        workspaceId is null
            ? $"{RentmanPrefix}:{(isCase ? "C" : "S")}:{id}"
            : $"{RentmanPrefix}:{workspaceId}:{(isCase ? "C" : "S")}:{id}";

    /// <summary>Already canonical (typed by hand or stored earlier), e.g. "RM:16:S:19483".</summary>
    private static bool TryParseCanonical(string value, out ParsedLabel parsed)
    {
        var match = CanonicalPattern().Match(value);
        if (!match.Success)
        {
            parsed = null!;
            return false;
        }

        int? workspace = match.Groups["ws"].Success ? int.Parse(match.Groups["ws"].Value, CultureInfo.InvariantCulture) : null;
        var isCase = match.Groups["kind"].Value.Equals("C", StringComparison.OrdinalIgnoreCase);
        var id = match.Groups["id"].Value;
        parsed = new ParsedLabel(Format(workspace, isCase, id), workspace, isCase);
        return true;
    }

    private static bool TryParseRentmanJson(string value, out ParsedLabel parsed)
    {
        parsed = null!;
        if (!value.StartsWith('{') || !value.EndsWith('}'))
        {
            return false;
        }

        try
        {
            using var document = JsonDocument.Parse(value);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            var properties = document.RootElement.EnumerateObject()
                .GroupBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().Value, StringComparer.OrdinalIgnoreCase);

            if (!properties.TryGetValue("ID", out var idElement) || ReadString(idElement) is not { Length: > 0 } id)
            {
                return false;
            }

            int? workspace = properties.TryGetValue("cmpID", out var cmp) && int.TryParse(ReadString(cmp), NumberStyles.Integer, CultureInfo.InvariantCulture, out var ws)
                ? ws
                : null;
            var isCase = properties.TryGetValue("isCase", out var caseElement) && ReadString(caseElement) is "1" or "true" or "True";

            parsed = new ParsedLabel(Format(workspace, isCase, id), workspace, isCase);
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static string? ReadString(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.String => element.GetString()?.Trim(),
        JsonValueKind.Number => element.GetRawText(),
        JsonValueKind.True => "true",
        JsonValueKind.False => "false",
        _ => null
    };

    private static bool LooksLikeTurkishLayoutJson(string value) =>
        value.Length > 2 && value[0] == 'Ğ' && value[^1] == 'Ü';

    private static string FixTurkishLayout(string value) =>
        new(value.Select(c => TurkishQToUs.TryGetValue(c, out var us) ? us : c).ToArray());

    /// <summary>A label that holds a URL is reduced to its code part (query parameter or last path segment).</summary>
    private static bool TryParseUrl(string value, out string code)
    {
        code = null!;
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return false;
        }

        var query = uri.Query.TrimStart('?')
            .Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Select(p => p.Split('=', 2))
            .Where(p => p.Length == 2)
            .GroupBy(p => Uri.UnescapeDataString(p[0]).ToLowerInvariant())
            .ToDictionary(g => g.Key, g => Uri.UnescapeDataString(g.First()[1]));

        foreach (var key in UrlCodeKeys)
        {
            if (query.TryGetValue(key, out var fromQuery) && !string.IsNullOrWhiteSpace(fromQuery))
            {
                code = fromQuery.Trim();
                return true;
            }
        }

        var lastSegment = uri.Segments.LastOrDefault(s => s.Trim('/').Length > 0)?.Trim('/');
        if (string.IsNullOrWhiteSpace(lastSegment))
        {
            return false;
        }

        code = Uri.UnescapeDataString(lastSegment);
        return true;
    }

    [GeneratedRegex(@"^RM:(?:(?<ws>\d+):)?(?<kind>[SC]):(?<id>[^\s:]+)$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex CanonicalPattern();
}
