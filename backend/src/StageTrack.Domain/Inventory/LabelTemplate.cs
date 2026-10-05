using StageTrack.Collaboration;
using StageTrack.Entities;
using StageTrack.Repositories;

namespace StageTrack.Inventory;

/// <summary>
/// Layout of a printed equipment label (Rentman "equipment slip" template), e.g. "VIDEO EKİPMAN ETİKET 6×3 cm":
/// label size, QR size and which texts are printed next to the QR.
/// </summary>
public class LabelTemplate : CompanyAggregateRoot
{
    public string Name { get; private set; } = null!;
    public int WidthMm { get; private set; }
    public int HeightMm { get; private set; }
    public int QrSizeMm { get; private set; }
    public decimal FontSizePt { get; private set; }
    public bool ShowName { get; private set; } = true;
    public bool ShowBrand { get; private set; } = true;
    public bool ShowModel { get; private set; } = true;
    public bool ShowCode { get; private set; }
    public bool ShowInternalRef { get; private set; } = true;
    public bool ShowSerialNumber { get; private set; } = true;
    public bool ShowCompanyName { get; private set; }
    public bool IsDefault { get; private set; }

    private LabelTemplate()
    {
    }

    public LabelTemplate(Guid id, string name) : base(id)
    {
        Name = name;
    }

    public void Update(string name, int widthMm, int heightMm, int qrSizeMm, decimal fontSizePt)
    {
        if (widthMm is < LabelTemplateConsts.MinSizeMm or > LabelTemplateConsts.MaxSizeMm ||
            heightMm is < LabelTemplateConsts.MinSizeMm or > LabelTemplateConsts.MaxSizeMm ||
            qrSizeMm < 5 || qrSizeMm > Math.Min(widthMm, heightMm))
        {
            throw new BusinessException(StageTrackErrorCodes.LabelTemplateInvalidSize);
        }

        Name = name;
        WidthMm = widthMm;
        HeightMm = heightMm;
        QrSizeMm = qrSizeMm;
        FontSizePt = Math.Clamp(fontSizePt, 4, 24);
    }

    public void SetFields(bool name, bool brand, bool model, bool code, bool internalRef, bool serialNumber, bool companyName)
    {
        ShowName = name;
        ShowBrand = brand;
        ShowModel = model;
        ShowCode = code;
        ShowInternalRef = internalRef;
        ShowSerialNumber = serialNumber;
        ShowCompanyName = companyName;
    }

    internal void SetDefault(bool isDefault) => IsDefault = isDefault;
}

public interface ILabelTemplateRepository : IRepository<LabelTemplate>
{
    Task<LabelTemplate?> FindDefaultAsync(CancellationToken cancellationToken = default);
}

public class LabelTemplateManager(ILabelTemplateRepository templateRepository)
{
    /// <summary>Exactly one template is the default; the first one always is.</summary>
    public async Task SetDefaultAsync(LabelTemplate template)
    {
        var current = await templateRepository.FindDefaultAsync();
        if (current is not null && current.Id != template.Id)
        {
            current.SetDefault(false);
        }

        template.SetDefault(true);
    }

    public async Task EnsureDefaultExistsAsync(LabelTemplate template)
    {
        if (await templateRepository.FindDefaultAsync() is null)
        {
            template.SetDefault(true);
        }
    }
}
