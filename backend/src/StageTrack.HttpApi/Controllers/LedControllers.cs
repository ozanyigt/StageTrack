using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StageTrack.Led;
using StageTrack.Permissions;

namespace StageTrack.Controllers;

/// <summary>
/// The LED module's screen maths. Firms without the module never get the permission, so the policy below is the
/// only gate these endpoints need.
/// </summary>
[ApiController]
[Route("api/led/calc")]
[Authorize(StageTrackPermissions.Led.Default)]
public class LedCalculationController(ILedCalculationAppService appService) : ControllerBase
{
    [HttpGet("settings")]
    public CalcSettingsDto GetSettings() => appService.GetSettings();

    [HttpPost("evaluate")]
    [Authorize(StageTrackPermissions.Led.Design)]
    public Task<EvaluateResponse> EvaluateAsync(EvaluateRequest request) => appService.EvaluateAsync(request);

    [HttpPost("equipment-power")]
    [Authorize(StageTrackPermissions.Led.Design)]
    public Task<EquipmentPowerResponse> EquipmentPowerAsync(EquipmentPowerRequest request) =>
        appService.CalculateEquipmentPowerAsync(request);
}

/// <summary>Which equipment items are LED panels, processors and extenders, and their technical data.</summary>
[ApiController]
[Route("api/led/inventory")]
[Authorize(StageTrackPermissions.Led.Default)]
public class LedInventoryController(ILedInventoryAppService appService) : ControllerBase
{
    [HttpGet("panels")]
    public Task<List<LedPanelDto>> GetPanelsAsync([FromQuery] GetLedCatalogInput input) => appService.GetPanelsAsync(input);

    [HttpGet("processors")]
    public Task<List<LedProcessorDto>> GetProcessorsAsync([FromQuery] GetLedCatalogInput input) => appService.GetProcessorsAsync(input);

    [HttpGet("extenders")]
    public Task<List<LedExtenderDto>> GetExtendersAsync([FromQuery] GetLedCatalogInput input) => appService.GetExtendersAsync(input);

    [HttpPut("panels/{equipmentId:guid}")]
    [Authorize(StageTrackPermissions.Led.Manage)]
    public Task<LedPanelDto> SavePanelAsync(Guid equipmentId, LedPanelInput input) => appService.SavePanelAsync(equipmentId, input);

    [HttpPut("processors/{equipmentId:guid}")]
    [Authorize(StageTrackPermissions.Led.Manage)]
    public Task<LedProcessorDto> SaveProcessorAsync(Guid equipmentId, LedProcessorInput input) => appService.SaveProcessorAsync(equipmentId, input);

    [HttpPut("extenders/{equipmentId:guid}")]
    [Authorize(StageTrackPermissions.Led.Manage)]
    public Task<LedExtenderDto> SaveExtenderAsync(Guid equipmentId, LedExtenderInput input) => appService.SaveExtenderAsync(equipmentId, input);

    [HttpDelete("{equipmentId:guid}")]
    [Authorize(StageTrackPermissions.Led.Manage)]
    public Task RemoveAsync(Guid equipmentId) => appService.RemoveAsync(equipmentId);

    [HttpPut("panels/{equipmentId:guid}/favorite")]
    public Task SetFavoriteAsync(Guid equipmentId, SetLedFavoriteInput input) => appService.SetFavoriteAsync(equipmentId, input.Favorite);
}

public class SetLedFavoriteInput
{
    public bool Favorite { get; set; }
}

[ApiController]
[Route("api/led/transport")]
[Authorize(StageTrackPermissions.Led.Transport)]
public class LedTransportController(ILedTransportAppService appService) : ControllerBase
{
    [HttpGet("vehicles")]
    public Task<TransportSettingsDto> GetVehiclesAsync() => appService.GetVehiclesAsync();

    [HttpPut("vehicles")]
    public Task<TransportSettingsDto> SaveVehiclesAsync(SaveTransportVehiclesRequest request) => appService.SaveVehiclesAsync(request);

    [HttpPost("plan")]
    public Task<TransportPlanResponse> PlanAsync(TransportPlanRequest request) => appService.PlanAsync(request);
}

[ApiController]
[Route("api/led/stage")]
[Authorize(StageTrackPermissions.Led.Design)]
public class LedStageController(ILedStageAppService appService) : ControllerBase
{
    [HttpGet]
    public Task<LedStageSettingsDto> GetAsync() => appService.GetAsync();

    [HttpPut]
    public Task<LedStageSettingsDto> SaveAsync(LedStageSettingsDto input) => appService.SaveAsync(input);
}

[ApiController]
[Route("api/led/stock-status")]
[Authorize(StageTrackPermissions.Led.Default)]
public class LedStockStatusController(ILedStockStatusAppService appService) : ControllerBase
{
    [HttpPost]
    public Task<LedStockStatusResponse> GetAsync(LedStockStatusRequest request) => appService.GetAsync(request);
}

/// <summary>
/// The bridge: a calculated LED job becomes planned equipment on a real job, and from there its draft quote,
/// packing list and warehouse scan.
/// </summary>
[ApiController]
[Route("api/led/jobs/{projectId:guid}")]
[Authorize(StageTrackPermissions.Led.Quote)]
public class LedJobController(ILedJobAppService appService) : ControllerBase
{
    [HttpPost("preview")]
    public Task<LedToJobResultDto> PreviewAsync(Guid projectId, LedToJobInput input) => appService.PreviewAsync(projectId, input);

    [HttpPost("transfer")]
    public Task<LedToJobResultDto> TransferAsync(Guid projectId, LedToJobInput input) => appService.TransferAsync(projectId, input);
}
