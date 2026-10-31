using StageTrack.Inventory;
using StageTrack.Led.Calculation;
using StageTrack.Projects;
using StageTrack.Repositories;

namespace StageTrack.Sites;

public class SitePlanAppService(
    ISitePlanRepository planRepository,
    IProjectRepository projectRepository,
    IEquipmentRepository equipmentRepository,
    CalcSettings calcSettings,
    IUnitOfWork unitOfWork) : ISitePlanAppService
{
    /// <summary>
    /// What the site draws. The arithmetic is the same one the LED module uses for everything that is not a
    /// panel - watts to amps to 16 A circuits - because it is ordinary mains maths, not an LED concern; running
    /// one calculator means a lighting tower is costed the same whether it is on a site plan or in a job.
    /// </summary>
    public async Task<SitePowerDto> GetPowerAsync(Guid id, double voltage)
    {
        var plan = await planRepository.GetAsync(id);
        var totals = plan.Items
            .Where(i => i.EquipmentId.HasValue)
            .GroupBy(i => i.EquipmentId!.Value)
            .ToDictionary(g => g.Key, g => (Count: g.Sum(i => i.Quantity), IsLight: g.Any(i => i.LightHeightM.HasValue)));

        var equipment = (await equipmentRepository.GetListByIdsAsync(totals.Keys)).ToDictionary(e => e.Id);
        var mains = voltage is > 0 and <= 1000 ? voltage : 220;

        var lines = new List<SitePowerLineDto>();
        var missing = new List<string>();
        foreach (var (equipmentId, row) in totals)
        {
            if (!equipment.TryGetValue(equipmentId, out var item))
            {
                continue;
            }

            if (item.PowerW is null)
            {
                missing.Add(item.Code);
            }

            var spec = new EquipmentPowerSpec((double)(item.WeightKg ?? 0), (double?)item.PowerW, (double?)item.PowerW);
            var result = EquipmentPowerCalculator.Line(spec, row.Count, PowerMode.Max, mains, calcSettings);
            lines.Add(new SitePowerLineDto(item.Id, item.Code, item.Name, row.Count, row.IsLight,
                result.WeightKg, result.Watt, result.CurrentA, result.Circuits));
        }

        var ordered = lines.OrderByDescending(l => l.Watt).ThenBy(l => l.Code).ToList();
        var lighting = ordered.Where(l => l.IsLight).ToList();
        return new SitePowerDto(
            ordered,
            ordered.Sum(l => l.WeightKg),
            ordered.Sum(l => l.Watt),
            ordered.Sum(l => l.CurrentA),
            ordered.Sum(l => l.Circuits),
            lighting.Sum(l => l.Watt),
            lighting.Sum(l => l.Circuits),
            missing.OrderBy(c => c).ToList());
    }

    public async Task<SitePlanDto?> FindByProjectAsync(Guid projectId)
    {
        var plan = await planRepository.FindByProjectAsync(projectId);
        return plan is null ? null : await ToDtoAsync(plan);
    }

    public async Task<SitePlanDto> CreateAsync(CreateSitePlanInput input)
    {
        var project = await projectRepository.GetAsync(input.ProjectId, includeDetails: false);
        if (await planRepository.FindByProjectAsync(project.Id) is not null)
        {
            throw new BusinessException(StageTrackErrorCodes.SitePlanAlreadyExists);
        }

        var name = string.IsNullOrWhiteSpace(input.Name) ? project.Venue ?? project.Name : input.Name;
        var plan = new SitePlan(Guid.CreateVersion7(), project.Id, name, input.CentreLat, input.CentreLng);
        await planRepository.InsertAsync(plan);
        await unitOfWork.SaveChangesAsync();
        return await ToDtoAsync(plan);
    }

    public Task<SitePlanDto> UpdateViewAsync(Guid id, UpdateSitePlanViewInput input) =>
        MutateAsync(id, plan => plan.SetView(input.CentreLat, input.CentreLng, input.Zoom, input.BaseLayer, input.NightMode));

    public Task<SitePlanDto> RenameAsync(Guid id, string name) => MutateAsync(id, plan => plan.Rename(name));

    public async Task DeleteAsync(Guid id)
    {
        await planRepository.DeleteAsync(await planRepository.GetAsync(id));
        await unitOfWork.SaveChangesAsync();
    }

    public async Task<SitePlanDto> AddItemAsync(Guid id, AddSitePlanItemInput input)
    {
        // Only equipment that may be planned goes on a plan: the plan is what the job will reserve.
        if (input.EquipmentId is { } equipmentId)
        {
            var equipment = await equipmentRepository.GetAsync(equipmentId, includeDetails: false);
            if (equipment.IsArchived)
            {
                throw new EntityNotFoundException(typeof(Equipment), equipmentId);
            }
        }

        return await MutateAsync(id, plan => plan.AddItem(input.EquipmentId, input.Label, input.Quantity, input.Lat, input.Lng, input.Layer));
    }

    public Task<SitePlanDto> MoveItemAsync(Guid id, Guid itemId, MoveSitePlanItemInput input) =>
        MutateAsync(id, plan => plan.GetItem(itemId).MoveTo(input.Lat, input.Lng, input.RotationDeg));

    public Task<SitePlanDto> UpdateItemAsync(Guid id, Guid itemId, UpdateSitePlanItemInput input) =>
        MutateAsync(id, plan =>
        {
            var item = plan.GetItem(itemId);
            item.Update(input.Label, input.Quantity, input.Layer, input.Notes);
            item.SetLight(input.LightHeightM, input.LightIntensity, input.LightRadiusM);
        });

    public Task<SitePlanDto> RemoveItemAsync(Guid id, Guid itemId) => MutateAsync(id, plan => plan.RemoveItem(itemId));

    public Task<SitePlanDto> SaveZoneAsync(Guid id, Guid? zoneId, SaveSitePlanZoneInput input) =>
        MutateAsync(id, plan =>
        {
            var points = ToPoints(input.Points);
            if (zoneId is { } existing)
            {
                plan.GetZone(existing).Update(input.Name, points, input.Color, input.Layer);
            }
            else
            {
                plan.AddZone(input.Name, input.Kind, points, input.Color, input.Layer);
            }
        });

    public Task<SitePlanDto> RemoveZoneAsync(Guid id, Guid zoneId) => MutateAsync(id, plan => plan.RemoveZone(zoneId));

    private async Task<SitePlanDto> MutateAsync(Guid id, Action<SitePlan> change)
    {
        var plan = await planRepository.GetAsync(id);
        change(plan);
        await unitOfWork.SaveChangesAsync();
        return await ToDtoAsync(plan);
    }

    private static List<SitePoint> ToPoints(IEnumerable<double[]> points) =>
        points.Where(p => p.Length == 2).Select(p => new SitePoint(p[0], p[1])).ToList();

    private async Task<SitePlanDto> ToDtoAsync(SitePlan plan)
    {
        var project = await projectRepository.GetAsync(plan.ProjectId, includeDetails: false);
        var equipmentIds = plan.Items.Where(i => i.EquipmentId.HasValue).Select(i => i.EquipmentId!.Value).Distinct().ToList();
        var equipment = (await equipmentRepository.GetListByIdsAsync(equipmentIds)).ToDictionary(e => e.Id);
        var stock = await equipmentRepository.GetStockQuantitiesAsync(equipmentIds);

        var layers = plan.Items.Select(i => i.Layer)
            .Concat(plan.Zones.Select(z => z.Layer))
            .Where(l => !string.IsNullOrWhiteSpace(l))
            .Select(l => l!)
            .Concat(SiteConsts.DefaultLayers)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(l => l, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new SitePlanDto
        {
            Id = plan.Id,
            ProjectId = plan.ProjectId,
            ProjectNumber = project.Number,
            ProjectName = project.Name,
            Venue = project.Venue,
            Name = plan.Name,
            CentreLat = plan.CentreLat,
            CentreLng = plan.CentreLng,
            Zoom = plan.Zoom,
            BaseLayer = plan.BaseLayer,
            NightMode = plan.NightMode,
            Layers = layers,
            Items = plan.Items
                .OrderBy(i => i.Id)
                .Select(i =>
                {
                    var item = i.EquipmentId.HasValue ? equipment.GetValueOrDefault(i.EquipmentId.Value) : null;
                    return new SitePlanItemDto
                    {
                        Id = i.Id,
                        EquipmentId = i.EquipmentId,
                        EquipmentCode = item?.Code,
                        EquipmentName = item?.Name,
                        EquipmentStock = i.EquipmentId.HasValue ? stock.GetValueOrDefault(i.EquipmentId.Value) : 0,
                        Label = i.Label,
                        Quantity = i.Quantity,
                        Lat = i.Lat,
                        Lng = i.Lng,
                        RotationDeg = i.RotationDeg,
                        Layer = i.Layer,
                        Notes = i.Notes,
                        LightHeightM = i.LightHeightM,
                        LightIntensity = i.LightIntensity,
                        LightRadiusM = i.EffectiveRadiusM,
                        IsLight = i.LightHeightM.HasValue
                    };
                })
                .ToList(),
            Zones = plan.Zones
                .OrderBy(z => z.Name)
                .Select(z =>
                {
                    var points = z.GetPoints();
                    return new SitePlanZoneDto
                    {
                        Id = z.Id,
                        Name = z.Name,
                        Kind = z.Kind,
                        Points = points.Select(p => new[] { p.Lat, p.Lng }).ToList(),
                        Color = z.Color,
                        Layer = z.Layer,
                        AreaM2 = z.Kind == SiteZoneKind.Area ? SiteGeometry.AreaM2(points) : null,
                        LengthM = z.Kind == SiteZoneKind.Area ? null : SiteGeometry.LengthM(points)
                    };
                })
                .ToList()
        };
    }
}
