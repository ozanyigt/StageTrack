using StageTrack.Companies;
using StageTrack.Customers;
using StageTrack.Dtos;
using StageTrack.Identity;
using StageTrack.Inventory;
using StageTrack.Pricing;
using StageTrack.Projects;
using StageTrack.Repositories;
using StageTrack.Session;

namespace StageTrack.Quotes;

public class QuoteAppService(
    IQuoteRepository quoteRepository,
    IProjectRepository projectRepository,
    ICustomerRepository customerRepository,
    ICompanyRepository companyRepository,
    IEquipmentRepository equipmentRepository,
    IRentalFactorProfileRepository profileRepository,
    IUserRepository userRepository,
    QuoteManager quoteManager,
    ProjectManager projectManager,
    ICurrentCompany currentCompany,
    IUnitOfWork unitOfWork) : IQuoteAppService
{
    public async Task<PagedResultDto<QuoteListItemDto>> GetListAsync(GetQuoteListInput input)
    {
        var filter = new QuoteFilter { Text = input.Text, ProjectId = input.ProjectId, Status = input.Status };
        var total = await quoteRepository.GetCountAsync(filter);
        var items = await quoteRepository.GetPagedListAsync(filter, input.SkipCount, input.MaxResultCount);
        return new PagedResultDto<QuoteListItemDto>(total, items.Select(x => x.ToDto()).ToList());
    }

    public async Task<QuoteDto> GetAsync(Guid id) => await BuildDtoAsync(await quoteRepository.GetAsync(id));

    public async Task<QuoteDto> CreateAsync(CreateQuoteInput input)
    {
        var project = await projectRepository.GetAsync(input.ProjectId);
        var company = await companyRepository.GetAsync(currentCompany.Id!.Value);
        var quote = await quoteManager.CreateFromProjectAsync(project, company, input.RentalFactorProfileId, DateTime.Today);
        await quoteRepository.InsertAsync(quote);
        await unitOfWork.SaveChangesAsync();
        return await BuildDtoAsync(quote);
    }

    public async Task<QuoteDto> UpdateHeaderAsync(Guid id, UpdateQuoteHeaderInput input)
    {
        var quote = await quoteRepository.GetAsync(id);
        quote.UpdateHeader(input.IssueDate, input.ValidUntil, input.DiscountPercent, input.VatRate, input.Notes);
        await quoteManager.ApplyRentalPeriodAsync(quote, input.RentalDays, input.RentalFactorProfileId, input.ManualFactor);
        await unitOfWork.SaveChangesAsync();
        return await BuildDtoAsync(quote);
    }

    public async Task<QuoteDto> AddLineAsync(Guid id, CreateUpdateQuoteLineInput input)
    {
        var quote = await quoteRepository.GetAsync(id);
        if (input.Type == QuoteLineType.Equipment && input.EquipmentId.HasValue)
        {
            var line = await quoteManager.AddEquipmentLineAsync(quote, input.EquipmentId.Value, input.Quantity, Clean(input.Section));
            if (input.UnitPrice.HasValue || input.DiscountPercent > 0 || !string.IsNullOrWhiteSpace(input.Description) ||
                !string.IsNullOrWhiteSpace(input.Notes))
            {
                quote.UpdateLine(line.Id, line.Type, Describe(input.Description, line.Description), line.Quantity,
                    input.UnitPrice ?? line.UnitPrice, input.ApplyFactor, input.DiscountPercent, line.Section, Clean(input.Notes));
            }
        }
        else
        {
            quote.AddLine(input.Type, null, Describe(input.Description, null), input.Quantity, input.UnitPrice ?? 0,
                input.ApplyFactor, input.DiscountPercent, Clean(input.Section), Clean(input.Notes));
        }

        await unitOfWork.SaveChangesAsync();
        return await BuildDtoAsync(quote);
    }

    public async Task<QuoteDto> UpdateLineAsync(Guid id, Guid lineId, CreateUpdateQuoteLineInput input)
    {
        var quote = await quoteRepository.GetAsync(id);
        var current = quote.Lines.FirstOrDefault(l => l.Id == lineId)
                      ?? throw new BusinessException(StageTrackErrorCodes.QuoteLineNotFound);
        quote.UpdateLine(lineId, input.Type, Describe(input.Description, current.Description), input.Quantity,
            input.UnitPrice ?? current.UnitPrice, input.ApplyFactor, input.DiscountPercent, Clean(input.Section), Clean(input.Notes));
        await unitOfWork.SaveChangesAsync();
        return await BuildDtoAsync(quote);
    }

    public async Task<QuoteDto> RemoveLineAsync(Guid id, Guid lineId)
    {
        var quote = await quoteRepository.GetAsync(id);
        quote.RemoveLine(lineId);
        await unitOfWork.SaveChangesAsync();
        return await BuildDtoAsync(quote);
    }

    public async Task<QuoteDto> ChangeStatusAsync(Guid id, ChangeQuoteStatusInput input)
    {
        var quote = await quoteRepository.GetAsync(id);
        var project = await projectRepository.GetAsync(quote.ProjectId);
        await quoteManager.ChangeStatusAsync(quote, input.Status, project, input.Reason);
        await unitOfWork.SaveChangesAsync();
        return await BuildDtoAsync(quote);
    }

    public async Task<PagedResultDto<QuoteJobDto>> GetJobsAsync(GetQuoteJobsInput input)
    {
        var filter = new ProjectFilter
        {
            Text = input.Text,
            Statuses = input.View switch
            {
                QuoteJobView.Active => [ProjectStatus.Draft, ProjectStatus.Pending],
                QuoteJobView.Lost => [ProjectStatus.Cancelled],
                _ => null
            }
        };

        var total = await projectRepository.GetCountAsync(filter);
        var projects = await projectRepository.GetPagedListAsync(filter, input.Sorting, input.SkipCount, input.MaxResultCount);
        var quotes = (await quoteRepository.GetListByProjectIdsAsync(projects.Select(p => p.Project.Id).ToList()))
            .ToLookup(q => q.Quote.ProjectId);

        var items = projects.Select(p =>
        {
            var jobQuotes = quotes[p.Project.Id].Select(q => q.ToDto()).ToList();
            return new QuoteJobDto
            {
                Project = p.ToDto(),
                Quotes = jobQuotes,
                LatestQuote = jobQuotes.FirstOrDefault()
            };
        }).ToList();
        return new PagedResultDto<QuoteJobDto>(total, items);
    }

    public async Task<QuoteDto> CreateJobAsync(CreateQuoteJobInput input)
    {
        var project = await projectManager.CreateAsync(input.Name, input.PlanStart, input.PlanEnd);
        ProjectAppService.Apply(project, input);
        await projectManager.ChangeStatusAsync(project, ProjectStatus.Pending);
        await projectRepository.InsertAsync(project);
        await unitOfWork.SaveChangesAsync();

        var company = await companyRepository.GetAsync(currentCompany.Id!.Value);
        var quote = await quoteManager.CreateFromProjectAsync(project, company, input.RentalFactorProfileId, DateTime.Today);
        await quoteRepository.InsertAsync(quote);
        await unitOfWork.SaveChangesAsync();
        return await BuildDtoAsync(quote);
    }

    public async Task<QuoteDto> ReopenAsync(Guid id)
    {
        var quote = await quoteRepository.GetAsync(id);
        var project = await projectRepository.GetAsync(quote.ProjectId);
        var revision = await quoteManager.ReopenAsync(quote, project, DateTime.Today);
        await quoteRepository.InsertAsync(revision);
        await unitOfWork.SaveChangesAsync();
        return await BuildDtoAsync(revision);
    }

    public async Task<QuoteDto> SyncFromProjectAsync(Guid id)
    {
        var quote = await quoteRepository.GetAsync(id);
        var project = await projectRepository.GetAsync(quote.ProjectId);
        await quoteManager.SyncFromProjectAsync(quote, project);
        await unitOfWork.SaveChangesAsync();
        return await BuildDtoAsync(quote);
    }

    public async Task<QuoteDto> ReviseAsync(Guid id)
    {
        var quote = await quoteRepository.GetAsync(id);
        var revision = quoteManager.Revise(quote, DateTime.Today);
        await quoteRepository.InsertAsync(revision);
        await unitOfWork.SaveChangesAsync();
        return await BuildDtoAsync(revision);
    }

    public async Task DeleteAsync(Guid id)
    {
        var quote = await quoteRepository.GetAsync(id);
        quoteManager.EnsureCanDelete(quote);
        await quoteRepository.DeleteAsync(quote);
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string Describe(string? description, string? fallback)
    {
        var value = string.IsNullOrWhiteSpace(description) ? fallback : description.Trim();
        return string.IsNullOrWhiteSpace(value)
            ? throw new BusinessException(StageTrackErrorCodes.QuoteLineDescriptionRequired)
            : value;
    }

    private async Task<QuoteDto> BuildDtoAsync(Quote quote)
    {
        var project = await projectRepository.GetAsync(quote.ProjectId, includeDetails: false);
        var customer = project.CustomerId.HasValue ? await customerRepository.FindAsync(project.CustomerId.Value) : null;
        var company = await companyRepository.GetAsync(quote.CompanyId);
        var profile = quote.RentalFactorProfileId.HasValue ? await profileRepository.FindAsync(quote.RentalFactorProfileId.Value, includeDetails: false) : null;
        var equipmentCodes = (await equipmentRepository.GetListByIdsAsync(quote.Lines.Where(l => l.EquipmentId.HasValue).Select(l => l.EquipmentId!.Value)))
            .ToDictionary(e => e.Id, e => e.Code);

        var dto = new QuoteDto().FillQuote(quote, project.Number, project.Name, customer?.Name);
        dto.RentalFactorProfileId = quote.RentalFactorProfileId;
        dto.RentalFactorProfileName = profile?.Name;
        dto.RentalDays = quote.RentalDays;
        dto.Factor = quote.Factor;
        dto.DiscountPercent = quote.DiscountPercent;
        dto.VatRate = quote.VatRate;
        dto.Notes = quote.Notes;
        dto.Subtotal = quote.Subtotal;
        dto.DiscountAmount = quote.DiscountAmount;
        dto.NetTotal = quote.NetTotal;
        dto.VatAmount = quote.VatAmount;
        dto.IsEditable = quote.IsEditable;
        dto.AllowedStatuses = QuoteManager.GetAllowedTargets(quote.Status).ToList();
        dto.Venue = project.Venue;
        dto.UseStart = project.UseStart ?? project.PlanStart;
        dto.UseEnd = project.UseEnd ?? project.PlanEnd;
        dto.Customer = customer?.ToDto();
        dto.Company = company.ToDto();
        dto.PaymentTerms = project.PaymentTerms;
        dto.ProjectStatus = project.Status;
        dto.IsLatestRevision = !(await quoteRepository.GetListByProjectAsync(project.Id))
            .Any(q => q.Number == quote.Number && q.Revision > quote.Revision);
        dto.PreparedByName = project.AccountManagerId.HasValue
            ? (await userRepository.FindAsync(project.AccountManagerId.Value))?.FullName
            : null;
        dto.SectionNames = quote.Lines.Where(l => l.Section != null).OrderBy(l => l.SortOrder).Select(l => l.Section!).Distinct().ToList();
        dto.Lines = quote.Lines.OrderBy(l => l.SortOrder).Select(l => new QuoteLineDto
        {
            Id = l.Id,
            SortOrder = l.SortOrder,
            Type = l.Type,
            EquipmentId = l.EquipmentId,
            EquipmentCode = l.EquipmentId.HasValue ? equipmentCodes.GetValueOrDefault(l.EquipmentId.Value) : null,
            Description = l.Description,
            Quantity = l.Quantity,
            UnitPrice = l.UnitPrice,
            ApplyFactor = l.ApplyFactor,
            DiscountPercent = l.DiscountPercent,
            Total = l.Total,
            Section = l.Section,
            Notes = l.Notes,
            IsContent = l.IsContent
        }).ToList();
        return dto;
    }
}
