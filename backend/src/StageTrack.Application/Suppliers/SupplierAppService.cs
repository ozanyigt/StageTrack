using StageTrack.Dtos;

namespace StageTrack.Suppliers;

public class SupplierAppService(ISupplierRepository supplierRepository, SupplierManager supplierManager) : ISupplierAppService
{
    public async Task<PagedResultDto<SupplierDto>> GetListAsync(GetSupplierListInput input)
    {
        var total = await supplierRepository.GetCountAsync(input.Text);
        var items = await supplierRepository.GetPagedListAsync(input.Text, input.SkipCount, input.MaxResultCount);
        return new PagedResultDto<SupplierDto>(total, items.Select(s => s.ToDto()).ToList());
    }

    public async Task<List<LookupDto>> GetLookupAsync(string? text) =>
        (await supplierRepository.GetPagedListAsync(text, 0, 50)).Select(s => new LookupDto { Id = s.Id, Name = s.Name }).ToList();

    public async Task<SupplierDto> CreateAsync(CreateUpdateSupplierDto input)
    {
        var supplier = await supplierManager.CreateAsync(input.Name);
        Apply(supplier, input);
        await supplierRepository.InsertAsync(supplier);
        return supplier.ToDto();
    }

    public async Task<SupplierDto> UpdateAsync(Guid id, CreateUpdateSupplierDto input)
    {
        var supplier = await supplierRepository.GetAsync(id);
        await supplierManager.RenameAsync(supplier, input.Name);
        Apply(supplier, input);
        return supplier.ToDto();
    }

    public async Task DeleteAsync(Guid id)
    {
        var supplier = await supplierRepository.GetAsync(id);
        await supplierManager.EnsureCanDeleteAsync(supplier);
        await supplierRepository.DeleteAsync(supplier);
    }

    private static void Apply(Supplier supplier, CreateUpdateSupplierDto input) =>
        supplier.Update(input.ContactPerson, input.Email, input.Phone, input.TaxNumber, input.TaxOffice, input.Address,
            input.City, input.Country, input.Website, input.Notes);
}
