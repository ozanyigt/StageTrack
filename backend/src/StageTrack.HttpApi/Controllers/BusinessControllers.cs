using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StageTrack.Customers;
using StageTrack.Dtos;
using StageTrack.Imports;
using StageTrack.Permissions;
using StageTrack.Projects;
using StageTrack.Quotes;
using StageTrack.Warehouse;

namespace StageTrack.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize(StageTrackPermissions.Customers.Default)]
public class CustomersController(ICustomerAppService appService) : ControllerBase
{
    [HttpGet]
    public Task<PagedResultDto<CustomerDto>> GetListAsync([FromQuery] GetCustomerListInput input) => appService.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<CustomerDto> GetAsync(Guid id) => appService.GetAsync(id);

    [HttpGet("lookup")]
    public Task<List<LookupDto>> GetLookupAsync([FromQuery] string? text) => appService.GetLookupAsync(text);

    [HttpPost]
    [Authorize(StageTrackPermissions.Customers.Manage)]
    public Task<CustomerDto> CreateAsync(CreateUpdateCustomerDto input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}")]
    [Authorize(StageTrackPermissions.Customers.Manage)]
    public Task<CustomerDto> UpdateAsync(Guid id, CreateUpdateCustomerDto input) => appService.UpdateAsync(id, input);

    [HttpPost("import")]
    [Authorize(StageTrackPermissions.Customers.Manage)]
    public Task<ImportResultDto> ImportAsync(List<CustomerImportRow> rows) => appService.ImportAsync(rows);

    [HttpDelete("{id:guid}")]
    [Authorize(StageTrackPermissions.Customers.Manage)]
    public Task DeleteAsync(Guid id) => appService.DeleteAsync(id);
}

[ApiController]
[Route("api/projects")]
[Authorize]
public class ProjectsController(IProjectAppService appService) : ControllerBase
{
    /// <summary>Also reachable by crew members; the app service limits them to their own confirmed projects.</summary>
    [HttpGet]
    public Task<PagedResultDto<ProjectListItemDto>> GetListAsync([FromQuery] GetProjectListInput input) => appService.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<ProjectDto> GetAsync(Guid id) => appService.GetAsync(id);

    [HttpGet("{id:guid}/packing-slip")]
    public Task<PackingSlipDto> GetPackingSlipAsync(Guid id) => appService.GetPackingSlipAsync(id);

    [HttpPost]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<ProjectDto> CreateAsync(CreateUpdateProjectDto input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<ProjectDto> UpdateAsync(Guid id, CreateUpdateProjectDto input) => appService.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task DeleteAsync(Guid id) => appService.DeleteAsync(id);

    [HttpPost("{id:guid}/status")]
    [Authorize(StageTrackPermissions.Projects.ChangeStatus)]
    public Task<ProjectDto> ChangeStatusAsync(Guid id, ChangeProjectStatusInput input) => appService.ChangeStatusAsync(id, input);

    [HttpPost("{id:guid}/equipment")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<ProjectDto> AddEquipmentAsync(Guid id, AddProjectEquipmentInput input) => appService.AddEquipmentAsync(id, input);

    [HttpPut("{id:guid}/equipment/{lineId:guid}")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<ProjectDto> UpdateEquipmentAsync(Guid id, Guid lineId, UpdateProjectEquipmentInput input) =>
        appService.UpdateEquipmentAsync(id, lineId, input);

    [HttpDelete("{id:guid}/equipment/{lineId:guid}")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<ProjectDto> RemoveEquipmentAsync(Guid id, Guid lineId) => appService.RemoveEquipmentAsync(id, lineId);

    [HttpPost("{id:guid}/equipment/{lineId:guid}/move")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<ProjectDto> MoveEquipmentAsync(Guid id, Guid lineId, MoveProjectEquipmentInput input) =>
        appService.MoveEquipmentAsync(id, lineId, input);

    [HttpPost("{id:guid}/sections")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<ProjectDto> AddSectionAsync(Guid id, CreateUpdateSectionInput input) => appService.AddSectionAsync(id, input);

    [HttpPut("{id:guid}/sections/{sectionId:guid}")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<ProjectDto> RenameSectionAsync(Guid id, Guid sectionId, CreateUpdateSectionInput input) =>
        appService.RenameSectionAsync(id, sectionId, input);

    [HttpPost("{id:guid}/sections/{sectionId:guid}/move")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<ProjectDto> MoveSectionAsync(Guid id, Guid sectionId, MoveSectionInput input) => appService.MoveSectionAsync(id, sectionId, input);

    [HttpDelete("{id:guid}/sections/{sectionId:guid}")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<ProjectDto> RemoveSectionAsync(Guid id, Guid sectionId) => appService.RemoveSectionAsync(id, sectionId);

    [HttpPost("{id:guid}/crew")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<ProjectDto> AddCrewAsync(Guid id, AddCrewInput input) => appService.AddCrewAsync(id, input);

    [HttpPut("{id:guid}/crew/{crewId:guid}")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<ProjectDto> UpdateCrewAsync(Guid id, Guid crewId, UpdateCrewInput input) => appService.UpdateCrewAsync(id, crewId, input);

    [HttpDelete("{id:guid}/crew/{crewId:guid}")]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<ProjectDto> RemoveCrewAsync(Guid id, Guid crewId) => appService.RemoveCrewAsync(id, crewId);
}

[ApiController]
[Route("api/crew")]
[Authorize]
public class CrewController(ICrewAppService appService) : ControllerBase
{
    [HttpGet]
    public Task<List<CrewDirectoryEntryDto>> GetDirectoryAsync() => appService.GetDirectoryAsync();
}

[ApiController]
[Route("api/warehouse")]
[Authorize(StageTrackPermissions.Warehouse.Default)]
public class WarehouseController(IWarehouseAppService appService) : ControllerBase
{
    [HttpPost("scan")]
    [Authorize(StageTrackPermissions.Warehouse.Scan)]
    public Task<ScanResultDto> ScanAsync(ScanInput input) => appService.ScanAsync(input);

    [HttpGet("scan-sheet/{projectId:guid}")]
    public Task<ScanSheetDto> GetScanSheetAsync(Guid projectId) => appService.GetScanSheetAsync(projectId);

    [HttpPost("projects/{projectId:guid}/status")]
    [Authorize(StageTrackPermissions.Warehouse.Scan)]
    public Task<ScanSheetDto> SetProjectStatusAsync(Guid projectId, SetWarehouseProjectStatusInput input) =>
        appService.SetProjectStatusAsync(projectId, input);

    [HttpGet("packing-list/{projectId:guid}")]
    public Task<PackingListDto> GetPackingListAsync(Guid projectId) => appService.GetPackingListAsync(projectId);

    [HttpGet("board")]
    public Task<WarehouseBoardDto> GetBoardAsync([FromQuery] GetWarehouseBoardInput input) => appService.GetBoardAsync(input);

    [HttpGet("movements")]
    public Task<PagedResultDto<MovementDto>> GetMovementsAsync([FromQuery] GetMovementListInput input) => appService.GetMovementsAsync(input);
}

[ApiController]
[Route("api/rental-factor-profiles")]
[Authorize]
public class RentalFactorProfilesController(IRentalFactorProfileAppService appService) : ControllerBase
{
    [HttpGet]
    public Task<List<RentalFactorProfileDto>> GetListAsync() => appService.GetListAsync();

    [HttpGet("{id:guid}/preview")]
    public Task<List<FactorPreviewDto>> GetPreviewAsync(Guid id, [FromQuery] int maxDays = 14) => appService.GetPreviewAsync(id, maxDays);

    [HttpPost]
    [Authorize(StageTrackPermissions.Settings.RentalFactors)]
    public Task<RentalFactorProfileDto> CreateAsync(CreateUpdateRentalFactorProfileDto input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}")]
    [Authorize(StageTrackPermissions.Settings.RentalFactors)]
    public Task<RentalFactorProfileDto> UpdateAsync(Guid id, CreateUpdateRentalFactorProfileDto input) => appService.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    [Authorize(StageTrackPermissions.Settings.RentalFactors)]
    public Task DeleteAsync(Guid id) => appService.DeleteAsync(id);
}

[ApiController]
[Route("api/quotes")]
[Authorize(StageTrackPermissions.Quotes.Default)]
[Authorize(StageTrackPermissions.Prices.View)]
public class QuotesController(IQuoteAppService appService) : ControllerBase
{
    [HttpGet]
    public Task<PagedResultDto<QuoteListItemDto>> GetListAsync([FromQuery] GetQuoteListInput input) => appService.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<QuoteDto> GetAsync(Guid id) => appService.GetAsync(id);

    [HttpPost]
    [Authorize(StageTrackPermissions.Quotes.Manage)]
    public Task<QuoteDto> CreateAsync(CreateQuoteInput input) => appService.CreateAsync(input);

    [HttpPut("{id:guid}")]
    [Authorize(StageTrackPermissions.Quotes.Manage)]
    public Task<QuoteDto> UpdateHeaderAsync(Guid id, UpdateQuoteHeaderInput input) => appService.UpdateHeaderAsync(id, input);

    [HttpPost("{id:guid}/lines")]
    [Authorize(StageTrackPermissions.Quotes.Manage)]
    public Task<QuoteDto> AddLineAsync(Guid id, CreateUpdateQuoteLineInput input) => appService.AddLineAsync(id, input);

    [HttpPut("{id:guid}/lines/{lineId:guid}")]
    [Authorize(StageTrackPermissions.Quotes.Manage)]
    public Task<QuoteDto> UpdateLineAsync(Guid id, Guid lineId, CreateUpdateQuoteLineInput input) => appService.UpdateLineAsync(id, lineId, input);

    [HttpDelete("{id:guid}/lines/{lineId:guid}")]
    [Authorize(StageTrackPermissions.Quotes.Manage)]
    public Task<QuoteDto> RemoveLineAsync(Guid id, Guid lineId) => appService.RemoveLineAsync(id, lineId);

    [HttpPost("{id:guid}/status")]
    [Authorize(StageTrackPermissions.Quotes.Manage)]
    public Task<QuoteDto> ChangeStatusAsync(Guid id, ChangeQuoteStatusInput input) => appService.ChangeStatusAsync(id, input);

    [HttpPost("{id:guid}/revise")]
    [Authorize(StageTrackPermissions.Quotes.Manage)]
    public Task<QuoteDto> ReviseAsync(Guid id) => appService.ReviseAsync(id);

    [HttpGet("jobs")]
    public Task<PagedResultDto<QuoteJobDto>> GetJobsAsync([FromQuery] GetQuoteJobsInput input) => appService.GetJobsAsync(input);

    [HttpPost("jobs")]
    [Authorize(StageTrackPermissions.Quotes.Manage)]
    [Authorize(StageTrackPermissions.Projects.Manage)]
    public Task<QuoteDto> CreateJobAsync(CreateQuoteJobInput input) => appService.CreateJobAsync(input);

    [HttpPost("{id:guid}/reopen")]
    [Authorize(StageTrackPermissions.Quotes.Manage)]
    public Task<QuoteDto> ReopenAsync(Guid id) => appService.ReopenAsync(id);

    [HttpPost("{id:guid}/sync-from-project")]
    [Authorize(StageTrackPermissions.Quotes.Manage)]
    public Task<QuoteDto> SyncFromProjectAsync(Guid id) => appService.SyncFromProjectAsync(id);

    [HttpDelete("{id:guid}")]
    [Authorize(StageTrackPermissions.Quotes.Manage)]
    public Task DeleteAsync(Guid id) => appService.DeleteAsync(id);
}
