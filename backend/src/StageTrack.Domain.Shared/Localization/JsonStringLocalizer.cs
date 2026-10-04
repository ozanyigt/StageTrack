using System.Collections.Concurrent;
using System.Globalization;
using System.Reflection;
using System.Text.Json;
using Microsoft.Extensions.Localization;

namespace StageTrack.Localization;

/// <summary>
/// Reads flat key/value JSON files embedded in this assembly (tr.json, en.json, ar.json).
/// Falls back to English, then to the key itself.
/// </summary>
public class JsonStringLocalizer : IStringLocalizer<StageTrackResource>
{
    public const string DefaultCulture = "en";
    public static readonly string[] SupportedCultures = ["tr", "en", "ar"];

    private static readonly ConcurrentDictionary<string, IReadOnlyDictionary<string, string>> Cache = new();

    public LocalizedString this[string name]
    {
        get
        {
            var value = Find(name);
            return new LocalizedString(name, value ?? name, resourceNotFound: value is null);
        }
    }

    public LocalizedString this[string name, params object[] arguments]
    {
        get
        {
            var value = Find(name);
            return new LocalizedString(name, string.Format(value ?? name, arguments), resourceNotFound: value is null);
        }
    }

    /// <summary>Replaces {placeholder} tokens with values from <paramref name="data"/>.</summary>
    public string Format(string name, IReadOnlyDictionary<string, object?>? data)
    {
        var text = Find(name) ?? name;
        if (data is null)
        {
            return text;
        }

        foreach (var (key, value) in data)
        {
            text = text.Replace("{" + key + "}", Convert.ToString(value, CultureInfo.CurrentCulture));
        }

        return text;
    }

    public IEnumerable<LocalizedString> GetAllStrings(bool includeParentCultures) =>
        Load(CurrentCulture()).Select(x => new LocalizedString(x.Key, x.Value));

    private static string? Find(string name)
    {
        if (Load(CurrentCulture()).TryGetValue(name, out var value))
        {
            return value;
        }

        return Load(DefaultCulture).TryGetValue(name, out value) ? value : null;
    }

    private static string CurrentCulture()
    {
        var culture = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName;
        return SupportedCultures.Contains(culture) ? culture : DefaultCulture;
    }

    private static IReadOnlyDictionary<string, string> Load(string culture) =>
        Cache.GetOrAdd(culture, static c =>
        {
            var assembly = typeof(JsonStringLocalizer).GetTypeInfo().Assembly;
            var resourceName = $"StageTrack.Domain.Shared.Localization.Resources.{c}.json";
            using var stream = assembly.GetManifestResourceStream(resourceName);
            if (stream is null)
            {
                return new Dictionary<string, string>();
            }

            return JsonSerializer.Deserialize<Dictionary<string, string>>(stream) ?? new Dictionary<string, string>();
        });
}
