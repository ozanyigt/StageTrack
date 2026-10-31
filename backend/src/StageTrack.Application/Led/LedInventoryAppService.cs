using StageTrack.Inventory;
using StageTrack.Repositories;
using StageTrack.Session;

namespace StageTrack.Led;

public class LedInventoryAppService(
    IEquipmentLedSpecRepository specRepository,
    IEquipmentRepository equipmentRepository,
    IEquipmentFolderRepository folderRepository,
    ILedPanelFavoriteRepository favoriteRepository,
    EquipmentManager equipmentManager,
    ICurrentUser currentUser,
    IUnitOfWork unitOfWork) : ILedInventoryAppService
{
    public async Task<List<LedPanelDto>> GetPanelsAsync(GetLedCatalogInput input)
    {
        var items = await specRepository.GetPanelsAsync(await ToFilterAsync(input));
        var ids = items.Select(i => i.Equipment.Id).ToList();
        var compatible = await specRepository.GetCompatibleProcessorsAsync(ids);
        var favorites = (await favoriteRepository.GetEquipmentIdsAsync(currentUser.Id ?? Guid.Empty)).ToHashSet();
        var common = await LoadCommonAsync(items);

        return items.Select(i =>
        {
            var dto = Fill(new LedPanelDto(), i.Equipment, i.Spec, common);
            dto.PitchMm = i.Spec.PitchMm;
            dto.WidthMm = i.Spec.WidthMm;
            dto.HeightMm = i.Spec.HeightMm;
            dto.PixelWidth = i.Spec.PixelWidth;
            dto.PixelHeight = i.Spec.PixelHeight;
            dto.WattMax = i.Spec.WattMax;
            dto.WattAvg = i.Spec.WattAvg;
            dto.MaxLink = i.Spec.MaxLink;
            dto.AvgLink = i.Spec.AvgLink;
            dto.PanelType = i.Spec.PanelType;
            dto.Group = i.Spec.Group;
            dto.AngleMin = i.Spec.AngleMin;
            dto.AngleMax = i.Spec.AngleMax;
            dto.AngleStep = i.Spec.AngleStep;
            dto.CasePanelCount = i.Spec.CasePanelCount;
            dto.CaseDimensionsCm = i.Spec.CaseDimensionsCm;
            dto.CaseWeightKg = i.Spec.CaseWeightKg;
            dto.TransportKind = i.Spec.TransportKind;
            dto.MaxStack = i.Spec.MaxStack;
            dto.ReceivingCard = i.Spec.ReceivingCard;
            dto.PwmHz = i.Spec.PwmHz;
            dto.HasExclusiveProcessors = i.Spec.HasExclusiveProcessors;
            dto.CompatibleProcessorIds = compatible.GetValueOrDefault(i.Equipment.Id) ?? [];
            dto.IsFavorite = favorites.Contains(i.Equipment.Id);
            return dto;
        }).ToList();
    }

    public async Task<List<LedProcessorDto>> GetProcessorsAsync(GetLedCatalogInput input)
    {
        var items = await specRepository.GetProcessorsAsync(await ToFilterAsync(input));
        var common = await LoadCommonAsync(items);
        return items.Select(i =>
        {
            var dto = Fill(new LedProcessorDto(), i.Equipment, i.Spec, common);
            dto.TotalPixels = i.Spec.TotalPixels;
            dto.EthernetPorts = i.Spec.EthernetPorts;
            dto.PixelsPerPort = i.Spec.PixelsPerPort;
            dto.OptPorts = i.Spec.OptPorts;
            return dto;
        }).ToList();
    }

    public async Task<List<LedExtenderDto>> GetExtendersAsync(GetLedCatalogInput input)
    {
        var items = await specRepository.GetExtendersAsync(await ToFilterAsync(input));
        var common = await LoadCommonAsync(items);
        return items.Select(i =>
        {
            var dto = Fill(new LedExtenderDto(), i.Equipment, i.Spec, common);
            dto.EthernetPorts = i.Spec.EthernetPorts;
            dto.FiberPorts = i.Spec.FiberPorts;
            dto.MaxPixels = i.Spec.MaxPixels;
            return dto;
        }).ToList();
    }

    public async Task<LedPanelDto> SavePanelAsync(Guid equipmentId, LedPanelInput input)
    {
        var equipment = await equipmentRepository.GetAsync(equipmentId);
        var spec = await GetOrCreateAsync<LedPanelSpec>(equipmentId, () => new LedPanelSpec(Guid.CreateVersion7(), equipmentId));

        spec.SetGeometry(input.PitchMm, input.WidthMm, input.HeightMm, input.PixelWidth, input.PixelHeight);
        spec.SetPower(input.WattMax, input.WattAvg, input.MaxLink, input.AvgLink);
        spec.SetShape(input.PanelType, input.Group);
        spec.SetAngles(input.AngleMin, input.AngleMax, input.AngleStep);
        spec.SetTransport(input.TransportKind, input.CasePanelCount, input.CaseDimensionsCm, input.CaseWeightKg, input.MaxStack);
        spec.SetInfo(input.ReceivingCard, input.PwmHz);

        var processors = await ResolveProcessorsAsync(input.HasExclusiveProcessors ? input.CompatibleProcessorIds : []);
        await SyncCompatibleProcessorsAsync(equipment, processors);
        spec.SetExclusiveProcessors(input.HasExclusiveProcessors, processors.Count);

        await unitOfWork.SaveChangesAsync();
        return (await GetPanelsAsync(new GetLedCatalogInput { IncludeArchived = true })).First(p => p.EquipmentId == equipmentId);
    }

    public async Task<LedProcessorDto> SaveProcessorAsync(Guid equipmentId, LedProcessorInput input)
    {
        await equipmentRepository.GetAsync(equipmentId);
        var spec = await GetOrCreateAsync<LedProcessorSpec>(equipmentId, () => new LedProcessorSpec(Guid.CreateVersion7(), equipmentId));
        spec.Set(input.TotalPixels, input.EthernetPorts, input.PixelsPerPort, input.OptPorts);
        await unitOfWork.SaveChangesAsync();
        return (await GetProcessorsAsync(new GetLedCatalogInput { IncludeArchived = true })).First(p => p.EquipmentId == equipmentId);
    }

    public async Task<LedExtenderDto> SaveExtenderAsync(Guid equipmentId, LedExtenderInput input)
    {
        await equipmentRepository.GetAsync(equipmentId);
        var spec = await GetOrCreateAsync<LedExtenderSpec>(equipmentId, () => new LedExtenderSpec(Guid.CreateVersion7(), equipmentId));
        spec.Set(input.EthernetPorts, input.FiberPorts, input.MaxPixels);
        await unitOfWork.SaveChangesAsync();
        return (await GetExtendersAsync(new GetLedCatalogInput { IncludeArchived = true })).First(e => e.EquipmentId == equipmentId);
    }

    public async Task RemoveAsync(Guid equipmentId)
    {
        var spec = await specRepository.FindByEquipmentAsync(equipmentId);
        if (spec is null)
        {
            return;
        }

        // The panel's processor links go with it; the equipment record and its stock stay as they are.
        var equipment = await equipmentRepository.GetAsync(equipmentId);
        await SyncCompatibleProcessorsAsync(equipment, []);
        await specRepository.DeleteAsync(spec);
        await unitOfWork.SaveChangesAsync();
    }

    public async Task SetFavoriteAsync(Guid equipmentId, bool favorite)
    {
        var userId = currentUser.Id ?? throw new BusinessException(StageTrackErrorCodes.Unauthorized);
        var existing = await favoriteRepository.FindAsync(userId, equipmentId);
        if (favorite && existing is null)
        {
            await favoriteRepository.InsertAsync(new LedPanelFavorite(Guid.CreateVersion7(), userId, equipmentId));
        }
        else if (!favorite && existing is not null)
        {
            await favoriteRepository.DeleteAsync(existing);
        }

        await unitOfWork.SaveChangesAsync();
    }

    private async Task<TSpec> GetOrCreateAsync<TSpec>(Guid equipmentId, Func<TSpec> create) where TSpec : EquipmentLedSpec
    {
        var existing = await specRepository.FindByEquipmentAsync(equipmentId);
        if (existing is null)
        {
            var spec = create();
            await specRepository.InsertAsync(spec);
            return spec;
        }

        // The role is the row's type: a panel does not become a processor, it is removed and added again.
        return existing as TSpec ?? throw new BusinessException(StageTrackErrorCodes.LedSpecWrongRole).WithData("role", existing.Role);
    }

    /// <summary>The chosen processors, refusing anything that is not a processor of this inventory.</summary>
    private async Task<List<Guid>> ResolveProcessorsAsync(IReadOnlyCollection<Guid> ids)
    {
        if (ids.Count == 0)
        {
            return [];
        }

        var specs = await specRepository.GetListByEquipmentAsync(ids);
        var processors = specs.Where(s => s.Role == LedRole.Processor).Select(s => s.EquipmentId).ToList();
        return processors.Count == ids.Distinct().Count()
            ? processors
            : throw new BusinessException(StageTrackErrorCodes.LedNotAProcessor);
    }

    /// <summary>The panel's processor links, as equipment relations, so they live where every other link lives.</summary>
    private async Task SyncCompatibleProcessorsAsync(Equipment equipment, IReadOnlyCollection<Guid> processorIds)
    {
        var current = equipment.Relations.Where(r => r.Kind == EquipmentRelationKind.CompatibleProcessor).ToList();
        foreach (var gone in current.Where(r => !processorIds.Contains(r.RelatedEquipmentId)))
        {
            equipment.RemoveRelation(gone.Id);
        }

        foreach (var added in processorIds.Where(id => current.All(r => r.RelatedEquipmentId != id)))
        {
            await equipmentManager.AddRelationAsync(equipment, EquipmentRelationKind.CompatibleProcessor, added, 1);
        }
    }

    private async Task<LedCatalogFilter> ToFilterAsync(GetLedCatalogInput input) => new()
    {
        Text = input.Text,
        Group = input.Group,
        IncludeArchived = input.IncludeArchived,
        FolderIds = input.FolderId is null ? null : [input.FolderId.Value],
    };

    private record CommonData(Dictionary<Guid, int> Stock, Dictionary<Guid, string> Folders);

    private async Task<CommonData> LoadCommonAsync<TSpec>(IReadOnlyCollection<LedItem<TSpec>> items) where TSpec : EquipmentLedSpec
    {
        var ids = items.Select(i => i.Equipment.Id).ToList();
        return new CommonData(
            await equipmentRepository.GetStockQuantitiesAsync(ids),
            (await folderRepository.GetListAsync()).ToDictionary(f => f.Id, f => f.Name));
    }

    private static TDto Fill<TDto>(TDto dto, Equipment equipment, EquipmentLedSpec spec, CommonData common) where TDto : LedItemDto
    {
        dto.EquipmentId = equipment.Id;
        dto.Role = spec.Role;
        dto.Code = equipment.Code;
        dto.Name = equipment.Name;
        dto.Brand = equipment.Brand;
        dto.Model = equipment.Model;
        dto.FolderName = equipment.FolderId is { } folderId ? common.Folders.GetValueOrDefault(folderId) : null;
        dto.WeightKg = equipment.WeightKg;
        dto.IsArchived = equipment.IsArchived;
        dto.Stock = common.Stock.GetValueOrDefault(equipment.Id);
        return dto;
    }
}
