using StageTrack.Customers;
using StageTrack.Dtos;
using StageTrack.Inventory;
using StageTrack.Repositories;
using StageTrack.Warehouse;

namespace StageTrack.Projects;

public class ProjectAppService(
    IProjectRepository projectRepository,
    IEquipmentRepository equipmentRepository,
    ICustomerRepository customerRepository,
    IStockLocationRepository locationRepository,
    IWarehouseMovementRepository movementRepository,
    ProjectManager projectManager,
    AvailabilityManager availabilityManager,
    IUnitOfWork unitOfWork) : IProjectAppService
{
    public async Task<PagedResultDto<ProjectListItemDto>> GetListAsync(GetProjectListInput input)
    {
        var filter = new ProjectFilter
        {
            Text = input.Text, Statuses = input.Statuses, From = input.From, To = input.To, CustomerId = input.CustomerId
        };

        var total = await projectRepository.GetCountAsync(filter);
        var items = await projectRepository.GetPagedListAsync(filter, input.Sorting, input.SkipCount, input.MaxResultCount);
        return new PagedResultDto<ProjectListItemDto>(total, items.Select(x => x.ToDto()).ToList());
    }

    public async Task<ProjectDto> GetAsync(Guid id) => await BuildDtoAsync(await projectRepository.GetAsync(id));

    public async Task<ProjectDto> CreateAsync(CreateUpdateProjectDto input)
    {
        var project = await projectManager.CreateAsync(input.Name, input.PlanStart, input.PlanEnd);
        Apply(project, input);
        await projectRepository.InsertAsync(project);
        await unitOfWork.SaveChangesAsync();
        return await BuildDtoAsync(project);
    }

    public async Task<ProjectDto> UpdateAsync(Guid id, CreateUpdateProjectDto input)
    {
        var project = await projectRepository.GetAsync(id);
        Apply(project, input);
        await unitOfWork.SaveChangesAsync();
        return await BuildDtoAsync(project);
    }

    public async Task DeleteAsync(Guid id)
    {
        var project = await projectRepository.GetAsync(id);
        projectManager.EnsureCanDelete(project);
        await projectRepository.DeleteAsync(project);
    }

    public async Task<ProjectDto> ChangeStatusAsync(Guid id, ChangeProjectStatusInput input)
    {
        var project = await projectRepository.GetAsync(id);
        await projectManager.ChangeStatusAsync(project, input.Status);
        await unitOfWork.SaveChangesAsync();
        return await BuildDtoAsync(project);
    }

    public async Task<ProjectDto> AddEquipmentAsync(Guid id, AddProjectEquipmentInput input)
    {
        var project = await projectRepository.GetAsync(id);
        await projectManager.AddEquipmentAsync(project, input.EquipmentId, input.Quantity);
        await unitOfWork.SaveChangesAsync();
        return await BuildDtoAsync(project);
    }

    public async Task<ProjectDto> UpdateEquipmentAsync(Guid id, Guid lineId, UpdateProjectEquipmentInput input)
    {
        var project = await projectRepository.GetAsync(id);
        project.UpdateEquipment(lineId, input.Quantity, input.Notes);
        await unitOfWork.SaveChangesAsync();
        return await BuildDtoAsync(project);
    }

    public async Task<ProjectDto> RemoveEquipmentAsync(Guid id, Guid lineId)
    {
        var project = await projectRepository.GetAsync(id);
        project.RemoveEquipment(lineId);
        await unitOfWork.SaveChangesAsync();
        return await BuildDtoAsync(project);
    }

    private static void Apply(Project project, CreateUpdateProjectDto input)
    {
        project.Update(input.Name.Trim(), input.CustomerId, input.Venue, input.Color, input.ProjectType, input.StockLocationId, input.Notes);
        project.SetPlanPeriod(input.PlanStart, input.PlanEnd);
        project.SetUsePeriod(input.UseStart, input.UseEnd);
    }

    private async Task<ProjectDto> BuildDtoAsync(Project project)
    {
        var customer = project.CustomerId.HasValue ? await customerRepository.FindAsync(project.CustomerId.Value) : null;
        var location = project.StockLocationId.HasValue ? await locationRepository.FindAsync(project.StockLocationId.Value) : null;
        var equipment = (await equipmentRepository.GetListByIdsAsync(project.Equipment.Select(e => e.EquipmentId))).ToDictionary(e => e.Id);
        var availability = await availabilityManager.GetForProjectAsync(project);
        var balances = (await movementRepository.GetBalancesAsync(project.Id)).ToDictionary(b => b.EquipmentId);

        var dto = new ProjectDto().FillProject(project, customer?.Name, location?.Name, project.Equipment.Sum(e => e.Quantity));
        dto.Notes = project.Notes;
        dto.RentalDays = project.RentalDays;
        dto.IsEditable = project.IsEditable;
        dto.AllowedStatuses = ProjectStatusRules.GetAllowedTargets(project.Status).ToList();
        dto.Equipment = project.Equipment
            .OrderBy(e => e.SortOrder)
            .Select(line =>
            {
                var item = equipment[line.EquipmentId];
                var available = availability[line.EquipmentId];
                var balance = balances.GetValueOrDefault(line.EquipmentId);
                return new ProjectEquipmentDto
                {
                    Id = line.Id,
                    EquipmentId = item.Id,
                    EquipmentCode = item.Code,
                    EquipmentName = item.Name,
                    IsSerialized = item.IsSerialized,
                    RentalPrice = item.RentalPrice,
                    Quantity = line.Quantity,
                    Notes = line.Notes,
                    Stock = available.Stock,
                    PlannedElsewhere = available.PlannedElsewhere,
                    Available = available.Available,
                    Shortage = AvailabilityManager.GetShortage(line, available),
                    OutQuantity = balance?.Out ?? 0,
                    ReturnedQuantity = balance?.CheckedIn ?? 0
                };
            })
            .ToList();
        dto.ShortageCount = dto.Equipment.Count(e => e.Shortage > 0);
        return dto;
    }
}
