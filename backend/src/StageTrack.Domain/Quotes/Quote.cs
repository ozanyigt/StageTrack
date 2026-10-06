using StageTrack.Entities;

namespace StageTrack.Quotes;

/// <summary>
/// Offer sent to the customer for a project. Prices and the day multiplier are copied (snapshotted)
/// into the quote, so later catalog or multiplier changes never alter a quote that was already sent.
/// </summary>
public class Quote : CompanyAggregateRoot
{
    public Guid ProjectId { get; private set; }
    public string Number { get; private set; } = null!;
    public int Revision { get; private set; }
    public QuoteStatus Status { get; private set; } = QuoteStatus.Draft;
    public DateTime IssueDate { get; private set; }
    public DateTime? ValidUntil { get; private set; }
    public string Currency { get; private set; } = null!;

    public Guid? RentalFactorProfileId { get; private set; }
    public int RentalDays { get; private set; }
    public decimal Factor { get; private set; }

    public decimal DiscountPercent { get; private set; }
    public decimal VatRate { get; private set; }
    public string? Notes { get; private set; }

    /// <summary>Why the customer declined (price, dates, competitor…); kept for lost-business reporting.</summary>
    public string? RejectionReason { get; private set; }

    public decimal Subtotal { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal NetTotal { get; private set; }
    public decimal VatAmount { get; private set; }
    public decimal GrandTotal { get; private set; }

    public ICollection<QuoteLine> Lines { get; private set; } = new List<QuoteLine>();

    private Quote()
    {
    }

    internal Quote(Guid id, Guid projectId, string number, int revision, DateTime issueDate, string currency,
        decimal vatRate) : base(id)
    {
        ProjectId = projectId;
        Number = number;
        Revision = revision;
        IssueDate = issueDate;
        Currency = currency;
        SetVatRate(vatRate);
    }

    public bool IsEditable => Status == QuoteStatus.Draft;

    internal void SetRentalPeriod(int days, decimal factor, Guid? profileId)
    {
        EnsureEditable();
        RentalDays = Math.Max(1, days);
        Factor = factor;
        RentalFactorProfileId = profileId;
        Recalculate();
    }

    public void UpdateHeader(DateTime issueDate, DateTime? validUntil, decimal discountPercent, decimal vatRate, string? notes)
    {
        EnsureEditable();
        if (discountPercent is < 0 or > 100)
        {
            throw new BusinessException(StageTrackErrorCodes.QuoteInvalidDiscount);
        }

        IssueDate = issueDate;
        ValidUntil = validUntil;
        DiscountPercent = discountPercent;
        SetVatRate(vatRate);
        Notes = notes;
        Recalculate();
    }

    public QuoteLine AddLine(QuoteLineType type, Guid? equipmentId, string description, decimal quantity,
        decimal unitPrice, bool applyFactor, decimal discountPercent, string? section = null, string? notes = null)
    {
        EnsureEditable();
        var line = new QuoteLine(Guid.CreateVersion7(), Id, Lines.Count + 1);
        line.Set(type, equipmentId, description, quantity, unitPrice, applyFactor, discountPercent);
        line.SetPlacement(section, notes);
        Lines.Add(line);
        Recalculate();
        return line;
    }

    public void UpdateLine(Guid lineId, QuoteLineType type, string description, decimal quantity, decimal unitPrice,
        bool applyFactor, decimal discountPercent, string? section, string? notes)
    {
        EnsureEditable();
        var line = GetLine(lineId);
        line.Set(type, line.EquipmentId, description, quantity, unitPrice, applyFactor, discountPercent);
        line.SetPlacement(section, notes);
        Recalculate();
    }

    public void RemoveLine(Guid lineId)
    {
        EnsureEditable();
        Lines.Remove(GetLine(lineId));
        Recalculate();
    }

    internal void SetStatus(QuoteStatus status) => Status = status;

    internal void Reject(string? reason)
    {
        Status = QuoteStatus.Rejected;
        RejectionReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
    }

    /// <summary>Replaces the equipment lines (lines of other types stay as they are).</summary>
    internal void ReplaceEquipmentLines(IEnumerable<(Guid EquipmentId, string Description, decimal Quantity, decimal UnitPrice, bool ApplyFactor,
        decimal DiscountPercent, string? Section, string? Notes, bool IsContent)> lines)
    {
        EnsureEditable();
        foreach (var line in Lines.Where(l => l.Type == QuoteLineType.Equipment).ToList())
        {
            Lines.Remove(line);
        }

        // Equipment first (in project order), then personnel, transport and services keep their relative order.
        var others = Lines.OrderBy(l => l.SortOrder).ToList();
        var order = 1;
        foreach (var item in lines)
        {
            var line = new QuoteLine(Guid.CreateVersion7(), Id, order++);
            line.Set(QuoteLineType.Equipment, item.EquipmentId, item.Description, item.Quantity, item.UnitPrice, item.ApplyFactor, item.DiscountPercent);
            line.SetPlacement(item.Section, item.Notes);
            line.SetContent(item.IsContent);
            Lines.Add(line);
        }

        foreach (var line in others)
        {
            line.SetSortOrder(order++);
        }

        Recalculate();
    }

    /// <summary>Copies everything except identity and status into a new draft with the next revision number.</summary>
    internal Quote CreateRevision(Guid id, DateTime issueDate)
    {
        var copy = new Quote(id, ProjectId, Number, Revision + 1, issueDate, Currency, VatRate)
        {
            ValidUntil = ValidUntil,
            RentalDays = RentalDays,
            Factor = Factor,
            RentalFactorProfileId = RentalFactorProfileId,
            DiscountPercent = DiscountPercent,
            Notes = Notes
        };

        foreach (var line in Lines.OrderBy(l => l.SortOrder))
        {
            var newLine = new QuoteLine(Guid.CreateVersion7(), id, line.SortOrder);
            newLine.Set(line.Type, line.EquipmentId, line.Description, line.Quantity, line.UnitPrice, line.ApplyFactor, line.DiscountPercent);
            newLine.SetPlacement(line.Section, line.Notes);
            newLine.SetContent(line.IsContent);
            copy.Lines.Add(newLine);
        }

        copy.Recalculate();
        return copy;
    }

    private void Recalculate()
    {
        foreach (var line in Lines)
        {
            line.Calculate(Factor);
        }

        Subtotal = Lines.Sum(l => l.Total);
        DiscountAmount = Math.Round(Subtotal * DiscountPercent / 100m, 2, MidpointRounding.AwayFromZero);
        NetTotal = Subtotal - DiscountAmount;
        VatAmount = Math.Round(NetTotal * VatRate / 100m, 2, MidpointRounding.AwayFromZero);
        GrandTotal = NetTotal + VatAmount;
    }

    private void SetVatRate(decimal vatRate)
    {
        if (vatRate is < 0 or > 100)
        {
            throw new BusinessException(StageTrackErrorCodes.QuoteInvalidVatRate);
        }

        VatRate = vatRate;
    }

    private QuoteLine GetLine(Guid lineId) =>
        Lines.FirstOrDefault(l => l.Id == lineId) ?? throw new BusinessException(StageTrackErrorCodes.QuoteLineNotFound);

    private void EnsureEditable()
    {
        if (!IsEditable)
        {
            throw new BusinessException(StageTrackErrorCodes.QuoteNotEditable).WithData("status", Status);
        }
    }
}

public class QuoteLine : Entity
{
    public Guid QuoteId { get; private set; }
    public int SortOrder { get; private set; }
    public QuoteLineType Type { get; private set; }
    public Guid? EquipmentId { get; private set; }
    public string Description { get; private set; } = null!;
    public decimal Quantity { get; private set; }

    /// <summary>Daily price for equipment lines; flat price for crew, transport and services.</summary>
    public decimal UnitPrice { get; private set; }

    /// <summary>When true the line total is multiplied by the quote's day multiplier.</summary>
    public bool ApplyFactor { get; private set; }

    public decimal DiscountPercent { get; private set; }
    public decimal Total { get; private set; }

    /// <summary>Section path copied from the project ("Ses / Hoparlör"); lines are grouped by it on the document.</summary>
    public string? Section { get; private set; }

    /// <summary>Remark printed under the line, e.g. "10 adet headset / 2 adet el telsiz".</summary>
    public string? Notes { get; private set; }

    private QuoteLine()
    {
    }

    internal QuoteLine(Guid id, Guid quoteId, int sortOrder) : base(id)
    {
        QuoteId = quoteId;
        SortOrder = sortOrder;
    }

    internal void Set(QuoteLineType type, Guid? equipmentId, string description, decimal quantity, decimal unitPrice,
        bool applyFactor, decimal discountPercent)
    {
        if (discountPercent is < 0 or > 100)
        {
            throw new BusinessException(StageTrackErrorCodes.QuoteInvalidDiscount);
        }

        if (quantity <= 0)
        {
            throw new BusinessException(StageTrackErrorCodes.ProjectQuantityMustBePositive);
        }

        Type = type;
        EquipmentId = equipmentId;
        Description = description;
        Quantity = quantity;
        UnitPrice = Math.Max(0, unitPrice);
        ApplyFactor = applyFactor;
        DiscountPercent = discountPercent;
    }

    internal void SetSortOrder(int sortOrder) => SortOrder = sortOrder;

    /// <summary>Content of the case line above it: listed for information, not priced.</summary>
    public bool IsContent { get; private set; }

    internal void SetContent(bool isContent) => IsContent = isContent;

    internal void SetPlacement(string? section, string? notes)
    {
        Section = string.IsNullOrWhiteSpace(section) ? null : section.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
    }

    internal void Calculate(decimal factor)
    {
        var gross = Quantity * UnitPrice * (ApplyFactor ? factor : 1m);
        Total = Math.Round(gross * (1 - DiscountPercent / 100m), 2, MidpointRounding.AwayFromZero);
    }
}
