using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using StageTrack.Localization;

namespace StageTrack.Infrastructure;

/// <summary>Single error shape for every failure; the frontend translates <see cref="Code"/> with its own locale files.</summary>
public class ErrorResponse
{
    public required ErrorBody Error { get; init; }
}

public class ErrorBody
{
    public required string Code { get; init; }
    public required string Message { get; init; }
    public Dictionary<string, object?>? Details { get; init; }
    public List<ValidationErrorItem>? ValidationErrors { get; init; }
}

public record ValidationErrorItem(string Field, string Message);

public class ErrorResponseWriter(IStringLocalizer<StageTrackResource> localizer)
{
    public static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    public ErrorResponse Create(string code, IReadOnlyDictionary<string, object?>? details = null, List<ValidationErrorItem>? validationErrors = null)
    {
        var message = localizer is JsonStringLocalizer json ? json.Format(code, details) : localizer[code].Value;
        return new ErrorResponse
        {
            Error = new ErrorBody
            {
                Code = code,
                Message = message,
                Details = details?.ToDictionary(x => x.Key, x => x.Value is Enum e ? e.ToString() : x.Value),
                ValidationErrors = validationErrors
            }
        };
    }

    public Task WriteAsync(HttpContext context, int statusCode, string code, IReadOnlyDictionary<string, object?>? details = null)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";
        return context.Response.WriteAsync(JsonSerializer.Serialize(Create(code, details), JsonOptions));
    }

    /// <summary>Replaces the default ProblemDetails for DataAnnotations failures.</summary>
    public IActionResult CreateValidationResult(ActionContext context)
    {
        var errors = context.ModelState
            .Where(x => x.Value?.Errors.Count > 0)
            .Select(x =>
            {
                var field = string.IsNullOrEmpty(x.Key) ? "body" : JsonNamingPolicy.CamelCase.ConvertName(x.Key.Split('.').Last());
                var json = localizer as JsonStringLocalizer;
                var message = json?.Format("Validation.Invalid", new Dictionary<string, object?> { ["field"] = field }) ?? field;
                return new ValidationErrorItem(field, message);
            })
            .ToList();

        return new BadRequestObjectResult(Create(StageTrackErrorCodes.Validation, null, errors));
    }
}

public class ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context, ErrorResponseWriter writer)
    {
        try
        {
            await next(context);
        }
        catch (EntityNotFoundException ex)
        {
            await writer.WriteAsync(context, StatusCodes.Status404NotFound, ex.Code, ex.Details);
        }
        catch (BusinessException ex)
        {
            await writer.WriteAsync(context, StatusCodes.Status400BadRequest, ex.Code, ex.Details);
        }
        catch (Exception ex) when (!context.Response.HasStarted)
        {
            logger.LogError(ex, "Unhandled exception for {Method} {Path}", context.Request.Method, context.Request.Path);
            await writer.WriteAsync(context, StatusCodes.Status500InternalServerError, StageTrackErrorCodes.Unexpected);
        }
    }
}
