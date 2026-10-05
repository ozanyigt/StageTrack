using Ganss.Xss;

namespace StageTrack.Common;

/// <summary>
/// Formatted remarks (bold, lists, links…) are stored as HTML; everything except a small set of
/// formatting tags is removed so a remark can never carry script into another user's browser.
/// </summary>
public static class RichTextSanitizer
{
    private static readonly HtmlSanitizer Sanitizer = Create();

    public static string? Sanitize(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return null;
        }

        var clean = Sanitizer.Sanitize(html).Trim();
        return clean is "" or "<br>" or "<p></p>" or "<div><br></div>" ? null : clean;
    }

    private static HtmlSanitizer Create()
    {
        var sanitizer = new HtmlSanitizer();
        sanitizer.AllowedTags.Clear();
        foreach (var tag in new[] { "p", "div", "br", "b", "strong", "i", "em", "u", "s", "strike", "ul", "ol", "li", "a", "span", "h3", "h4" })
        {
            sanitizer.AllowedTags.Add(tag);
        }

        sanitizer.AllowedAttributes.Clear();
        sanitizer.AllowedAttributes.Add("href");
        sanitizer.AllowedSchemes.Clear();
        sanitizer.AllowedSchemes.Add("http");
        sanitizer.AllowedSchemes.Add("https");
        sanitizer.AllowedSchemes.Add("mailto");
        sanitizer.AllowedCssProperties.Clear();
        return sanitizer;
    }
}
