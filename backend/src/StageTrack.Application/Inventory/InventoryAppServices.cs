using StageTrack.Dtos;
using StageTrack.Projects;
using StageTrack.Repositories;
using StageTrack.Session;
using StageTrack.Warehouse;

namespace StageTrack.Inventory;

public class EquipmentFolderAppService(
    IEquipmentFolderRepository folderRepository,
    EquipmentFolderManager folderManager) : IEquipmentFolderAppService
{
    public async Task<List<EquipmentFolderDto>> GetListAsync() =>
        (await folderRepository.GetListAsync()).Select(f => f.ToDto()).ToList();

    public async Task<EquipmentFolderDto> CreateAsync(CreateUpdateEquipmentFolderDto input)
    {
        var folder = await folderManager.CreateAsync(input.Name, input.ParentId);
        await folderRepository.InsertAsync(folder);
        return folder.ToDto();
    }

    public async Task<EquipmentFolderDto> UpdateAsync(Guid id, CreateUpdateEquipmentFolderDto input)
    {
        var folder = await folderRepository.GetAsync(id);
        folder.Rename(input.Name.Trim());
        await folderManager.MoveAsync(folder, input.ParentId);
        return folder.ToDto();
    }

    public async Task DeleteAsync(Guid id)
    {
        var folder = await folderRepository.GetAsync(id);
        await folderManager.EnsureCanDeleteAsync(folder);
        await folderRepository.DeleteAsync(folder);
    }
}

public class EquipmentAppService(
    IEquipmentRepository equipmentRepository,
    IEquipmentUnitRepository unitRepository,
    IEquipmentLabelRepository labelRepository,
    EquipmentManager equipmentManager,
    EquipmentFolderManager folderManager,
    AvailabilityManager availabilityManager,
    IUnitOfWork unitOfWork) : IEquipmentAppService
{
    public async Task<PagedResultDto<EquipmentDto>> GetListAsync(GetEquipmentListInput input)
    {
        var filter = new EquipmentFilter
        {
            Text = input.Text,
            Type = input.Type,
            IsArchived = input.IsArchived,
            FolderIds = input.FolderId is null
                ? null
                : input.IncludeSubfolders ? await folderManager.GetSubtreeIdsAsync(input.FolderId.Value) : [input.FolderId.Value]
        };

        var total = await equipmentRepository.GetCountAsync(filter);
        var items = await equipmentRepository.GetPagedListAsync(filter, input.Sorting, input.SkipCount, input.MaxResultCount);
        var stock = await equipmentRepository.GetStockQuantitiesAsync(items.Select(e => e.Id).ToList());
        return new PagedResultDto<EquipmentDto>(total, items.Select(e => e.ToDto(stock.GetValueOrDefault(e.Id))).ToList());
    }

    public async Task<EquipmentDetailDto> GetAsync(Guid id)
    {
        var equipment = await equipmentRepository.GetAsync(id);
        var stock = await equipmentRepository.GetStockQuantitiesAsync([id]);
        var dto = new EquipmentDetailDto().FillEquipment(equipment, stock.GetValueOrDefault(id));
        dto.StockQuantity = equipment.StockQuantity;
        dto.Labels = (await labelRepository.GetListByEquipmentAsync(id)).Where(l => l.UnitId is null).Select(l => l.ToDto()).ToList();
        dto.UnitStatusCounts = await unitRepository.GetStatusCountsAsync(id);
        return dto;
    }

    public async Task<List<EquipmentLookupDto>> GetLookupAsync(string? text) =>
        (await equipmentRepository.SearchAsync(text, 30)).Select(e => e.ToLookupDto()).ToList();

    public async Task<EquipmentDto> CreateAsync(CreateUpdateEquipmentDto input)
    {
        var equipment = await equipmentManager.CreateAsync(input.Code, input.Name, input.Type, input.IsSerialized);
        Apply(equipment, input);
        await equipmentRepository.InsertAsync(equipment);
        return equipment.ToDto(equipment.IsSerialized ? 0 : equipment.StockQuantity);
    }

    public async Task<EquipmentDto> UpdateAsync(Guid id, CreateUpdateEquipmentDto input)
    {
        var equipment = await equipmentRepository.GetAsync(id);
        await equipmentManager.ChangeCodeAsync(equipment, input.Code);
        await equipmentManager.SetSerializedAsync(equipment, input.IsSerialized);
        Apply(equipment, input);
        await unitOfWork.SaveChangesAsync();

        var stock = await equipmentRepository.GetStockQuantitiesAsync([id]);
        return equipment.ToDto(stock.GetValueOrDefault(id));
    }

    public async Task ArchiveAsync(Guid id) => await equipmentManager.ArchiveAsync(await equipmentRepository.GetAsync(id));

    public async Task RestoreAsync(Guid id) => (await equipmentRepository.GetAsync(id)).Restore();

    public async Task<List<EquipmentAvailabilityDto>> GetAvailabilityAsync(GetAvailabilityInput input)
    {
        var availability = await availabilityManager.GetAsync(input.EquipmentIds, input.Start, input.End, input.ExcludeProjectId);
        return availability.Values.Select(a => new EquipmentAvailabilityDto
        {
            EquipmentId = a.EquipmentId, Stock = a.Stock, PlannedElsewhere = a.PlannedElsewhere, Available = a.Available
        }).ToList();
    }

    private static void Apply(Equipment equipment, CreateUpdateEquipmentDto input)
    {
        equipment.Update(input.Name.Trim(), input.Brand, input.Model, input.FolderId, input.Type, input.WeightKg, input.VolumeM3, input.Notes);
        equipment.SetRentalPrice(input.RentalPrice);
        equipment.SetStockQuantity(input.StockQuantity);
    }
}

public class EquipmentUnitAppService(
    IEquipmentUnitRepository unitRepository,
    IEquipmentRepository equipmentRepository,
    IEquipmentLabelRepository labelRepository,
    EquipmentUnitManager unitManager,
    LabelManager labelManager,
    IUnitOfWork unitOfWork) : IEquipmentUnitAppService
{
    public async Task<PagedResultDto<EquipmentUnitDto>> GetListAsync(GetEquipmentUnitListInput input)
    {
        var filter = new EquipmentUnitFilter
        {
            Text = input.Text, EquipmentId = input.EquipmentId, Status = input.Status, StockLocationId = input.StockLocationId
        };

        var total = await unitRepository.GetCountAsync(filter);
        var items = await unitRepository.GetPagedListAsync(filter, input.SkipCount, input.MaxResultCount);
        return new PagedResultDto<EquipmentUnitDto>(total, items.Select(x => x.ToDto()).ToList());
    }

    public async Task<EquipmentUnitDto> CreateAsync(CreateEquipmentUnitDto input)
    {
        var equipment = await equipmentRepository.GetAsync(input.EquipmentId);
        var unit = await unitManager.CreateAsync(equipment, input.InternalRef, input.SerialNumber, input.StockLocationId);
        unit.Update(unit.SerialNumber, input.StockLocationId, input.Notes);
        await unitRepository.InsertAsync(unit);

        if (!string.IsNullOrWhiteSpace(input.LabelCode))
        {
            await unitOfWork.SaveChangesAsync();
            await labelRepository.InsertAsync(await labelManager.AssignAsync(input.LabelCode, LabelType.RentmanQr, null, unit.Id));
        }

        return unit.ToDto(equipment);
    }

    public async Task<EquipmentUnitDto> UpdateAsync(Guid id, UpdateEquipmentUnitDto input)
    {
        var unit = await unitRepository.GetAsync(id);
        await unitManager.ChangeInternalRefAsync(unit, input.InternalRef);
        unit.Update(input.SerialNumber?.Trim(), input.StockLocationId, input.Notes);
        return unit.ToDto(await equipmentRepository.GetAsync(unit.EquipmentId));
    }

    public async Task ChangeStatusAsync(Guid id, ChangeUnitStatusInput input) =>
        unitManager.ChangeStatus(await unitRepository.GetAsync(id), input.Status);

    public async Task ArchiveAsync(Guid id) => unitManager.Archive(await unitRepository.GetAsync(id));

    public async Task<List<LabelDto>> GetLabelsAsync(Guid id) =>
        (await labelRepository.GetListByUnitAsync(id)).Select(l => l.ToDto()).ToList();
}

public class LabelAppService(
    IEquipmentLabelRepository labelRepository,
    IEquipmentRepository equipmentRepository,
    IEquipmentUnitRepository unitRepository,
    IWarehouseMovementRepository movementRepository,
    LabelManager labelManager,
    WarehouseManager warehouseManager,
    ICurrentUser currentUser) : ILabelAppService
{
    public async Task<ResolveLabelResultDto> ResolveAsync(string code)
    {
        var target = await labelManager.ResolveAsync(code);
        if (target is null)
        {
            return new ResolveLabelResultDto { Found = false, Code = LabelManager.Normalize(code) };
        }

        var stock = await equipmentRepository.GetStockQuantitiesAsync([target.Equipment.Id]);
        EquipmentUnitDto? unit = null;
        if (target.Unit is not null)
        {
            unit = (await unitRepository.GetListItemAsync(target.Unit.Id))?.ToDto() ?? target.Unit.ToDto(target.Equipment);
        }

        return new ResolveLabelResultDto
        {
            Found = true,
            Code = target.Label.Code,
            Label = target.Label.ToDto(),
            Equipment = target.Equipment.ToDto(stock.GetValueOrDefault(target.Equipment.Id)),
            Unit = unit
        };
    }

    public async Task<LabelDto> AssignAsync(AssignLabelInput input)
    {
        var label = await labelManager.AssignAsync(input.Code, input.Type, input.EquipmentId, input.UnitId);
        await labelRepository.InsertAsync(label);
        await movementRepository.InsertAsync(warehouseManager.CreateLabelAssignedMovement(label, currentUser.Id));
        return label.ToDto();
    }

    public async Task DeleteAsync(Guid id) => await labelRepository.DeleteAsync(await labelRepository.GetAsync(id));
}

public class StockLocationAppService(
    IStockLocationRepository locationRepository,
    StockLocationManager locationManager) : IStockLocationAppService
{
    public async Task<List<StockLocationDto>> GetListAsync() =>
        (await locationRepository.GetListAsync()).Select(l => l.ToDto()).ToList();

    public async Task<StockLocationDto> CreateAsync(CreateUpdateStockLocationDto input)
    {
        var location = new StockLocation(Guid.CreateVersion7(), input.Name.Trim(), input.Type, input.Address, input.City);
        await locationRepository.InsertAsync(location);
        return location.ToDto();
    }

    public async Task<StockLocationDto> UpdateAsync(Guid id, CreateUpdateStockLocationDto input)
    {
        var location = await locationRepository.GetAsync(id);
        location.Update(input.Name.Trim(), input.Type, input.Address, input.City, input.IsActive);
        return location.ToDto();
    }

    public async Task DeleteAsync(Guid id)
    {
        var location = await locationRepository.GetAsync(id);
        await locationManager.EnsureCanDeleteAsync(location);
        await locationRepository.DeleteAsync(location);
    }
}
