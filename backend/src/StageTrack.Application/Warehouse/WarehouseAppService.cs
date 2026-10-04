using StageTrack.Customers;
using StageTrack.Dtos;
using StageTrack.Inventory;
using StageTrack.Projects;
using StageTrack.Session;

namespace StageTrack.Warehouse;

public class WarehouseAppService(
    IProjectRepository projectRepository,
    IEquipmentRepository equipmentRepository,
    IEquipmentUnitRepository unitRepository,
    ICustomerRepository customerRepository,
    IWarehouseMovementRepository movementRepository,
    WarehouseManager warehouseManager,
    ICurrentUser currentUser) : IWarehouseAppService
{
    public async Task<ScanResultDto> ScanAsync(ScanInput input)
    {
        var project = await projectRepository.GetAsync(input.ProjectId);
        var (outcome, movement) = await warehouseManager.ScanAsync(project, input.Code, input.Direction, currentUser.Id);
        if (movement is not null)
        {
            await movementRepository.InsertAsync(movement);
        }

        return outcome.ToDto();
    }

    public async Task<PackingListDto> GetPackingListAsync(Guid projectId)
    {
        var project = await projectRepository.GetAsync(projectId);
        var customer = project.CustomerId.HasValue ? await customerRepository.FindAsync(project.CustomerId.Value) : null;
        var balances = (await movementRepository.GetBalancesAsync(projectId)).ToDictionary(b => b.EquipmentId);
        var unitsOut = (await unitRepository.GetListOutOnProjectAsync(projectId)).ToLookup(u => u.EquipmentId);

        // Equipment that was scanned out without being planned still appears on the list.
        var equipmentIds = project.Equipment.Select(e => e.EquipmentId).Union(balances.Keys).ToList();
        var equipment = await equipmentRepository.GetListByIdsAsync(equipmentIds);
        var order = project.Equipment.ToDictionary(e => e.EquipmentId, e => e.SortOrder);

        var lines = equipment
            .OrderBy(e => order.GetValueOrDefault(e.Id, int.MaxValue))
            .ThenBy(e => e.Code)
            .Select(e => new PackingLineDto
            {
                EquipmentId = e.Id,
                EquipmentCode = e.Code,
                EquipmentName = e.Name,
                IsSerialized = e.IsSerialized,
                Planned = project.GetPlannedQuantity(e.Id),
                Out = balances.GetValueOrDefault(e.Id)?.Out ?? 0,
                Returned = balances.GetValueOrDefault(e.Id)?.CheckedIn ?? 0,
                UnitsOut = unitsOut[e.Id].Select(u => u.InternalRef).ToList()
            })
            .ToList();

        return new PackingListDto
        {
            ProjectId = project.Id,
            Number = project.Number,
            Name = project.Name,
            Status = project.Status,
            CustomerName = customer?.Name,
            Venue = project.Venue,
            PlanStart = project.PlanStart,
            PlanEnd = project.PlanEnd,
            Lines = lines,
            TotalPlanned = lines.Sum(l => l.Planned),
            TotalOut = lines.Sum(l => l.Out)
        };
    }

    public async Task<WarehouseBoardDto> GetBoardAsync(GetWarehouseBoardInput input)
    {
        var day = (input.Date ?? DateTime.Today).Date;
        var items = await projectRepository.GetPagedListAsync(
            new ProjectFilter { Statuses = WarehouseBoardRules.BoardStatuses, StockLocationId = input.StockLocationId },
            null, 0, PagedRequestDto.MaxPageSize);

        var board = new WarehouseBoardDto { Date = day };
        foreach (var item in items)
        {
            var target = WarehouseBoardRules.Classify(item.Project, day) switch
            {
                WarehouseBoardColumn.Confirmed => board.Confirmed,
                WarehouseBoardColumn.Prepped => board.Prepped,
                WarehouseBoardColumn.OnLocation => board.OnLocation,
                WarehouseBoardColumn.ExpectedBack => board.ExpectedBack,
                WarehouseBoardColumn.Delayed => board.Delayed,
                _ => null
            };
            target?.Add(item.ToDto());
        }

        return board;
    }

    public async Task<PagedResultDto<MovementDto>> GetMovementsAsync(GetMovementListInput input)
    {
        var filter = new MovementFilter
        {
            Text = input.Text, ProjectId = input.ProjectId, EquipmentId = input.EquipmentId, UnitId = input.UnitId,
            Action = input.Action, From = input.From, To = input.To
        };

        var total = await movementRepository.GetCountAsync(filter);
        var items = await movementRepository.GetPagedListAsync(filter, input.SkipCount, input.MaxResultCount);
        return new PagedResultDto<MovementDto>(total, items.Select(x => x.ToDto()).ToList());
    }
}
