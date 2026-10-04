using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using StageTrack.Account;
using StageTrack.Identity;

namespace StageTrack.Infrastructure;

public class JwtOptions
{
    public const string Section = "Jwt";

    public string Issuer { get; set; } = "StageTrack";
    public string Audience { get; set; } = "StageTrack";
    public string Key { get; set; } = null!;
    public int ExpiresHours { get; set; } = 12;

    public SymmetricSecurityKey GetSigningKey() => new(Encoding.UTF8.GetBytes(Key));
}

public class JwtAccessTokenGenerator(IOptions<JwtOptions> options) : IAccessTokenGenerator
{
    public (string Token, DateTime ExpiresAt) Generate(AppUser user, AppUser? impersonator = null)
    {
        List<Claim> claims =
        [
            new(HttpCurrentUser.UserIdClaim, user.Id.ToString()),
            new(HttpCurrentUser.UserNameClaim, user.UserName)
        ];

        if (impersonator is not null)
        {
            claims.Add(new Claim(HttpCurrentUser.ImpersonatorIdClaim, impersonator.Id.ToString()));
            claims.Add(new Claim(HttpCurrentUser.ImpersonatorNameClaim, impersonator.UserName));
        }

        var settings = options.Value;
        var expiresAt = DateTime.UtcNow.AddHours(settings.ExpiresHours);
        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = settings.Issuer,
            Audience = settings.Audience,
            Expires = expiresAt,
            Subject = new ClaimsIdentity(claims),
            SigningCredentials = new SigningCredentials(settings.GetSigningKey(), SecurityAlgorithms.HmacSha256)
        });

        return (token, expiresAt);
    }
}
