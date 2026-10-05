using StageTrack.Dtos;
using StageTrack.Inventory;
using StageTrack.Repositories;

namespace StageTrack.Maintenance;

public class RepairAppService(
    IRepairRepository repairRepository,
    IEquipmentRepository equipmentRepository,
    IEquipmentUnitRepository unitRepository,
    RepairManager repairManager,
    IUnitOfWork unitOfWork) : IRepairAppService
{
    public async Task<PagedResultDto<RepairDto>> GetListAsync(GetRepairListInput input)
    {
        var filter = new RepairFilter
        {
            Text = input.Text, EquipmentId = input.EquipmentId, UnitId = input.UnitId, Status = input.Status, OnlyOpen = input.OnlyOpen
        };

        var total = await repairRepository.GetCountAsync(filter);
        var items = await repairRepository.GetPagedListAsync(filter, input.SkipCount, input.MaxResultCount);
        return new PagedResultDto<RepairDto>(total, items.Select(x => x.ToDto()).ToList());
    }

    public async Task<RepairDto> CreateAsync(CreateRepairInput input)
    {
        var equipment = await equipmentRepository.GetAsync(input.EquipmentId, includeDetails: false);
        var unit = input.UnitId.HasValue ? await unitRepository.GetAsync(input.UnitId.Value) : null;
        var repair = await repairManager.CreateAsync(equipment, unit, input.Quantity, input.Title, DateTime.Now);
        repair.Update(input.Title.Trim(), input.Description, input.SupplierId, input.Cost);
        await repairRepository.InsertAsync(repair);
        await unitOfWork.SaveChangesAsync();
        return await GetDtoAsync(repair.Id);
    }

    public async Task<RepairDto> UpdateAsync(Guid id, UpdateRepairInput input)
    {
        var repair = await repairRepository.GetAsync(id);
        repair.Update(input.Title.Trim(), input.Description, input.SupplierId, input.Cost);
        await unitOfWork.SaveChangesAsync();
        return await GetDtoAsync(id);
    }

    public async Task<RepairDto> ChangeStatusAsync(Guid id, ChangeRepairStatusInput input)
    {
        var repair = await repairRepository.GetAsync(id);
        await repairManager.ChangeStatusAsync(repair, input.Status, DateTime.Now);
        await unitOfWork.SaveChangesAsync();
        return await GetDtoAsync(id);
    }

    private async Task<RepairDto> GetDtoAsync(Guid id)
    {
        var repair = await repairRepository.GetAsync(id);
        var item = (await repairRepository.GetPagedListAsync(new RepairFilter { EquipmentId = repair.EquipmentId, UnitId = repair.UnitId }, 0, 500))
            .First(x => x.Repair.Id == id);
        return item.ToDto();
    }
}

public class InspectionAppService(
    IUnitInspectionRepository inspectionRepository,
    IEquipmentRepository equipmentRepository,
    IEquipmentUnitRepository unitRepository,
    InspectionManager inspectionManager,
    IUnitOfWork unitOfWork) : IInspectionAppService
{
    public async Task<List<InspectionDto>> GetListAsync(Guid? equipmentId, Guid? unitId) =>
        (await inspectionRepository.GetListAsync(equipmentId, unitId, 200)).Select(ToDto).ToList();

    public async Task<InspectionDto> RecordAsync(RecordInspectionInput input)
    {
        var unit = await unitRepository.GetAsync(input.UnitId);
        var equipment = await equipmentRepository.GetAsync(unit.EquipmentId, includeDetails: false);
        var inspection = inspectionManager.Record(equipment, unit, input.Date.Date, input.Passed, input.Notes);
        await inspectionRepository.InsertAsync(inspection);
        await unitOfWork.SaveChangesAsync();
        return (await inspectionRepository.GetListAsync(null, unit.Id, 50)).Select(ToDto).First(i => i.Id == inspection.Id);
    }

    private static InspectionDto ToDto(InspectionListItem x) => new()
    {
        Id = x.Inspection.Id,
        UnitId = x.Inspection.UnitId,
        UnitInternalRef = x.UnitInternalRef,
        Date = x.Inspection.Date,
        Passed = x.Inspection.Passed,
        Notes = x.Inspection.Notes,
        InspectorName = x.InspectorName
    };
}
