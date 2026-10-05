using StageTrack.Authorization;
using StageTrack.Common;
using StageTrack.Companies;
using StageTrack.Customers;
using StageTrack.Dtos;
using StageTrack.Identity;
using StageTrack.Inventory;
using StageTrack.Permissions;
using StageTrack.Repositories;
using StageTrack.Session;
using StageTrack.Warehouse;

namespace StageTrack.Projects;

/// <summary>
/// Who may see which project: office roles see all of them; crew members ("Üye") only see confirmed
/// projects they are assigned to, read-only and without prices.
/// </summary>
public class ProjectAccess(IPermissionChecker permissionChecker, ICurrentUser currentUser)
{
    public async Task<bool> IsCrewViewAsync() =>
        !await permissionChecker.IsGrantedAsync(StageTrackPermissions.Projects.Default) &&
        await permissionChecker.IsGrantedAsync(StageTrackPermissions.Projects.Assigned);

    public async Task EnsureCanViewAsync(Project project)
    {
        if (await permissionChecker.IsGrantedAsync(StageTrackPermissions.Projects.Default))
        {
            return;
        }

        var allowed = await permissionChecker.IsGrantedAsync(StageTrackPermissions.Projects.Assigned) &&
                      project.HasCrewMember(currentUser.Id!.Value) &&
                      ProjectStatusRules.VisibleToCrew.Contains(project.Status);
        if (!allowed)
        {
            throw new EntityNotFoundException(typeof(Project), project.Id);
        }
    }

    public async Task EnsureCanListAsync()
    {
        if (!await permissionChecker.IsGrantedAsync(StageTrackPermissions.Projects.Default) &&
            !await permissionChecker.IsGrantedAsync(StageTrackPermissions.Projects.Assigned))
        {
            throw new BusinessException(StageTrackErrorCodes.Forbidden);
        }
    }
}

public class ProjectAppService(
    IProjectRepository projectRepository,
    IEquipmentRepository equipmentRepository,
    ICustomerRepository customerRepository,
    IStockLocationRepository locationRepository,
    IWarehouseMovementRepository movementRepository,
    IUserRepository userRepository,
    ICompanyRepository companyRepository,
    ProjectManager projectManager,
    AvailabilityManager availabilityManager,
    ProjectAccess access,
    PriceVisibility prices,
    ICurrentUser currentUser,
    ICurrentCompany currentCompany,
    IUnitOfWork unitOfWork) : IProjectAppService
{
    public async Task<PagedResultDto<ProjectListItemDto>> GetListAsync(GetProjectListInput input)
    {
        await access.EnsureCanListAsync();
        var filter = new ProjectFilter
        {
            Text = input.Text, Statuses = input.Statuses, From = input.From, To = input.To, CustomerId = input.CustomerId
        };

        if (await access.IsCrewViewAsync())
        {
            filter.CrewUserId = currentUser.Id;
            filter.Statuses = (input.Statuses is { Count: > 0 } ? input.Statuses.Intersect(ProjectStatusRules.VisibleToCrew) : ProjectStatusRules.VisibleToCrew).ToList();
        }

        var total = await projectRepository.GetCountAsync(filter);
        var items = await projectRepository.GetPagedListAsync(filter, input.Sorting, input.SkipCount, input.MaxResultCount);
        return new PagedResultDto<ProjectListItemDto>(total, items.Select(x => x.ToDto()).ToList());
    }

    public async Task<ProjectDto> GetAsync(Guid id)
    {
        var project = await projectRepository.GetAsync(id);
        await access.EnsureCanViewAsync(project);
        return await BuildDtoAsync(project);
    }

    public async Task<PackingSlipDto> GetPackingSlipAsync(Guid id)
    {
        var project = await projectRepository.GetAsync(id);
        await access.EnsureCanViewAsync(project);

        var equipment = (await equipmentRepository.GetListWithRelationsAsync(project.Equipment.Select(e => e.EquipmentId).ToList())).ToDictionary(e => e.Id);
        var contentIds = equipment.Values.SelectMany(e => e.Relations).Where(r => r.Kind == EquipmentRelationKind.Content).Select(r => r.RelatedEquipmentId);
        var content = (await equipmentRepository.GetListByIdsAsync(contentIds)).ToDictionary(e => e.Id);
        var company = await companyRepository.GetAsync(currentCompany.Id!.Value);
        var customer = project.CustomerId.HasValue ? await customerRepository.FindAsync(project.CustomerId.Value) : null;
        var manager = project.AccountManagerId.HasValue ? await userRepository.FindAsync(project.AccountManagerId.Value, includeDetails: false) : null;

        PackingSlipLineDto ToLine(ProjectEquipment line)
        {
            var item = equipment[line.EquipmentId];
            return new PackingSlipLineDto
            {
                Code = item.Code,
                Name = item.Name,
                Quantity = line.Quantity,
                Notes = line.Notes,
                Content = item.Relations.Where(r => r.Kind == EquipmentRelationKind.Content && content.ContainsKey(r.RelatedEquipmentId))
                    .OrderBy(r => r.SortOrder)
                    .Select(r => new PackingSlipLineDto
                    {
                        Code = content[r.RelatedEquipmentId].Code,
                        Name = content[r.RelatedEquipmentId].Name,
                        Quantity = r.Quantity * line.Quantity
                    }).ToList()
            };
        }

        var sections = new List<PackingSlipSectionDto>();
        var loose = project.Equipment.Where(e => e.SectionId is null).OrderBy(e => e.SortOrder).ToList();
        if (loose.Count > 0)
        {
            sections.Add(new PackingSlipSectionDto { Name = null, Depth = 1, Lines = loose.Select(ToLine).ToList() });
        }

        foreach (var (section, depth, _) in project.GetSectionOutline())
        {
            sections.Add(new PackingSlipSectionDto
            {
                Name = section.Name,
                Depth = depth,
                Lines = project.Equipment.Where(e => e.SectionId == section.Id).OrderBy(e => e.SortOrder).Select(ToLine).ToList()
            });
        }

        return new PackingSlipDto
        {
            ProjectId = project.Id,
            ProjectNumber = project.Number,
            ProjectName = project.Name,
            CustomerName = customer?.Name,
            Venue = project.Venue,
            AccountManagerName = manager?.FullName,
            PaymentTerms = project.PaymentTerms,
            PlanStart = project.PlanStart,
            PlanEnd = project.PlanEnd,
            UseStart = project.UseStart,
            UseEnd = project.UseEnd,
            CreatedAt = DateTime.Now,
            CompanyName = company.Name,
            Sections = sections,
            Crew = await BuildCrewAsync(project)
        };
    }

    public async Task<ProjectDto> CreateAsync(CreateUpdateProjectDto input)
    {
        var project = await projectManager.CreateAsync(input.Name, input.PlanStart, input.PlanEnd);
        Apply(project, input);
        await projectRepository.InsertAsync(project);
        await unitOfWork.SaveChangesAsync();
        return await BuildDtoAsync(project);
    }

    public Task<ProjectDto> UpdateAsync(Guid id, CreateUpdateProjectDto input) => MutateAsync(id, p =>
    {
        Apply(p, input);
        return Task.CompletedTask;
    });

    public async Task DeleteAsync(Guid id)
    {
        var project = await projectRepository.GetAsync(id);
        projectManager.EnsureCanDelete(project);
        await projectRepository.DeleteAsync(project);
    }

    public Task<ProjectDto> ChangeStatusAsync(Guid id, ChangeProjectStatusInput input) =>
        MutateAsync(id, p => projectManager.ChangeStatusAsync(p, input.Status));

    public Task<ProjectDto> AddEquipmentAsync(Guid id, AddProjectEquipmentInput input) => MutateAsync(id, async p =>
    {
        await projectManager.AddEquipmentAsync(p, input.EquipmentId, input.Quantity, input.SectionId);
        if (input.IncludeAccessories)
        {
            var equipment = await equipmentRepository.GetAsync(input.EquipmentId);
            foreach (var accessory in equipment.Relations.Where(r => r.Kind == EquipmentRelationKind.Accessory))
            {
                await projectManager.AddEquipmentAsync(p, accessory.RelatedEquipmentId, accessory.Quantity * input.Quantity, input.SectionId);
            }
        }
    });

    public Task<ProjectDto> UpdateEquipmentAsync(Guid id, Guid lineId, UpdateProjectEquipmentInput input) =>
        MutateAsync(id, p => Sync(() => p.UpdateEquipment(lineId, input.Quantity, input.Notes)));

    public Task<ProjectDto> MoveEquipmentAsync(Guid id, Guid lineId, MoveProjectEquipmentInput input) =>
        MutateAsync(id, p => Sync(() =>
        {
            if (input.Direction is { } direction)
            {
                p.MoveEquipment(lineId, direction);
            }
            else
            {
                p.MoveEquipmentToSection(lineId, input.SectionId);
            }
        }));

    public Task<ProjectDto> RemoveEquipmentAsync(Guid id, Guid lineId) => MutateAsync(id, p => Sync(() => p.RemoveEquipment(lineId)));

    public Task<ProjectDto> AddSectionAsync(Guid id, CreateUpdateSectionInput input) =>
        MutateAsync(id, p => Sync(() => p.AddSection(input.Name, input.ParentId)));

    public Task<ProjectDto> RenameSectionAsync(Guid id, Guid sectionId, CreateUpdateSectionInput input) =>
        MutateAsync(id, p => Sync(() => p.RenameSection(sectionId, input.Name)));

    public Task<ProjectDto> MoveSectionAsync(Guid id, Guid sectionId, MoveSectionInput input) =>
        MutateAsync(id, p => Sync(() => p.MoveSection(sectionId, input.Direction)));

    public Task<ProjectDto> RemoveSectionAsync(Guid id, Guid sectionId) => MutateAsync(id, p => Sync(() => p.RemoveSection(sectionId)));

    public Task<ProjectDto> AddCrewAsync(Guid id, AddCrewInput input) =>
        MutateAsync(id, p => projectManager.AddCrewAsync(p, input.UserId, input.Function));

    public Task<ProjectDto> UpdateCrewAsync(Guid id, Guid crewId, UpdateCrewInput input) =>
        MutateAsync(id, p => Sync(() => p.UpdateCrew(crewId, input.Function)));

    public Task<ProjectDto> RemoveCrewAsync(Guid id, Guid crewId) => MutateAsync(id, p => Sync(() => p.RemoveCrew(crewId)));

    private async Task<ProjectDto> MutateAsync(Guid id, Func<Project, Task> change)
    {
        var project = await projectRepository.GetAsync(id);
        await change(project);
        await unitOfWork.SaveChangesAsync();
        return await BuildDtoAsync(project);
    }

    private static Task Sync(Action action)
    {
        action();
        return Task.CompletedTask;
    }

    private static void Apply(Project project, CreateUpdateProjectDto input)
    {
        project.Update(input.Name.Trim(), input.CustomerId, input.Venue, input.Color, input.ProjectType, input.StockLocationId, input.Notes);
        project.SetPlanPeriod(input.PlanStart, input.PlanEnd);
        project.SetUsePeriod(input.UseStart, input.UseEnd);
        project.SetDocumentInfo(input.AccountManagerId, input.PaymentTerms);
    }

    private async Task<List<ProjectCrewDto>> BuildCrewAsync(Project project)
    {
        var users = (await userRepository.GetListByIdsAsync(project.Crew.Select(c => c.UserId))).ToDictionary(u => u.Id);
        return project.Crew.Where(c => users.ContainsKey(c.UserId)).Select(c => new ProjectCrewDto
        {
            Id = c.Id,
            UserId = c.UserId,
            FullName = users[c.UserId].FullName,
            JobTitle = users[c.UserId].JobTitle,
            Phone = users[c.UserId].Phone,
            Email = users[c.UserId].Email,
            Function = c.Function
        }).OrderBy(c => c.FullName).ToList();
    }

    private async Task<ProjectDto> BuildDtoAsync(Project project)
    {
        var crewView = await access.IsCrewViewAsync();
        var showPrice = !crewView && await prices.CanSeeAsync();
        var customer = project.CustomerId.HasValue ? await customerRepository.FindAsync(project.CustomerId.Value) : null;
        var location = project.StockLocationId.HasValue ? await locationRepository.FindAsync(project.StockLocationId.Value) : null;
        var manager = project.AccountManagerId.HasValue ? await userRepository.FindAsync(project.AccountManagerId.Value, includeDetails: false) : null;
        var equipment = (await equipmentRepository.GetListWithRelationsAsync(project.Equipment.Select(e => e.EquipmentId).ToList())).ToDictionary(e => e.Id);
        var availability = await availabilityManager.GetForProjectAsync(project);
        var balances = (await movementRepository.GetBalancesAsync(project.Id)).ToDictionary(b => b.EquipmentId);

        var needed = project.Equipment.GroupBy(e => e.EquipmentId).ToDictionary(g => g.Key, g => g.Sum(e => e.Quantity));
        var shortages = needed.ToDictionary(n => n.Key,
            n => AvailabilityManager.GetShortage(n.Value, balances.GetValueOrDefault(n.Key)?.Out ?? 0, availability[n.Key]));

        // Alternatives are suggested only for equipment that is short, with their own availability.
        var alternativeIds = shortages.Where(s => s.Value > 0)
            .SelectMany(s => equipment[s.Key].Relations.Where(r => r.Kind == EquipmentRelationKind.Alternative).Select(r => r.RelatedEquipmentId))
            .Distinct().ToList();
        var alternatives = (await equipmentRepository.GetListByIdsAsync(alternativeIds)).ToDictionary(e => e.Id);
        var alternativeAvailability = await availabilityManager.GetAsync(alternativeIds, project.PlanStart, project.PlanEnd, project.Id);

        var outline = project.GetSectionOutline();
        var dto = new ProjectDto().FillProject(project, customer?.Name, location?.Name, project.Equipment.Sum(e => e.Quantity));
        dto.Notes = project.Notes;
        dto.RentalDays = project.RentalDays;
        dto.IsCrewView = crewView;
        dto.IsEditable = project.IsEditable && !crewView;
        dto.AllowedStatuses = crewView ? [] : ProjectStatusRules.GetAllowedTargets(project.Status).ToList();
        dto.AccountManagerId = project.AccountManagerId;
        dto.AccountManagerName = manager?.FullName;
        dto.PaymentTerms = project.PaymentTerms;
        dto.Sections = outline.Select(o => new ProjectSectionDto
        {
            Id = o.Section.Id, ParentId = o.Section.ParentId, Name = o.Section.Name, SortOrder = o.Section.SortOrder, Depth = o.Depth, Path = o.Path
        }).ToList();
        dto.Crew = await BuildCrewAsync(project);
        dto.Equipment = project.Equipment
            .OrderBy(e => e.SectionId is null ? -1 : outline.ToList().FindIndex(o => o.Section.Id == e.SectionId))
            .ThenBy(e => e.SortOrder)
            .Select(line =>
            {
                var item = equipment[line.EquipmentId];
                var available = availability[line.EquipmentId];
                var balance = balances.GetValueOrDefault(line.EquipmentId);
                var shortage = shortages[line.EquipmentId];
                return new ProjectEquipmentDto
                {
                    Id = line.Id,
                    EquipmentId = item.Id,
                    SectionId = line.SectionId,
                    SortOrder = line.SortOrder,
                    EquipmentCode = item.Code,
                    EquipmentName = item.Name,
                    IsSerialized = item.IsSerialized,
                    RentalPrice = showPrice ? item.RentalPrice : null,
                    Quantity = line.Quantity,
                    Notes = line.Notes,
                    Stock = available.Stock,
                    PlannedElsewhere = available.PlannedElsewhere,
                    Available = available.Available,
                    Shortage = shortage,
                    OutQuantity = balance?.Out ?? 0,
                    ReturnedQuantity = balance?.CheckedIn ?? 0,
                    Alternatives = shortage == 0
                        ? []
                        : item.Relations.Where(r => r.Kind == EquipmentRelationKind.Alternative && alternatives.ContainsKey(r.RelatedEquipmentId))
                            .Select(r => new AlternativeDto
                            {
                                EquipmentId = r.RelatedEquipmentId,
                                Code = alternatives[r.RelatedEquipmentId].Code,
                                Name = alternatives[r.RelatedEquipmentId].Name,
                                Available = Math.Max(0, alternativeAvailability[r.RelatedEquipmentId].Available)
                            }).ToList()
                };
            })
            .ToList();
        dto.ShortageCount = shortages.Count(s => s.Value > 0);
        return dto;
    }
}

public class CrewAppService(IUserRepository userRepository, ICurrentCompany currentCompany) : ICrewAppService
{
    public async Task<List<CrewDirectoryEntryDto>> GetDirectoryAsync() =>
        (await userRepository.GetDirectoryAsync(currentCompany.Id!.Value)).Select(x => new CrewDirectoryEntryDto
        {
            UserId = x.User.Id,
            FullName = x.User.FullName,
            JobTitle = x.User.JobTitle,
            Phone = x.User.Phone,
            Email = x.User.Email,
            Roles = x.Roles
        }).ToList();
}
