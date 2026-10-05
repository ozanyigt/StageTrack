using System.Globalization;
using StageTrack.Companies;
using StageTrack.Session;

namespace StageTrack.Inventory;

public class LabelManager(
    IEquipmentLabelRepository labelRepository,
    IEquipmentRepository equipmentRepository,
    IEquipmentUnitRepository unitRepository,
    ICompanyRepository companyRepository,
    ICurrentCompany currentCompany)
{
    /// <summary>
    /// IDs of labels printed by this system start far above Rentman's own record IDs, so a new label
    /// can never collide with an existing Rentman label of the same workspace.
    /// </summary>
    public const int FirstOwnLabelNumber = 80_000_000;

    /// <summary>The lookup key for any scanned text; see <see cref="LabelCodeParser"/>.</summary>
    public static string Normalize(string? raw) => LabelCodeParser.Parse(raw).Code;

    /// <summary>
    /// Looks the label up in the current location first: a device transferred from Turkey to Dubai keeps its
    /// Turkish label and is still found. Only an unknown label is checked against the other locations, so the
    /// user is told "this label belongs to Staras TR" instead of a bare "not found".
    /// </summary>
    public async Task<LabelTarget?> ResolveAsync(string? raw)
    {
        var parsed = Parse(raw);
        var target = await labelRepository.FindTargetByCodeAsync(parsed.Code);
        if (target is null)
        {
            await EnsureNotForeignAsync(parsed);
        }

        return target;
    }

    /// <summary>Links a label to a device (preferred) or, for quantity-tracked items, to the equipment.</summary>
    public async Task<EquipmentLabel> AssignAsync(string? raw, LabelType type, Guid? equipmentId, Guid? unitId)
    {
        var parsed = Parse(raw);
        await EnsureNotForeignAsync(parsed);

        if (equipmentId is null && unitId is null)
        {
            throw new BusinessException(StageTrackErrorCodes.LabelTargetRequired);
        }

        await EnsureFreeAsync(parsed.Code);

        if (unitId.HasValue)
        {
            var unit = await unitRepository.GetAsync(unitId.Value);
            return new EquipmentLabel(Guid.CreateVersion7(), parsed.Code, raw!.Trim(), type, unit.EquipmentId, unit.Id);
        }

        var equipment = await equipmentRepository.GetAsync(equipmentId!.Value);
        return new EquipmentLabel(Guid.CreateVersion7(), parsed.Code, raw!.Trim(), type, equipment.Id, null);
    }

    /// <summary>
    /// A new label printed by this system, in the same JSON format as Rentman's
    /// (<c>{"ID":"80000001","cmpID":16,"isCase":0}</c>), so every scanner and phone reads old and new labels alike.
    /// </summary>
    public async Task<EquipmentLabel> CreateOwnLabelAsync(Equipment equipment, EquipmentUnit? unit)
    {
        var company = await companyRepository.GetAsync(currentCompany.Id!.Value);
        var workspace = company.RentmanWorkspaceId ?? 0;

        var lastNumber = (await labelRepository.GetCodesByTypeAsync(LabelType.Qr))
            .Select(code => LabelCodeParser.Parse(code))
            .Select(p => long.TryParse(p.Code.Split(':').Last(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) ? n : 0)
            .DefaultIfEmpty(FirstOwnLabelNumber - 1)
            .Max();
        var id = Math.Max(lastNumber + 1, FirstOwnLabelNumber).ToString(CultureInfo.InvariantCulture);

        var raw = $"{{\"ID\":\"{id}\",\"cmpID\":{workspace},\"isCase\":0}}";
        var code = LabelCodeParser.Parse(raw).Code;
        await EnsureFreeAsync(code);
        return new EquipmentLabel(Guid.CreateVersion7(), code, raw, LabelType.Qr, equipment.Id, unit?.Id);
    }

    private async Task EnsureFreeAsync(string code)
    {
        var existing = await labelRepository.FindTargetByCodeAsync(code);
        if (existing is not null)
        {
            var target = existing.Unit is null
                ? $"{existing.Equipment.Code} {existing.Equipment.Name}"
                : $"{existing.Equipment.Name} / {existing.Unit.InternalRef}";
            throw new BusinessException(StageTrackErrorCodes.LabelAlreadyAssigned)
                .WithData("code", code)
                .WithData("target", target);
        }
    }

    private static ParsedLabel Parse(string? raw)
    {
        var parsed = LabelCodeParser.Parse(raw);
        if (parsed.Code.Length == 0)
        {
            throw new BusinessException(StageTrackErrorCodes.LabelEmpty);
        }

        return parsed;
    }

    /// <summary>
    /// A Rentman label carries its workspace (cmpID). A label of another of our locations names that location;
    /// a foreign workspace is reported when the current location's own workspace is known.
    /// </summary>
    private async Task EnsureNotForeignAsync(ParsedLabel parsed)
    {
        if (parsed.RentmanWorkspaceId is not { } workspace || currentCompany.Id is not { } companyId)
        {
            return;
        }

        var companies = await companyRepository.GetListAsync();
        var current = companies.First(c => c.Id == companyId);
        if (current.RentmanWorkspaceId == workspace)
        {
            return;
        }

        var owner = companies.FirstOrDefault(c => c.RentmanWorkspaceId == workspace);
        if (owner is not null)
        {
            throw new BusinessException(StageTrackErrorCodes.LabelOtherCompany).WithData("company", owner.Name);
        }

        if (current.RentmanWorkspaceId is not null)
        {
            throw new BusinessException(StageTrackErrorCodes.LabelUnknownWorkspace).WithData("workspace", workspace);
        }
    }
}
