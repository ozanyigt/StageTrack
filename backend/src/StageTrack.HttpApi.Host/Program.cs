using System.Globalization;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Localization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using StageTrack;
using StageTrack.Account;
using StageTrack.Controllers;
using StageTrack.Data;
using StageTrack.EntityFrameworkCore;
using StageTrack.Infrastructure;
using StageTrack.Localization;
using StageTrack.Session;

var builder = WebApplication.CreateBuilder(args);
var services = builder.Services;

// Layers (ABP-style module registration)
services.AddStageTrackApplication();
services.AddStageTrackEntityFrameworkCore(builder.Configuration.GetConnectionString("Default")!);

// Session
services.AddHttpContextAccessor();
services.AddScoped<ICurrentUser, HttpCurrentUser>();
services.AddScoped<ICurrentCompany, HttpCurrentCompany>();

// Localization: Accept-Language (tr, en, ar) selects the backend message language
services.AddSingleton<IStringLocalizer<StageTrackResource>, JsonStringLocalizer>();
services.AddScoped<ErrorResponseWriter>();

// Authentication & permission-based authorization
var jwtSection = builder.Configuration.GetSection(JwtOptions.Section);
services.Configure<JwtOptions>(jwtSection);
var jwt = jwtSection.Get<JwtOptions>()!;
services.AddSingleton<IAccessTokenGenerator, JwtAccessTokenGenerator>();
services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = jwt.GetSigningKey(),
            NameClaimType = HttpCurrentUser.UserNameClaim,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
        options.Events = new JwtBearerEvents
        {
            OnChallenge = async context =>
            {
                context.HandleResponse();
                var writer = context.HttpContext.RequestServices.GetRequiredService<ErrorResponseWriter>();
                await writer.WriteAsync(context.HttpContext, StatusCodes.Status401Unauthorized, StageTrackErrorCodes.Unauthorized);
            },
            OnForbidden = context =>
            {
                var writer = context.HttpContext.RequestServices.GetRequiredService<ErrorResponseWriter>();
                return writer.WriteAsync(context.HttpContext, StatusCodes.Status403Forbidden, StageTrackErrorCodes.Forbidden);
            }
        };
    });
services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
services.AddAuthorization();

// MVC
services.AddScoped<UnitOfWorkFilter>();
services.AddControllers(options => options.Filters.AddService<UnitOfWorkFilter>())
    .AddApplicationPart(typeof(AccountController).Assembly)
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
    .ConfigureApiBehaviorOptions(options =>
        options.InvalidModelStateResponseFactory = context =>
            context.HttpContext.RequestServices.GetRequiredService<ErrorResponseWriter>().CreateValidationResult(context));

services.AddOpenApi();
services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [])
        .AllowAnyHeader()
        .AllowAnyMethod()));

var app = builder.Build();

var cultures = JsonStringLocalizer.SupportedCultures.Select(c => new CultureInfo(c)).ToList();
app.UseRequestLocalization(new RequestLocalizationOptions
{
    DefaultRequestCulture = new RequestCulture("tr"),
    SupportedCultures = cultures,
    SupportedUICultures = cultures
});

app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseCors();
app.UseAuthentication();
app.UseMiddleware<CompanyAccessMiddleware>();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.MapControllers();
app.MapGet("/", () => Results.Redirect(app.Environment.IsDevelopment() ? "/scalar" : "/api/health")).ExcludeFromDescription();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" })).ExcludeFromDescription();

// Apply migrations and create demo data on first start
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<StageTrackDbContext>();
    await db.Database.MigrateAsync();
    await WarnIfCollationIsUnexpectedAsync(db, app.Services.GetRequiredService<ILoggerFactory>());

    // An empty database only gets the platform administrator; customer firms are created from the admin panel.
    var hostAdmin = app.Configuration.GetSection(HostAdminOptions.Section).Get<HostAdminOptions>() ?? new HostAdminOptions();
    await scope.ServiceProvider.GetRequiredService<HostDataSeeder>().SeedAsync(hostAdmin);

    if (app.Configuration.GetValue("Seed:DemoData", false))
    {
        await scope.ServiceProvider.GetRequiredService<DemoDataSeeder>().SeedAsync();
    }
}

app.Run();

/// <summary>
/// Whether the database compares text the way this product assumes. Case and Turkish i/I decide whether "SM58"
/// and "sm58" are one equipment code or two, and whether a search for "isik" finds "IŞIK" - and the answer comes
/// from the collation the database was CREATED with. It cannot be changed afterwards: filtered indexes depend on
/// it, and SQL Server refuses. So this does not try to fix anything; it says plainly, once, at startup, when the
/// database was created with something else, while there is still time to recreate it.
///
/// The production database should be created as:
///     CREATE DATABASE [StageTrack] COLLATE Turkish_CI_AS;
/// </summary>
static async Task WarnIfCollationIsUnexpectedAsync(StageTrackDbContext db, ILoggerFactory loggerFactory)
{
    const string Expected = "Turkish_CI_AS";
    var logger = loggerFactory.CreateLogger("StageTrack.Database");
    try
    {
        var connection = db.Database.GetDbConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT CONVERT(nvarchar(128), DATABASEPROPERTYEX(DB_NAME(), 'Collation'))";
        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync();
        }

        var collation = (await command.ExecuteScalarAsync())?.ToString();
        if (string.Equals(collation, Expected, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        logger.LogWarning(
            "Database collation is {Collation}, not {Expected}. Equipment codes and searches will compare text " +
            "differently than intended (case sensitivity, Turkish i/I). A collation can only be set when the " +
            "database is created: CREATE DATABASE [...] COLLATE {Expected}.",
            collation, Expected, Expected);
    }
    catch (Exception e)
    {
        logger.LogWarning(e, "Could not read the database collation.");
    }
}
