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
    /// <summary>The lookup key for any scanned text; see <see cref="LabelCodeParser"/>.</summary>
    public static string Normalize(string? raw) => LabelCodeParser.Parse(raw).Code;

    public async Task<LabelTarget?> ResolveAsync(string? raw)
    {
        var parsed = Parse(raw);
        await EnsureSameWorkspaceAsync(parsed);
        return await labelRepository.FindTargetByCodeAsync(parsed.Code);
    }

    /// <summary>Links a label to a device (preferred) or, for quantity-tracked items, to the equipment.</summary>
    public async Task<EquipmentLabel> AssignAsync(string? raw, LabelType type, Guid? equipmentId, Guid? unitId)
    {
        var parsed = Parse(raw);
        await EnsureSameWorkspaceAsync(parsed);

        if (equipmentId is null && unitId is null)
        {
            throw new BusinessException(StageTrackErrorCodes.LabelTargetRequired);
        }

        var existing = await labelRepository.FindTargetByCodeAsync(parsed.Code);
        if (existing is not null)
        {
            var target = existing.Unit is null
                ? $"{existing.Equipment.Code} {existing.Equipment.Name}"
                : $"{existing.Equipment.Name} / {existing.Unit.InternalRef}";
            throw new BusinessException(StageTrackErrorCodes.LabelAlreadyAssigned)
                .WithData("code", parsed.Code)
                .WithData("target", target);
        }

        if (unitId.HasValue)
        {
            var unit = await unitRepository.GetAsync(unitId.Value);
            return new EquipmentLabel(Guid.CreateVersion7(), parsed.Code, raw!.Trim(), type, unit.EquipmentId, unit.Id);
        }

        var equipment = await equipmentRepository.GetAsync(equipmentId!.Value);
        return new EquipmentLabel(Guid.CreateVersion7(), parsed.Code, raw!.Trim(), type, equipment.Id, null);
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
    /// A Rentman label carries its workspace (cmpID). Scanning a Turkish label while working in Dubai (or the
    /// other way round) must not link it to the wrong company's device:
    /// a label of another of our companies names that company; a foreign workspace is reported when the current
    /// company's own workspace is known.
    /// </summary>
    private async Task EnsureSameWorkspaceAsync(ParsedLabel parsed)
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
