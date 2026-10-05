using StageTrack.Identity;
using StageTrack.Inventory;
using StageTrack.Session;
using StageTrack.Warehouse;

namespace StageTrack.Projects;

public class ProjectManager(
    IProjectRepository projectRepository,
    IEquipmentRepository equipmentRepository,
    IWarehouseMovementRepository movementRepository,
    IUserRepository userRepository,
    ICurrentCompany currentCompany)
{
    /// <summary>
    /// New projects continue from the highest existing number. Projects imported from Rentman pass
    /// their original number so references used by the team (e.g. "2384") stay the same.
    /// </summary>
    public async Task<Project> CreateAsync(string name, DateTime planStart, DateTime planEnd, int? importedNumber = null)
    {
        var number = importedNumber ?? await projectRepository.GetMaxNumberAsync() + 1;
        return new Project(Guid.CreateVersion7(), number, name.Trim(), planStart, planEnd);
    }

    public async Task<ProjectEquipment> AddEquipmentAsync(Project project, Guid equipmentId, int quantity, Guid? sectionId = null)
    {
        var equipment = await equipmentRepository.GetAsync(equipmentId, includeDetails: false);
        if (equipment.IsArchived)
        {
            throw new EntityNotFoundException(typeof(Equipment), equipmentId);
        }

        return project.AddEquipment(equipment.Id, quantity, sectionId);
    }

    /// <summary>Only users who work in this location can be put on its projects.</summary>
    public async Task<ProjectCrewMember> AddCrewAsync(Project project, Guid userId, string? function)
    {
        var user = await userRepository.GetAsync(userId);
        if (!user.HasCompany(currentCompany.Id!.Value))
        {
            throw new BusinessException(StageTrackErrorCodes.CrewUserNotInCompany);
        }

        return project.AddCrew(user.Id, function);
    }

    public async Task ChangeStatusAsync(Project project, ProjectStatus status)
    {
        if (project.Status == status)
        {
            return;
        }

        if (!ProjectStatusRules.CanTransition(project.Status, status))
        {
            throw new BusinessException(StageTrackErrorCodes.ProjectInvalidStatusTransition)
                .WithData("from", project.Status)
                .WithData("to", status);
        }

        // A project can only be closed or cancelled when every device is back in the warehouse.
        if (status is ProjectStatus.Returned or ProjectStatus.Cancelled)
        {
            var outCount = (await movementRepository.GetBalancesAsync(project.Id)).Sum(b => Math.Max(0, b.Out));
            if (outCount > 0)
            {
                throw new BusinessException(StageTrackErrorCodes.ProjectHasEquipmentOut).WithData("count", outCount);
            }
        }

        project.SetStatus(status);
    }

    public void EnsureCanDelete(Project project)
    {
        if (project.Status is not (ProjectStatus.Draft or ProjectStatus.Cancelled))
        {
            throw new BusinessException(StageTrackErrorCodes.ProjectCannotDelete);
        }
    }

    /// <summary>Called when a quote is accepted: an unconfirmed project becomes confirmed.</summary>
    public async Task ConfirmIfNotYetAsync(Project project)
    {
        if (project.Status is ProjectStatus.Draft or ProjectStatus.Pending)
        {
            await ChangeStatusAsync(project, ProjectStatus.Confirmed);
        }
    }
}
