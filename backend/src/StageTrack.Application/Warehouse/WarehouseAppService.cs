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
    ProjectManager projectManager,
    ICurrentUser currentUser) : IWarehouseAppService
{
    public async Task<ScanResultDto> ScanAsync(ScanInput input)
    {
        var project = await projectRepository.GetAsync(input.ProjectId);
        var (outcome, movement) = await warehouseManager.ScanAsync(project, input.Code, input.Direction, currentUser.Id, input.AllowUnplanned);
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

    private static readonly ProjectStatus[] WarehouseStatuses = [ProjectStatus.Prepped, ProjectStatus.OnLocation, ProjectStatus.Returned];

    public async Task<ScanSheetDto> SetProjectStatusAsync(Guid projectId, SetWarehouseProjectStatusInput input)
    {
        if (!WarehouseStatuses.Contains(input.Status))
        {
            throw new BusinessException(StageTrackErrorCodes.Forbidden);
        }

        var project = await projectRepository.GetAsync(projectId);
        await projectManager.ChangeStatusAsync(project, input.Status);
        return await GetScanSheetAsync(projectId);
    }

    public async Task<ScanSheetDto> GetScanSheetAsync(Guid projectId)
    {
        var project = await projectRepository.GetAsync(projectId);
        var customer = project.CustomerId.HasValue ? await customerRepository.FindAsync(project.CustomerId.Value) : null;
        var balances = (await movementRepository.GetBalancesAsync(projectId)).ToDictionary(b => b.EquipmentId);
        var unitsOut = (await unitRepository.GetListOutOnProjectAsync(projectId)).ToLookup(u => u.EquipmentId);
        var returnedUnits = (await movementRepository.GetPagedListAsync(new MovementFilter { ProjectId = projectId }, 0, 5000))
            .Where(m => m.Movement.Action == MovementAction.CheckIn && m.Movement.UnitId.HasValue)
            .GroupBy(m => m.Movement.EquipmentId)
            .ToDictionary(g => g.Key, g => g.GroupBy(m => m.Movement.UnitId!.Value).Select(x => x.First()).ToList());
        var equipment = (await equipmentRepository.GetListByIdsAsync(project.Equipment.Select(e => e.EquipmentId).Distinct())).ToDictionary(e => e.Id);
        var outline = project.GetSectionOutline();
        var sectionOrder = outline.Select((o, i) => (o.Section.Id, i)).ToDictionary(x => x.Id, x => x.i);

        // Lines in display order: sections as on the quote, the case line followed by its content.
        var ordered = new List<ProjectEquipment>();
        foreach (var top in project.Equipment.Where(e => e.ParentLineId == null)
                     .OrderBy(e => e.SectionId is null ? -1 : sectionOrder.GetValueOrDefault(e.SectionId.Value, int.MaxValue))
                     .ThenBy(e => e.SortOrder))
        {
            ordered.Add(top);
            ordered.AddRange(project.Equipment.Where(e => e.ParentLineId == top.Id).OrderBy(e => e.SortOrder));
        }

        // An equipment's scans are spread over its lines: planned lines first, the warehouse's extra lines last.
        var remainingOut = balances.ToDictionary(b => b.Key, b => b.Value.CheckedOut);
        var remainingIn = balances.ToDictionary(b => b.Key, b => b.Value.CheckedIn);
        var unitQueue = unitsOut.ToDictionary(g => g.Key, g => new Queue<Inventory.EquipmentUnit>(g.OrderBy(u => u.InternalRef)));
        var returnedQueue = returnedUnits.ToDictionary(g => g.Key, g => new Queue<MovementListItem>(g.Value));
        var lines = new List<ScanSheetLineDto>();
        foreach (var line in ordered.OrderBy(l => l.IsExtra).ToList())
        {
            if (!equipment.TryGetValue(line.EquipmentId, out var item))
            {
                continue;
            }

            var outCount = Math.Min(line.Quantity, remainingOut.GetValueOrDefault(line.EquipmentId));
            remainingOut[line.EquipmentId] = remainingOut.GetValueOrDefault(line.EquipmentId) - outCount;
            var inCount = Math.Min(outCount, remainingIn.GetValueOrDefault(line.EquipmentId));
            remainingIn[line.EquipmentId] = remainingIn.GetValueOrDefault(line.EquipmentId) - inCount;

            var dto = new ScanSheetLineDto
            {
                LineId = line.Id, ParentLineId = line.ParentLineId, SectionId = line.SectionId, EquipmentId = item.Id,
                Code = item.Code, Name = item.Name, IsSerialized = item.IsSerialized, IsExtra = line.IsExtra,
                Planned = line.Quantity, Out = outCount, Returned = inCount
            };
            if (unitQueue.TryGetValue(item.Id, out var queue))
            {
                while (dto.UnitsOut.Count < outCount - inCount && queue.Count > 0)
                {
                    var unit = queue.Dequeue();
                    dto.UnitsOut.Add(new ScanSheetUnitDto { UnitId = unit.Id, InternalRef = unit.InternalRef, SerialNumber = unit.SerialNumber });
                }
            }

            if (returnedQueue.TryGetValue(item.Id, out var returned))
            {
                while (dto.UnitsReturned.Count < inCount && returned.Count > 0)
                {
                    var m = returned.Dequeue();
                    dto.UnitsReturned.Add(new ScanSheetUnitDto { UnitId = m.Movement.UnitId!.Value, InternalRef = m.UnitInternalRef ?? "?", SerialNumber = m.UnitSerialNumber });
                }
            }

            lines.Add(dto);
        }

        var index = ordered.Select((l, i) => (l.Id, i)).ToDictionary(x => x.Id, x => x.i);
        return new ScanSheetDto
        {
            ProjectId = project.Id,
            Number = project.Number,
            Name = project.Name,
            Status = project.Status,
            CustomerName = customer?.Name,
            Venue = project.Venue,
            PlanStart = project.PlanStart,
            PlanEnd = project.PlanEnd,
            AllowedStatuses = ProjectStatusRules.GetAllowedTargets(project.Status).Where(WarehouseStatuses.Contains).ToList(),
            Sections = outline.Select(o => new ScanSheetSectionDto
            {
                Id = o.Section.Id, ParentId = o.Section.ParentId, Name = o.Section.Name, Depth = o.Depth, IsWarehouseExtras = o.Section.IsWarehouseExtras
            }).ToList(),
            Lines = lines.OrderBy(l => index[l.LineId]).ToList()
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
