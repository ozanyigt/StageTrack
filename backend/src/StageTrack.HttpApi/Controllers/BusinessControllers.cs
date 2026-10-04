using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StageTrack.Customers;
using StageTrack.Dtos;
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

    [HttpDelete("{id:guid}")]
    [Authorize(StageTrackPermissions.Customers.Manage)]
    public Task DeleteAsync(Guid id) => appService.DeleteAsync(id);
}

[ApiController]
[Route("api/projects")]
[Authorize(StageTrackPermissions.Projects.Default)]
public class ProjectsController(IProjectAppService appService) : ControllerBase
{
    [HttpGet]
    public Task<PagedResultDto<ProjectListItemDto>> GetListAsync([FromQuery] GetProjectListInput input) => appService.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<ProjectDto> GetAsync(Guid id) => appService.GetAsync(id);

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
}

[ApiController]
[Route("api/warehouse")]
[Authorize(StageTrackPermissions.Warehouse.Default)]
public class WarehouseController(IWarehouseAppService appService) : ControllerBase
{
    [HttpPost("scan")]
    [Authorize(StageTrackPermissions.Warehouse.Scan)]
    public Task<ScanResultDto> ScanAsync(ScanInput input) => appService.ScanAsync(input);

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

    [HttpDelete("{id:guid}")]
    [Authorize(StageTrackPermissions.Quotes.Manage)]
    public Task DeleteAsync(Guid id) => appService.DeleteAsync(id);
}
