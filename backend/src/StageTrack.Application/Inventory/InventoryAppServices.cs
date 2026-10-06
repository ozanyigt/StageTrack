using StageTrack.Authorization;
using StageTrack.Collaboration;
using StageTrack.Common;
using StageTrack.Dtos;
using StageTrack.Imports;
using StageTrack.Projects;
using StageTrack.Repositories;
using StageTrack.Session;
using StageTrack.Suppliers;
using StageTrack.Warehouse;

namespace StageTrack.Inventory;

public class EquipmentFolderAppService(
    IEquipmentFolderRepository folderRepository,
    EquipmentFolderManager folderManager) : IEquipmentFolderAppService
{
    public async Task<List<EquipmentFolderDto>> GetListAsync()
    {
        var counts = await folderRepository.GetEquipmentCountsAsync();
        return (await folderRepository.GetListAsync()).Select(f =>
        {
            var dto = f.ToDto();
            dto.EquipmentCount = counts.GetValueOrDefault(f.Id);
            return dto;
        }).ToList();
    }

    public async Task<EquipmentFolderDto> CreateAsync(CreateUpdateEquipmentFolderDto input)
    {
        var folder = await folderManager.CreateAsync(input.Name, input.ParentId);
        await folderRepository.InsertAsync(folder);
        return folder.ToDto();
    }

    public async Task<EquipmentFolderDto> UpdateAsync(Guid id, CreateUpdateEquipmentFolderDto input)
    {
        var folder = await folderRepository.GetAsync(id);
        folder.Rename(input.Name.Trim());
        await folderManager.MoveAsync(folder, input.ParentId);
        return folder.ToDto();
    }

    public async Task DeleteAsync(Guid id)
    {
        var folder = await folderRepository.GetAsync(id);
        await folderManager.EnsureCanDeleteAsync(folder);
        await folderRepository.DeleteAsync(folder);
    }
}

public class EquipmentAppService(
    IEquipmentRepository equipmentRepository,
    IEquipmentFolderRepository folderRepository,
    IEquipmentUnitRepository unitRepository,
    IEquipmentLabelRepository labelRepository,
    IStockLocationRepository locationRepository,
    ISupplierRepository supplierRepository,
    IAttachmentRepository attachmentRepository,
    EquipmentManager equipmentManager,
    EquipmentFolderManager folderManager,
    AttachmentManager attachmentManager,
    AvailabilityManager availabilityManager,
    PriceVisibility prices,
    ImportRunner importRunner,
    IUnitOfWork unitOfWork) : IEquipmentAppService
{
    public async Task<PagedResultDto<EquipmentDto>> GetListAsync(GetEquipmentListInput input)
    {
        var filter = new EquipmentFilter
        {
            Text = input.Text,
            Type = input.Type,
            IsArchived = input.IsArchived,
            FolderIds = input.FolderId is null
                ? null
                : input.IncludeSubfolders ? await folderManager.GetSubtreeIdsAsync(input.FolderId.Value) : [input.FolderId.Value]
        };

        var total = await equipmentRepository.GetCountAsync(filter);
        var items = await equipmentRepository.GetPagedListAsync(filter, input.Sorting, input.SkipCount, input.MaxResultCount);
        var ids = items.Select(e => e.Id).ToList();
        var stock = await equipmentRepository.GetStockQuantitiesAsync(ids);
        var containers = await equipmentRepository.GetContainersOfAsync(ids);
        var folders = (await folderRepository.GetListAsync()).ToDictionary(f => f.Id, f => f.Name);
        var suppliers = (await supplierRepository.GetListByIdsAsync(items.Where(e => e.PurchaseSupplierId.HasValue).Select(e => e.PurchaseSupplierId!.Value)))
            .ToDictionary(s => s.Id, s => s.Name);
        var showPrice = await prices.CanSeeAsync();
        return new PagedResultDto<EquipmentDto>(total, items.Select(e =>
        {
            var dto = e.ToDto(stock.GetValueOrDefault(e.Id), showPrice);
            dto.FolderName = e.FolderId.HasValue ? folders.GetValueOrDefault(e.FolderId.Value) : null;
            dto.PurchaseSupplierName = e.PurchaseSupplierId.HasValue ? suppliers.GetValueOrDefault(e.PurchaseSupplierId.Value) : null;
            dto.ContainedIn = containers.GetValueOrDefault(e.Id)?.Select(c => new EquipmentRefDto { Id = c.Id, Code = c.Code, Name = c.Name }).ToList() ?? [];
            return dto;
        }).ToList());
    }

    public async Task<EquipmentDetailDto> GetAsync(Guid id) => await BuildDetailAsync(await equipmentRepository.GetAsync(id));

    public async Task<List<EquipmentLookupDto>> GetLookupAsync(string? text, bool forQuote = false)
    {
        var showPrice = await prices.CanSeeAsync();
        var items = await equipmentRepository.SearchAsync(text, forQuote ? 60 : 30);
        if (forQuote)
        {
            var stock = await equipmentRepository.GetStockQuantitiesAsync(items.Select(e => e.Id).ToList());
            items = items.Where(e => e.ShowInQuotes && stock.GetValueOrDefault(e.Id) > 0).Take(30).ToList();
        }

        return items.Select(e => e.ToLookupDto(showPrice)).ToList();
    }

    public async Task<EquipmentDto> CreateAsync(CreateUpdateEquipmentDto input)
    {
        var equipment = await equipmentManager.CreateAsync(input.Code, input.Name, input.Type, input.IsSerialized);
        await ApplyAsync(equipment, input);
        await equipmentRepository.InsertAsync(equipment);
        return equipment.ToDto(equipment.IsSerialized ? 0 : equipment.StockQuantity, await prices.CanSeeAsync());
    }

    public async Task<EquipmentDetailDto> UpdateAsync(Guid id, CreateUpdateEquipmentDto input)
    {
        var equipment = await equipmentRepository.GetAsync(id);
        await equipmentManager.ChangeCodeAsync(equipment, input.Code);
        await equipmentManager.SetSerializedAsync(equipment, input.IsSerialized);
        await ApplyAsync(equipment, input);
        await unitOfWork.SaveChangesAsync();
        return await BuildDetailAsync(equipment);
    }

    public async Task ArchiveAsync(Guid id) => await equipmentManager.ArchiveAsync(await equipmentRepository.GetAsync(id));

    public async Task RestoreAsync(Guid id) => (await equipmentRepository.GetAsync(id)).Restore();

    public async Task DeleteAsync(Guid id) => await equipmentManager.DeleteAsync(await equipmentRepository.GetAsync(id));

    public async Task<List<EquipmentAvailabilityDto>> GetAvailabilityAsync(GetAvailabilityInput input)
    {
        var availability = await availabilityManager.GetAsync(input.EquipmentIds, input.Start, input.End, input.ExcludeProjectId);
        return availability.Values.Select(a => new EquipmentAvailabilityDto
        {
            EquipmentId = a.EquipmentId, Stock = a.Stock, PlannedElsewhere = a.PlannedElsewhere, Available = a.Available
        }).ToList();
    }

    public async Task<EquipmentDetailDto> UsePriceFromContentAsync(Guid id)
    {
        var equipment = await equipmentRepository.GetAsync(id);
        equipment.SetPriceManual(false);
        await equipmentManager.ApplyContentPriceAsync(equipment);
        await unitOfWork.SaveChangesAsync();
        return await BuildDetailAsync(equipment);
    }

    public async Task<EquipmentDetailDto> AddRelationAsync(Guid id, AddEquipmentRelationInput input)
    {
        var equipment = await equipmentRepository.GetAsync(id);
        await equipmentManager.AddRelationAsync(equipment, input.Kind, input.RelatedEquipmentId, input.Quantity);
        await unitOfWork.SaveChangesAsync();
        await equipmentManager.ApplyContentPriceAsync(equipment);
        await unitOfWork.SaveChangesAsync();
        return await BuildDetailAsync(equipment);
    }

    public async Task<EquipmentDetailDto> UpdateRelationAsync(Guid id, Guid relationId, UpdateEquipmentRelationInput input)
    {
        var equipment = await equipmentRepository.GetAsync(id);
        equipment.UpdateRelation(relationId, input.Quantity);
        await equipmentManager.ApplyContentPriceAsync(equipment);
        await unitOfWork.SaveChangesAsync();
        return await BuildDetailAsync(equipment);
    }

    public async Task<EquipmentDetailDto> RemoveRelationAsync(Guid id, Guid relationId)
    {
        var equipment = await equipmentRepository.GetAsync(id);
        equipment.RemoveRelation(relationId);
        await equipmentManager.ApplyContentPriceAsync(equipment);
        await unitOfWork.SaveChangesAsync();
        return await BuildDetailAsync(equipment);
    }

    public async Task<EquipmentDetailDto> AddSupplierAsync(Guid id, CreateUpdateEquipmentSupplierInput input)
    {
        var equipment = await equipmentRepository.GetAsync(id);
        await equipmentManager.AddSupplierAsync(equipment, input.SupplierId, input.SupplierCode, input.PurchasePrice, input.IsPreferred);
        await unitOfWork.SaveChangesAsync();
        return await BuildDetailAsync(equipment);
    }

    public async Task<EquipmentDetailDto> UpdateSupplierAsync(Guid id, Guid linkId, CreateUpdateEquipmentSupplierInput input)
    {
        var equipment = await equipmentRepository.GetAsync(id);
        equipment.UpdateSupplier(linkId, input.SupplierCode, input.PurchasePrice, input.IsPreferred);
        await unitOfWork.SaveChangesAsync();
        return await BuildDetailAsync(equipment);
    }

    public async Task<EquipmentDetailDto> RemoveSupplierAsync(Guid id, Guid linkId)
    {
        var equipment = await equipmentRepository.GetAsync(id);
        equipment.RemoveSupplier(linkId);
        await unitOfWork.SaveChangesAsync();
        return await BuildDetailAsync(equipment);
    }

    public async Task<EquipmentDetailDto> SetImageAsync(Guid id, UploadFileInput file)
    {
        var equipment = await equipmentRepository.GetAsync(id);
        var attachment = attachmentManager.Create(OwnerType.Equipment, id, file.FileName, file.ContentType, file.Content, imageOnly: true);
        await attachmentRepository.InsertAsync(attachment);
        await DeleteImageAsync(equipment.ImageAttachmentId);
        equipment.SetImage(attachment.Id);
        await unitOfWork.SaveChangesAsync();
        return await BuildDetailAsync(equipment);
    }

    public async Task<EquipmentDetailDto> RemoveImageAsync(Guid id)
    {
        var equipment = await equipmentRepository.GetAsync(id);
        await DeleteImageAsync(equipment.ImageAttachmentId);
        equipment.SetImage(null);
        await unitOfWork.SaveChangesAsync();
        return await BuildDetailAsync(equipment);
    }

    /// <summary>Upsert by code; the folder path ("VIDEO/Display") is created when missing.</summary>
    public async Task<ImportResultDto> ImportAsync(List<EquipmentImportRow> rows)
    {
        var folders = await folderRepository.GetListAsync();
        var showPrice = await prices.CanSeeAsync();

        return await importRunner.RunAsync(rows, r => r.Row, async row =>
        {
            var code = ImportRunner.Required(row.Code, "code");
            var equipment = await equipmentRepository.FindByCodeAsync(code);
            var created = equipment is null;
            if (equipment is null)
            {
                equipment = await equipmentManager.CreateAsync(code, ImportRunner.Required(row.Name, "name"), EquipmentType.Physical, row.IsSerialized ?? true);
                await equipmentRepository.InsertAsync(equipment);
            }
            else if (row.IsSerialized.HasValue)
            {
                await equipmentManager.SetSerializedAsync(equipment, row.IsSerialized.Value);
            }

            var folderId = string.IsNullOrWhiteSpace(row.Folder) ? equipment.FolderId : await EnsureFolderPathAsync(folders, row.Folder);
            equipment.Update(string.IsNullOrWhiteSpace(row.Name) ? equipment.Name : row.Name.Trim(), row.Brand ?? equipment.Brand,
                row.Model ?? equipment.Model, folderId, equipment.Type, equipment.CountryOfOrigin, row.Notes ?? equipment.Notes);
            equipment.UpdatePhysical(row.LengthCm ?? equipment.LengthCm, row.WidthCm ?? equipment.WidthCm, row.HeightCm ?? equipment.HeightCm,
                row.WeightKg ?? equipment.WeightKg, equipment.VolumeM3, row.PowerW ?? equipment.PowerW, equipment.CurrentA, equipment.PackedPer);
            if (row.StockQuantity.HasValue)
            {
                equipment.SetStockQuantity(row.StockQuantity.Value);
            }

            if (showPrice && row.RentalPrice.HasValue)
            {
                equipment.SetRentalPrice(row.RentalPrice.Value);
            }

            await unitOfWork.SaveChangesAsync();
            return created;
        });
    }

    private async Task<Guid?> EnsureFolderPathAsync(List<EquipmentFolder> folders, string path)
    {
        Guid? parentId = null;
        foreach (var name in path.Split(['/', '>', '\\'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var folder = folders.FirstOrDefault(f => f.ParentId == parentId && string.Equals(f.Name, name, StringComparison.CurrentCultureIgnoreCase));
            if (folder is null)
            {
                folder = await folderManager.CreateAsync(name, parentId);
                await folderRepository.InsertAsync(folder);
                await unitOfWork.SaveChangesAsync();
                folders.Add(folder);
            }

            parentId = folder.Id;
        }

        return parentId;
    }

    private async Task DeleteImageAsync(Guid? attachmentId)
    {
        if (attachmentId.HasValue && await attachmentRepository.FindAsync(attachmentId.Value) is { } old)
        {
            await attachmentRepository.DeleteAsync(old);
        }
    }

    private async Task ApplyAsync(Equipment equipment, CreateUpdateEquipmentDto input)
    {
        equipment.Update(input.Name.Trim(), input.Brand, input.Model, input.FolderId, input.Type, input.CountryOfOrigin, input.Notes);
        equipment.UpdatePhysical(input.LengthCm, input.WidthCm, input.HeightCm, input.WeightKg, input.VolumeM3, input.PowerW,
            input.CurrentA, input.PackedPer);
        equipment.SetInspection(input.InspectionIntervalMonths, input.InspectionDescription);
        equipment.SetStockQuantity(input.StockQuantity);
        equipment.SetShowInQuotes(input.ShowInQuotes);
        equipment.SetPurchase(input.PurchaseDate, input.WarrantyEndDate, input.PurchaseSupplierId);
        if (input.RentalPrice.HasValue && await prices.CanSeeAsync() && input.RentalPrice.Value != equipment.RentalPrice)
        {
            // Typed by hand: from now on the price no longer follows the content total.
            equipment.SetRentalPrice(input.RentalPrice.Value);
            equipment.SetPriceManual(true);
        }
    }

    private async Task<EquipmentDetailDto> BuildDetailAsync(Equipment equipment)
    {
        var id = equipment.Id;
        var relatedIds = equipment.Relations.Select(r => r.RelatedEquipmentId).Append(id).ToList();
        var related = (await equipmentRepository.GetListByIdsAsync(relatedIds)).ToDictionary(e => e.Id);
        var stock = await equipmentRepository.GetStockQuantitiesAsync(relatedIds);
        var supplierNames = (await supplierRepository.GetListByIdsAsync(equipment.Suppliers.Select(s => s.SupplierId))).ToDictionary(s => s.Id, s => s.Name);
        var locations = (await locationRepository.GetListAsync()).ToDictionary(l => l.Id, l => l.Name);
        var folders = await folderRepository.GetListAsync();
        var showPrice = await prices.CanSeeAsync();

        var dto = new EquipmentDetailDto().FillEquipment(equipment, stock.GetValueOrDefault(id), showPrice);
        dto.StockQuantity = equipment.StockQuantity;
        dto.IsPriceManual = equipment.IsPriceManual;
        dto.ContentPriceTotal = showPrice && equipment.Relations.Any(r => r.Kind == EquipmentRelationKind.Content)
            ? await equipmentManager.GetContentPriceTotalAsync(equipment)
            : null;
        dto.ContainedIn = (await equipmentRepository.GetContainersOfAsync([id])).GetValueOrDefault(id)?
            .Select(c => new EquipmentRefDto { Id = c.Id, Code = c.Code, Name = c.Name }).ToList() ?? [];
        dto.PurchaseSupplierName = equipment.PurchaseSupplierId.HasValue
            ? (await supplierRepository.FindAsync(equipment.PurchaseSupplierId.Value))?.Name
            : null;
        dto.CountryOfOrigin = equipment.CountryOfOrigin;
        dto.LengthCm = equipment.LengthCm;
        dto.WidthCm = equipment.WidthCm;
        dto.HeightCm = equipment.HeightCm;
        dto.PowerW = equipment.PowerW;
        dto.CurrentA = equipment.CurrentA;
        dto.PackedPer = equipment.PackedPer;
        dto.ImageAttachmentId = equipment.ImageAttachmentId;
        dto.InspectionIntervalMonths = equipment.InspectionIntervalMonths;
        dto.InspectionDescription = equipment.InspectionDescription;
        dto.FolderPath = GetFolderPath(folders, equipment.FolderId);
        dto.Labels = (await labelRepository.GetListByEquipmentAsync(id)).Where(l => l.UnitId is null).Select(l => l.ToDto()).ToList();
        dto.UnitStatusCounts = await unitRepository.GetStatusCountsAsync(id);
        dto.Relations = equipment.Relations.OrderBy(r => r.Kind).ThenBy(r => r.SortOrder)
            .Where(r => related.ContainsKey(r.RelatedEquipmentId))
            .Select(r => new EquipmentRelationDto
            {
                Id = r.Id,
                Kind = r.Kind,
                EquipmentId = r.RelatedEquipmentId,
                EquipmentCode = related[r.RelatedEquipmentId].Code,
                EquipmentName = related[r.RelatedEquipmentId].Name,
                Quantity = r.Quantity,
                Stock = stock.GetValueOrDefault(r.RelatedEquipmentId)
            }).ToList();
        dto.PartOf = (await equipmentRepository.GetContainersAsync(id)).Select(c => new EquipmentRelationDto
        {
            Id = c.Container.Id,
            Kind = EquipmentRelationKind.Content,
            EquipmentId = c.Container.Id,
            EquipmentCode = c.Container.Code,
            EquipmentName = c.Container.Name,
            Quantity = c.Quantity
        }).ToList();
        dto.Suppliers = equipment.Suppliers.OrderByDescending(s => s.IsPreferred).Select(s => new EquipmentSupplierDto
        {
            Id = s.Id,
            SupplierId = s.SupplierId,
            SupplierName = supplierNames.GetValueOrDefault(s.SupplierId, "?"),
            SupplierCode = s.SupplierCode,
            PurchasePrice = showPrice ? s.PurchasePrice : null,
            IsPreferred = s.IsPreferred
        }).ToList();
        dto.StockRows = (await unitRepository.GetStockRowsAsync(id))
            .OrderBy(r => r.StockLocationId.HasValue ? locations.GetValueOrDefault(r.StockLocationId.Value) : "~").ThenBy(r => r.Status)
            .Select(r => new StockRowDto
            {
                StockLocationId = r.StockLocationId,
                StockLocationName = r.StockLocationId.HasValue ? locations.GetValueOrDefault(r.StockLocationId.Value) : null,
                Status = r.Status,
                Count = r.Count
            }).ToList();
        return dto;
    }

    private static string? GetFolderPath(List<EquipmentFolder> folders, Guid? folderId)
    {
        var names = new List<string>();
        for (var current = folders.FirstOrDefault(f => f.Id == folderId); current is not null; current = folders.FirstOrDefault(f => f.Id == current.ParentId))
        {
            names.Insert(0, current.Name);
        }

        return names.Count == 0 ? null : string.Join(" / ", names);
    }
}

public class EquipmentUnitAppService(
    IEquipmentUnitRepository unitRepository,
    IEquipmentRepository equipmentRepository,
    IEquipmentLabelRepository labelRepository,
    IStockLocationRepository locationRepository,
    IAttachmentRepository attachmentRepository,
    EquipmentUnitManager unitManager,
    LabelManager labelManager,
    AttachmentManager attachmentManager,
    TransferManager transferManager,
    IPermissionChecker permissionChecker,
    ImportRunner importRunner,
    ICurrentUser currentUser,
    IUnitOfWork unitOfWork) : IEquipmentUnitAppService
{
    public async Task<PagedResultDto<EquipmentUnitDto>> GetListAsync(GetEquipmentUnitListInput input)
    {
        var filter = new EquipmentUnitFilter
        {
            Text = input.Text, EquipmentId = input.EquipmentId, Status = input.Status, StockLocationId = input.StockLocationId,
            IncludeArchived = input.IncludeArchived
        };

        var total = await unitRepository.GetCountAsync(filter);
        var items = await unitRepository.GetPagedListAsync(filter, input.SkipCount, input.MaxResultCount);
        return new PagedResultDto<EquipmentUnitDto>(total, items.Select(x => x.ToDto()).ToList());
    }

    public async Task<EquipmentUnitDetailDto> GetAsync(Guid id) => await BuildDetailAsync(id);

    public Task<string> SuggestInternalRefAsync(Guid equipmentId) => unitManager.SuggestInternalRefAsync(equipmentId);

    public async Task<EquipmentUnitDto> CreateAsync(CreateEquipmentUnitDto input)
    {
        var equipment = await equipmentRepository.GetAsync(input.EquipmentId);
        var unit = await unitManager.CreateAsync(equipment, input.InternalRef, input.SerialNumber, input.StockLocationId);
        unit.Update(unit.SerialNumber, input.StockLocationId, input.Notes);
        unit.UpdateDetails(input.PurchaseDate, null, null, input.SupplierId);
        await unitRepository.InsertAsync(unit);

        if (!string.IsNullOrWhiteSpace(input.LabelCode))
        {
            await unitOfWork.SaveChangesAsync();
            await labelRepository.InsertAsync(await labelManager.AssignAsync(input.LabelCode, LabelType.RentmanQr, null, unit.Id));
        }

        return unit.ToDto(equipment);
    }

    public async Task<EquipmentUnitDetailDto> UpdateAsync(Guid id, UpdateEquipmentUnitDto input)
    {
        var unit = await unitRepository.GetAsync(id);
        await unitManager.ChangeInternalRefAsync(unit, input.InternalRef);
        unit.Update(input.SerialNumber?.Trim(), input.StockLocationId, RichTextSanitizer.Sanitize(input.Notes));
        unit.UpdateDetails(input.PurchaseDate, input.WarrantyDate, input.ReplacementDate, input.SupplierId);
        await unitOfWork.SaveChangesAsync();
        return await BuildDetailAsync(id);
    }

    public async Task ChangeStatusAsync(Guid id, ChangeUnitStatusInput input) =>
        unitManager.ChangeStatus(await unitRepository.GetAsync(id), input.Status);

    public async Task ArchiveAsync(Guid id) => unitManager.Archive(await unitRepository.GetAsync(id));

    public async Task RestoreAsync(Guid id) => unitManager.Restore(await unitRepository.GetAsync(id));

    public async Task<List<LabelDto>> GetLabelsAsync(Guid id) =>
        (await labelRepository.GetListByUnitAsync(id)).Select(l => l.ToDto()).ToList();

    public async Task<EquipmentUnitDetailDto> SetImageAsync(Guid id, UploadFileInput file)
    {
        var unit = await unitRepository.GetAsync(id);
        var attachment = attachmentManager.Create(OwnerType.Unit, id, file.FileName, file.ContentType, file.Content, imageOnly: true);
        await attachmentRepository.InsertAsync(attachment);
        if (unit.ImageAttachmentId.HasValue && await attachmentRepository.FindAsync(unit.ImageAttachmentId.Value) is { } old)
        {
            await attachmentRepository.DeleteAsync(old);
        }

        unit.SetImage(attachment.Id);
        await unitOfWork.SaveChangesAsync();
        return await BuildDetailAsync(id);
    }

    public async Task<EquipmentUnitDetailDto> RemoveImageAsync(Guid id)
    {
        var unit = await unitRepository.GetAsync(id);
        if (unit.ImageAttachmentId.HasValue && await attachmentRepository.FindAsync(unit.ImageAttachmentId.Value) is { } old)
        {
            await attachmentRepository.DeleteAsync(old);
        }

        unit.SetImage(null);
        await unitOfWork.SaveChangesAsync();
        return await BuildDetailAsync(id);
    }

    public async Task<TransferResultDto> TransferAsync(TransferUnitsInput input)
    {
        if (!await permissionChecker.HasCompanyAccessAsync(input.TargetCompanyId))
        {
            throw new BusinessException(StageTrackErrorCodes.CompanyAccessDenied);
        }

        var result = await transferManager.TransferUnitsAsync(input.UnitIds, input.TargetCompanyId, currentUser.Id);
        return new TransferResultDto
        {
            TargetCompanyId = result.TargetCompanyId,
            TargetCompanyName = result.TargetCompanyName,
            TargetLocationName = result.TargetLocationName,
            UnitCount = result.UnitCount
        };
    }

    /// <summary>Upsert by internal reference; the optional label column links an existing Rentman label.</summary>
    public async Task<ImportResultDto> ImportAsync(List<UnitImportRow> rows)
    {
        var locations = await locationRepository.GetListAsync();
        return await importRunner.RunAsync(rows, r => r.Row, async row =>
        {
            var equipmentCode = ImportRunner.Required(row.EquipmentCode, "equipmentCode");
            var internalRef = ImportRunner.Required(row.InternalRef, "internalRef");
            var equipment = await equipmentRepository.FindByCodeAsync(equipmentCode)
                            ?? throw new BusinessException(StageTrackErrorCodes.ImportInvalidRow).WithData("field", "equipmentCode");
            var locationId = string.IsNullOrWhiteSpace(row.StockLocation)
                ? (Guid?)null
                : locations.FirstOrDefault(l => string.Equals(l.Name, row.StockLocation.Trim(), StringComparison.CurrentCultureIgnoreCase))?.Id
                  ?? throw new BusinessException(StageTrackErrorCodes.ImportInvalidRow).WithData("field", "stockLocation");

            var unit = await unitRepository.FindByInternalRefAsync(equipment.Id, internalRef);
            var created = unit is null;
            if (unit is null)
            {
                unit = await unitManager.CreateAsync(equipment, internalRef, row.SerialNumber, locationId);
                await unitRepository.InsertAsync(unit);
            }

            unit.Update(row.SerialNumber ?? unit.SerialNumber, locationId ?? unit.StockLocationId, unit.Notes);
            unit.UpdateDetails(row.PurchaseDate ?? unit.PurchaseDate, unit.WarrantyDate, unit.ReplacementDate, unit.SupplierId);
            await unitOfWork.SaveChangesAsync();

            if (!string.IsNullOrWhiteSpace(row.LabelCode))
            {
                var target = await labelManager.ResolveAsync(row.LabelCode);
                if (target?.Unit?.Id != unit.Id)
                {
                    await labelRepository.InsertAsync(await labelManager.AssignAsync(row.LabelCode, LabelType.RentmanQr, null, unit.Id));
                    await unitOfWork.SaveChangesAsync();
                }
            }

            return created;
        });
    }

    private async Task<EquipmentUnitDetailDto> BuildDetailAsync(Guid id)
    {
        var item = await unitRepository.GetListItemAsync(id) ?? throw new EntityNotFoundException(typeof(EquipmentUnit), id);
        var equipment = await equipmentRepository.GetAsync(item.Unit.EquipmentId, includeDetails: false);
        var dto = new EquipmentUnitDetailDto().FillUnit(item);
        dto.EquipmentBrand = equipment.Brand;
        dto.EquipmentModel = equipment.Model;
        dto.InspectionIntervalMonths = equipment.InspectionIntervalMonths;
        dto.Labels = (await labelRepository.GetListByUnitAsync(id)).Select(l => l.ToDto()).ToList();
        return dto;
    }
}

public class LabelAppService(
    IEquipmentLabelRepository labelRepository,
    IEquipmentRepository equipmentRepository,
    IEquipmentUnitRepository unitRepository,
    IWarehouseMovementRepository movementRepository,
    LabelManager labelManager,
    WarehouseManager warehouseManager,
    PriceVisibility prices,
    ICurrentUser currentUser,
    IUnitOfWork unitOfWork) : ILabelAppService
{
    public async Task<ResolveLabelResultDto> ResolveAsync(string code)
    {
        var target = await labelManager.ResolveAsync(code);
        if (target is null)
        {
            return new ResolveLabelResultDto { Found = false, Code = LabelManager.Normalize(code) };
        }

        var stock = await equipmentRepository.GetStockQuantitiesAsync([target.Equipment.Id]);
        EquipmentUnitDto? unit = null;
        if (target.Unit is not null)
        {
            unit = (await unitRepository.GetListItemAsync(target.Unit.Id))?.ToDto() ?? target.Unit.ToDto(target.Equipment);
        }

        return new ResolveLabelResultDto
        {
            Found = true,
            Code = target.Label.Code,
            Label = target.Label.ToDto(),
            Equipment = target.Equipment.ToDto(stock.GetValueOrDefault(target.Equipment.Id), await prices.CanSeeAsync()),
            Unit = unit
        };
    }

    public async Task<LabelDto> AssignAsync(AssignLabelInput input)
    {
        var label = await labelManager.AssignAsync(input.Code, input.Type, input.EquipmentId, input.UnitId);
        await labelRepository.InsertAsync(label);
        await movementRepository.InsertAsync(warehouseManager.CreateLabelAssignedMovement(label, currentUser.Id));
        return label.ToDto();
    }

    public async Task DeleteAsync(Guid id) => await labelRepository.DeleteAsync(await labelRepository.GetAsync(id));

    public async Task<List<PrintLabelItemDto>> PreparePrintAsync(PrintLabelsInput input)
    {
        var result = new List<PrintLabelItemDto>();

        var units = await unitRepository.GetListByIdsAsync(input.UnitIds);
        var unitLabels = (await labelRepository.GetListByUnitsAsync(input.UnitIds)).ToLookup(l => l.UnitId!.Value);
        var equipmentIds = units.Select(u => u.EquipmentId).Concat(input.EquipmentIds).ToList();
        var equipment = (await equipmentRepository.GetListByIdsAsync(equipmentIds)).ToDictionary(e => e.Id);

        foreach (var unit in units.OrderBy(u => equipment[u.EquipmentId].Code).ThenBy(u => u.InternalRef))
        {
            var item = equipment[unit.EquipmentId];
            var (label, isNew) = await GetOrCreateAsync(PickLabel(unitLabels[unit.Id]), item, unit, input.CreateMissing);
            if (label is not null)
            {
                result.Add(ToPrintItem(item, unit, label, isNew));
            }
        }

        foreach (var equipmentId in input.EquipmentIds.Distinct())
        {
            var item = equipment[equipmentId];
            var existing = (await labelRepository.GetListByEquipmentAsync(equipmentId)).Where(l => l.UnitId is null);
            var (label, isNew) = await GetOrCreateAsync(PickLabel(existing), item, null, input.CreateMissing);
            if (label is not null)
            {
                result.Add(ToPrintItem(item, null, label, isNew));
            }
        }

        return result;
    }

    /// <summary>The label to print: an existing Rentman label first (it is already on the device), then our own.</summary>
    private static EquipmentLabel? PickLabel(IEnumerable<EquipmentLabel> labels) =>
        labels.OrderBy(l => l.Type == LabelType.RentmanQr ? 0 : l.Type == LabelType.Qr ? 1 : 2).ThenBy(l => l.CreationTime).FirstOrDefault();

    private async Task<(EquipmentLabel? Label, bool IsNew)> GetOrCreateAsync(EquipmentLabel? existing, Equipment equipment, EquipmentUnit? unit, bool create)
    {
        if (existing is not null || !create)
        {
            return (existing, false);
        }

        var label = await labelManager.CreateOwnLabelAsync(equipment, unit);
        await labelRepository.InsertAsync(label);
        await unitOfWork.SaveChangesAsync(); // the next new label continues from this number
        return (label, true);
    }

    private static PrintLabelItemDto ToPrintItem(Equipment equipment, EquipmentUnit? unit, EquipmentLabel label, bool isNew) => new()
    {
        EquipmentId = equipment.Id,
        UnitId = unit?.Id,
        EquipmentCode = equipment.Code,
        EquipmentName = equipment.Name,
        Brand = equipment.Brand,
        Model = equipment.Model,
        InternalRef = unit?.InternalRef,
        SerialNumber = unit?.SerialNumber,
        QrValue = label.RawValue,
        Code = label.Code,
        IsNew = isNew
    };
}

public class LabelTemplateAppService(
    ILabelTemplateRepository templateRepository,
    LabelTemplateManager templateManager) : ILabelTemplateAppService
{
    public async Task<List<LabelTemplateDto>> GetListAsync() =>
        (await templateRepository.GetListAsync()).Select(t => t.ToDto()).ToList();

    public async Task<LabelTemplateDto> CreateAsync(CreateUpdateLabelTemplateDto input)
    {
        var template = new LabelTemplate(Guid.CreateVersion7(), input.Name.Trim());
        Apply(template, input);
        if (input.IsDefault)
        {
            await templateManager.SetDefaultAsync(template);
        }
        else
        {
            await templateManager.EnsureDefaultExistsAsync(template);
        }

        await templateRepository.InsertAsync(template);
        return template.ToDto();
    }

    public async Task<LabelTemplateDto> UpdateAsync(Guid id, CreateUpdateLabelTemplateDto input)
    {
        var template = await templateRepository.GetAsync(id);
        Apply(template, input);
        if (input.IsDefault)
        {
            await templateManager.SetDefaultAsync(template);
        }

        return template.ToDto();
    }

    public async Task DeleteAsync(Guid id) => await templateRepository.DeleteAsync(await templateRepository.GetAsync(id));

    private static void Apply(LabelTemplate template, CreateUpdateLabelTemplateDto input)
    {
        template.Update(input.Name.Trim(), input.WidthMm, input.HeightMm, input.QrSizeMm, input.FontSizePt);
        template.SetFields(input.ShowName, input.ShowBrand, input.ShowModel, input.ShowCode, input.ShowInternalRef,
            input.ShowSerialNumber, input.ShowCompanyName);
    }
}

public class StockLocationAppService(
    IStockLocationRepository locationRepository,
    StockLocationManager locationManager) : IStockLocationAppService
{
    public async Task<List<StockLocationDto>> GetListAsync() =>
        (await locationRepository.GetListAsync()).Select(l => l.ToDto()).ToList();

    public async Task<StockLocationDto> CreateAsync(CreateUpdateStockLocationDto input)
    {
        var location = new StockLocation(Guid.CreateVersion7(), input.Name.Trim(), input.Type, input.Address, input.City);
        await locationRepository.InsertAsync(location);
        return location.ToDto();
    }

    public async Task<StockLocationDto> UpdateAsync(Guid id, CreateUpdateStockLocationDto input)
    {
        var location = await locationRepository.GetAsync(id);
        location.Update(input.Name.Trim(), input.Type, input.Address, input.City, input.IsActive);
        return location.ToDto();
    }

    public async Task DeleteAsync(Guid id)
    {
        var location = await locationRepository.GetAsync(id);
        await locationManager.EnsureCanDeleteAsync(location);
        await locationRepository.DeleteAsync(location);
    }
}
