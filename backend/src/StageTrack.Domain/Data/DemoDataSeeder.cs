using Microsoft.Extensions.Logging;
using StageTrack.Companies;
using StageTrack.Customers;
using StageTrack.Identity;
using StageTrack.Inventory;
using StageTrack.Maintenance;
using StageTrack.Permissions;
using StageTrack.Pricing;
using StageTrack.Projects;
using StageTrack.Quotes;
using StageTrack.Repositories;
using StageTrack.Session;
using StageTrack.Suppliers;
using StageTrack.Tenants;
using StageTrack.Warehouse;

namespace StageTrack.Data;

/// <summary>
/// Creates a realistic demo data set (names taken from the customer's Rentman screens) relative to today,
/// so the calendar and warehouse board always look "live". Runs only on an empty database.
/// Every device gets a label in the real Rentman QR format; a few devices are left unlabeled on purpose to
/// demonstrate linking an existing Rentman label from the scan screen.
/// </summary>
public class DemoDataSeeder(
    ICompanyRepository companyRepository,
    TenantManager tenantManager,
    ITenantRepository tenantRepository,
    IRoleRepository roleRepository,
    UserManager userManager,
    IStockLocationRepository stockLocationRepository,
    EquipmentFolderManager folderManager,
    IEquipmentFolderRepository folderRepository,
    EquipmentManager equipmentManager,
    IEquipmentRepository equipmentRepository,
    EquipmentUnitManager unitManager,
    IEquipmentUnitRepository unitRepository,
    LabelManager labelManager,
    IEquipmentLabelRepository labelRepository,
    CustomerManager customerManager,
    ICustomerRepository customerRepository,
    ProjectManager projectManager,
    IProjectRepository projectRepository,
    WarehouseManager warehouseManager,
    IWarehouseMovementRepository movementRepository,
    RentalFactorManager rentalFactorManager,
    IRentalFactorProfileRepository rentalFactorRepository,
    QuoteManager quoteManager,
    IQuoteRepository quoteRepository,
    SupplierManager supplierManager,
    ISupplierRepository supplierRepository,
    RepairManager repairManager,
    IRepairRepository repairRepository,
    InspectionManager inspectionManager,
    IUnitInspectionRepository inspectionRepository,
    LabelTemplateManager labelTemplateManager,
    ILabelTemplateRepository labelTemplateRepository,
    IUnitOfWork unitOfWork,
    ICurrentCompany currentCompany,
    ILogger<DemoDataSeeder> logger)
{
    /// <summary>Rentman workspace of Staras TR, as printed in its QR labels ({"ID":"19483","cmpID":16,"isCase":0}).</summary>
    private const int TurkeyRentmanWorkspace = 16;

    /// <summary>Demo assumption: Dubai's real cmpID is still to be confirmed with the customer.</summary>
    private const int DubaiRentmanWorkspace = 18;

    /// <summary>Demo label IDs start far above real Rentman IDs, so a real label never matches a fake device.</summary>
    private const int FirstLabelNumber = 900_000;

    private const string PaymentTerms = "İş sonrası faturalandırılacaktır.";

    private int _nextLabel = FirstLabelNumber;
    private int _labelWorkspace = TurkeyRentmanWorkspace;

    private readonly Dictionary<string, Equipment> _equipment = new();
    private readonly Dictionary<string, List<EquipmentUnit>> _units = new();
    private readonly Dictionary<Guid, string> _unitLabels = new();
    private readonly Dictionary<string, string> _bulkLabels = new();
    private readonly Dictionary<string, AppUser> _users = new();
    private Guid _tenantId;

    public async Task SeedAsync()
    {
        if (await tenantRepository.CodeExistsAsync("STARAS"))
        {
            return;
        }

        logger.LogInformation("Seeding demo data...");

        // Demo firm with an open-ended subscription; its two locations are Turkey and Dubai.
        var tenant = await tenantManager.CreateAsync("Staras (demo)", "STARAS");
        tenant.Update(tenant.Name, "Demo Yönetici", "admin@demo.local", null, null);
        tenant.SetSubscription("Kurumsal", DateTime.Today.AddMonths(-1), null, null, null);
        await tenantRepository.InsertAsync(tenant);
        await unitOfWork.SaveChangesAsync();
        _tenantId = tenant.Id;

        var tr = new Company(Guid.CreateVersion7(), "Staras Technical TR", "TR", "TRY", 20, "TR", _tenantId);
        tr.SetRentmanWorkspace(TurkeyRentmanWorkspace);
        await companyRepository.InsertAsync(tr);
        await unitOfWork.SaveChangesAsync();

        var ae = new Company(Guid.CreateVersion7(), "Staras Electronic Equipment Rental LLC", "AE", "AED", 5, "AE", _tenantId);
        ae.SetRentmanWorkspace(DubaiRentmanWorkspace);
        await companyRepository.InsertAsync(ae);

        await SeedIdentityAsync(tr, ae);
        await unitOfWork.SaveChangesAsync();

        using (currentCompany.Change(tr.Id))
        {
            await SeedTurkeyAsync(tr);
        }

        using (currentCompany.Change(ae.Id))
        {
            await SeedDubaiAsync(ae);
        }

        logger.LogInformation("Demo data seeded. Turkish label codes {First} … {Last}.",
            LabelCodeParser.Format(TurkeyRentmanWorkspace, false, FirstLabelNumber.ToString()),
            LabelCodeParser.Format(TurkeyRentmanWorkspace, false, "9002xx"));
    }

    // ---- Identity -------------------------------------------------------------------------------------------

    private async Task SeedIdentityAsync(Company tr, Company ae)
    {
        // The static admin role always resolves to every permission (see IUserRepository.GetPermissionsAsync).
        var admin = new AppRole(Guid.CreateVersion7(), AppRole.AdminRoleName, _tenantId, isStatic: true);

        var warehouse = Role("warehouse",
            StageTrackPermissions.Equipment.Default, StageTrackPermissions.Labels.Assign,
            StageTrackPermissions.Maintenance.Default, StageTrackPermissions.Maintenance.Manage,
            StageTrackPermissions.Suppliers.Default,
            // No project details for the warehouse: board and scan screen only.
            StageTrackPermissions.Warehouse.Default, StageTrackPermissions.Warehouse.Scan);

        var sales = Role("sales",
            StageTrackPermissions.Equipment.Default, StageTrackPermissions.Customers.Default,
            StageTrackPermissions.Customers.Manage, StageTrackPermissions.Projects.Default,
            StageTrackPermissions.Projects.Manage, StageTrackPermissions.Projects.ChangeStatus,
            StageTrackPermissions.Quotes.Default, StageTrackPermissions.Quotes.Manage,
            StageTrackPermissions.Prices.View, StageTrackPermissions.Warehouse.Default);

        // Crew members: only the confirmed projects they are assigned to, without any prices.
        var member = Role("member", StageTrackPermissions.Projects.Assigned);

        foreach (var role in new[] { admin, warehouse, sales, member })
        {
            await roleRepository.InsertAsync(role);
        }

        await AddUserAsync("staras.admin", "Demo Yönetici", "Admin123!", "admin@demo.local", "+90 532 000 00 01", "Genel Müdür", admin, tr, ae);
        await AddUserAsync("depo", "Depo Sorumlusu", "Depo123!", "depo@demo.local", "+90 532 000 00 02", "Depo Sorumlusu", warehouse, tr);
        // The sales person works in Turkey and Dubai with one account; the location is picked at sign-in.
        await AddUserAsync("satis", "Satış Temsilcisi", "Satis123!", "satis@demo.local", "+90 532 000 00 03", "Satış Temsilcisi", sales, tr, ae);
        await AddUserAsync("teknisyen1", "Murat Yılmaz", "Teknik123!", "murat@demo.local", "+90 532 000 00 04", "Ses Teknisyeni", member, tr);
        await AddUserAsync("teknisyen2", "Elif Kaya", "Teknik123!", "elif@demo.local", "+90 532 000 00 05", "Görüntü Teknisyeni", member, tr);
        await AddUserAsync("dubai", "Dubai Operations", "Dubai123!", "dubai@demo.local", "+971 50 000 0006", "Operations Manager", admin, ae, language: "en");

        AppRole Role(string name, params string[] permissions)
        {
            var role = new AppRole(Guid.CreateVersion7(), name, _tenantId);
            foreach (var permission in permissions)
            {
                role.Grant(permission);
            }

            return role;
        }
    }

    private async Task AddUserAsync(string userName, string fullName, string password, string email, string phone, string jobTitle,
        AppRole role, Company first, Company? second = null, string language = "tr")
    {
        var user = await userManager.CreateAsync(userName, fullName, password, email, language, _tenantId);
        user.Update(fullName, email, phone, jobTitle);
        user.AddRole(role.Id);
        user.AddCompany(first.Id);
        if (second is not null)
        {
            user.AddCompany(second.Id);
        }

        _users[userName] = user;
    }

    // ---- Turkey ---------------------------------------------------------------------------------------------

    private async Task SeedTurkeyAsync(Company company)
    {
        var gunesli = await stockLocationRepository.InsertAsync(new StockLocation(Guid.CreateVersion7(), "GÜNEŞLİ",
            StockLocationType.Warehouse, "Bağlar Mah. 63. Sok 7Z1 Bağcılar", "İstanbul"));
        await stockLocationRepository.InsertAsync(new StockLocation(Guid.CreateVersion7(), "KARS DEPO",
            StockLocationType.StorageLocation, "Merkez", "Kars"));

        var suppliers = await SeedSuppliersAsync(
            ("audio", "Pro Audio Dağıtım A.Ş.", "Satış Ekibi", "satis@proaudio.example", "+90 212 000 10 10", "İstanbul"),
            ("light", "Işık Market Ltd. Şti.", "Ahmet Demir", "info@isikmarket.example", "+90 212 000 20 20", "İstanbul"),
            ("service", "Teknik Servis Merkezi", "Servis Kabul", "servis@teknikservis.example", "+90 216 000 30 30", "İstanbul"));

        await SeedLabelTemplatesAsync();

        var folders = await SeedFoldersAsync(
            ("audio", "AUDIO", null), ("speaker", "Hoparlör", "audio"), ("amp", "Amfi", "audio"), ("console-a", "Mikser", "audio"),
            ("mic", "Mikrofon", "audio"), ("cable-a", "Kablo", "audio"),
            ("light", "LIGHT", null), ("moving", "Moving Head", "light"), ("wash", "Wash", "light"), ("profile", "Profil / Strobe", "light"),
            ("console-l", "Işık Konsolu", "light"), ("cable-l", "Kablo", "light"),
            ("video", "VIDEO", null), ("display", "Display", "video"), ("led", "Led Screen", "video"), ("projection", "Projeksiyon", "video"),
            ("media", "Media Server", "video"), ("network", "Network", "video"),
            ("truss", "TRUSS", null), ("rigging", "Motor / Vinç", "truss"));

        // key, code, name, brand, model, folder, units (0 = quantity tracked), stock, daily price (TRY), unit ref prefix
        await SeedEquipmentAsync(folders, gunesli.Id, suppliers,
        [
            ("k3", "AUD-001", "L-ACOUSTICS K3 LINE ARRAY SPEAKER", "L-Acoustics", "K3", "speaker", 12, 0, 4500, "K3"),
            ("sb18", "AUD-002", "L-ACOUSTICS SB18 SUB SPEAKER", "L-Acoustics", "SB18", "speaker", 8, 0, 2500, "SB18"),
            ("112p", "AUD-003", "L-ACOUSTICS 112P STAGE MONITOR", "L-Acoustics", "112P", "speaker", 6, 0, 1200, "112P"),
            ("larak", "AUD-004", "L-ACOUSTICS LA-RAK II AVB TOURING RACK AMP.", "L-Acoustics", "LA-RAK II AVB", "amp", 6, 0, 6000, "LA-RAK II AVB"),
            ("la8", "AUD-005", "L-ACOUSTICS LA8 AMP.", "L-Acoustics", "LA8", "amp", 4, 0, 1500, "LA8"),
            ("cl5", "AUD-006", "YAMAHA CL5 MIXER", "Yamaha", "CL5", "console-a", 2, 0, 9000, "CL5"),
            ("dvx", "AUD-007", "DB TECHNOLOGIES DVX DM12 MONITOR", "dB Technologies", "DVX DM12", "speaker", 4, 0, 700, "DVX"),
            ("ad2", "AUD-008", "SHURE AD2/G56 HANDHELD TRANSMITTER", "Shure", "AD2/G56", "mic", 8, 0, 600, "AD2"),
            ("xlr", "AUD-009", "XLR KABLO 10M", null, null, "cable-a", 0, 200, 15, ""),
            ("sharpy", "Light-101", "CLAY PAKY SHARPY BEAM", "Clay Paky", "Sharpy", "moving", 24, 0, 900, "SHARPY"),
            ("strike", "Light-108", "CHAUVET COLOR STRIKE M", "Chauvet", "Color Strike M", "profile", 12, 0, 800, "STRIKE"),
            ("sharpyplus", "Light-120", "CLAY PAKY SHARPY PLUS", "Clay Paky", "Sharpy Plus", "moving", 12, 0, 1100, "SHARPY+"),
            ("wash1200", "Light-130", "CLAY PAKY 1200 WASH SPOT", "Clay Paky", "1200 Wash", "wash", 20, 0, 1000, "WASH 1200"),
            ("robin", "Light-140", "ROBE ROBIN 800 LED WASH", "Robe", "Robin 800", "wash", 20, 0, 950, "ROBIN"),
            ("atomic", "Light-150", "MARTIN ATOMIC 3000 STROBE", "Martin", "Atomic 3000", "profile", 6, 0, 500, "ATOMIC"),
            ("etc", "Light-160", "ETC SOURCE FOUR 25/50 PROFILE SPOT", "ETC", "Source Four", "profile", 6, 0, 400, "ETC"),
            ("ma3", "Light-170", "MA LIGHTING GRAND MA3 FULL SIZE", "MA Lighting", "grandMA3", "console-l", 2, 0, 12000, "MA3"),
            ("ma2", "Light-171", "MA LIGHTING GRAND MA2 FULL SIZE LIGHT CONSOLE", "MA Lighting", "grandMA2", "console-l", 2, 0, 8000, "MA2"),
            ("dmx", "Light-180", "DMX KABLO 5M", null, null, "cable-l", 0, 300, 10, ""),
            ("vid020", "VID-020", "15,6\" HD MONITOR", "MSI", "PRO MP161 E2", "display", 6, 0, 300, "VID020"),
            ("vid024", "VID-024", "24\" HD MONITOR", "ACER", "K242HL", "display", 3, 0, 350, "VID024"),
            ("vid034", "VID-034", "49\" 5K MONITOR", "SAMSUNG", "ODYSSEY OLED G9", "display", 2, 0, 1500, "VID034"),
            ("vid039", "VID-039", "55\" 4K ONVO PLASMA", "ONVO", "55VQ90F3UA", "display", 3, 0, 1200, "VID039"),
            ("vid042", "VID-042", "85\" 4K ONVO PLASMA", "ONVO", "85VQ90F2UA", "display", 2, 0, 2500, "VID042"),
            ("led045", "Led-045", "INFICOLOR P3.9MM 500X1000 LED PANEL", "Inficolor", "P3.9", "led", 40, 0, 250, "LED"),
            ("vid060", "VID-060", "MS LICENCE DATATON", "Dataton", "Watchout", "media", 4, 0, 1500, "VID060"),
            ("vid063", "VID-063", "MS DATATON WATCHPAX30", "Dataton", "Watchpax 30", "media", 4, 0, 3000, "VID063"),
            ("vid072", "VID-072", "8 PORT / 1 GBPS SWITCH", null, null, "network", 6, 0, 150, "VID072"),
            ("vid090", "VID-090", "MONSTER ABRA A5 V9.2", "Monster", "Abra A5", "media", 4, 0, 1000, "VID090"),
            ("vid301", "VID-301", "OPTOMA 6K DLP LASER 1920X1200", "Optoma", "ZU1700", "projection", 6, 0, 5000, "VID301"),
            ("ledfloor", "Led-047", "LED FLOOR 4.7MM (ROE - LED SCREEN FLOOR)", "ROE", "Black Marble 4.7", "led", 4, 0, 6500, "FLOOR"),
            ("truss3", "Truss-084", "HTS TRUSS 3M SECTION 45*45", "HTS", "45*45", "truss", 0, 40, 200, ""),
            ("truss2", "Truss-085", "HTS TRUSS 2M SECTION 45*45", "HTS", "45*45", "truss", 0, 30, 150, ""),
            ("tower", "Truss-087", "HTS TRUSS 3M TOWER SECTION 45*45", "HTS", "45*45", "truss", 0, 16, 250, ""),
            ("hoist", "Truss-104", "CM LODESTAR 1000KG CHAINHOIST", "CM", "Lodestar 1T", "rigging", 6, 0, 750, "LODESTAR"),
            ("roof", "Truss-200", "TOTAL FABRICATIONS ROOF SYSTEM 12X10MT, 6 TOWERS H:8MT", "Total Fabrications", "Roof 12x10", "truss", 0, 1, 25000, "")
        ]);

        await SeedEquipmentDetailsAsync(suppliers);
        await unitOfWork.SaveChangesAsync();

        // Two wash spots are at the service, as in the customer's Rentman "Repairs" screen.
        await AddRepairAsync("wash1200", 18, "Pan motoru arızalı", RepairStatus.InProgress, suppliers["service"], 3500);
        await AddRepairAsync("wash1200", 19, "Lamba değişimi", RepairStatus.Open, null, null);
        await unitOfWork.SaveChangesAsync();

        var standard = await rentalFactorManager.CreateAsync("Standart", 0.5m,
            [(1, 1m), (2, 1.5m), (3, 2m), (4, 2.5m), (5, 3m), (7, 4m)], isDefault: true);
        await rentalFactorRepository.InsertAsync(standard);
        await unitOfWork.SaveChangesAsync();
        var longTerm = await rentalFactorManager.CreateAsync("Uzun dönem / Sabit kurulum", 0.2m,
            [(1, 1m), (7, 3m), (30, 8m), (90, 18m)], isDefault: false);
        await rentalFactorRepository.InsertAsync(longTerm);

        var customers = await SeedCustomersAsync("Türkiye",
            ("bkm", "BKM", "1780045123", "İstanbul", "Operasyon Ekibi"),
            ("atlantis", "Atlantis Yapım", "1020304051", "Ankara", "Prodüksiyon"),
            ("temacc", "TemaCC", "8350067712", "İstanbul", "Etkinlik Koordinatörü"),
            ("pur", "Pür Recording Studios & Residence", "7310098234", "İstanbul", "Stüdyo Müdürü"),
            ("sek", "ŞEK ORGANİZASYON", "8010023456", "İzmir", "Proje Sorumlusu"),
            ("altus", "Altus Organizasyon A.Ş.", "0560087613", "Antalya", "Kongre Ekibi"),
            ("promise", "Promise Turizm", "7330012987", "İstanbul", "Satın Alma"),
            ("ciragan", "Çırağan Palace Kempinski", "2430056712", "İstanbul", "Banket"),
            ("elli5", "Elli5 Event", "3250045671", "İstanbul", "Hesap Yöneticisi"),
            ("ceo", "CEO Event Medya A.Ş.", "2070012345", "İstanbul", "Prodüksiyon"),
            ("brand", "BrandCrafters & Co.", "1880076543", "İstanbul", "Marka Ekibi"),
            ("regnum", "Regnum Carya Golf & Spa Resort", "7340023987", "Antalya", "Etkinlik Müdürü"));
        await unitOfWork.SaveChangesAsync();

        await SeedTurkishProjectsAsync(company, customers, gunesli.Id, longTerm.Id);
    }

    private async Task<Dictionary<string, Guid>> SeedSuppliersAsync(params (string Key, string Name, string Contact, string Email, string Phone, string City)[] items)
    {
        var result = new Dictionary<string, Guid>();
        foreach (var item in items)
        {
            var supplier = await supplierManager.CreateAsync(item.Name);
            supplier.Update(item.Contact, item.Email, item.Phone, null, null, null, item.City, "Türkiye", null, null);
            await supplierRepository.InsertAsync(supplier);
            result[item.Key] = supplier.Id;
        }

        await unitOfWork.SaveChangesAsync();
        return result;
    }

    private async Task SeedLabelTemplatesAsync()
    {
        var video = new LabelTemplate(Guid.CreateVersion7(), "VİDEO EKİPMAN ETİKET 6x3 cm");
        video.Update(video.Name, 60, 30, 20, 7);
        video.SetFields(name: true, brand: true, model: true, code: false, internalRef: true, serialNumber: true, companyName: false);
        await labelTemplateManager.SetDefaultAsync(video);
        await labelTemplateRepository.InsertAsync(video);

        var small = new LabelTemplate(Guid.CreateVersion7(), "KÜÇÜK ETİKET 4x2 cm");
        small.Update(small.Name, 40, 20, 16, 5.5m);
        small.SetFields(name: true, brand: false, model: false, code: true, internalRef: true, serialNumber: false, companyName: false);
        await labelTemplateRepository.InsertAsync(small);
        await unitOfWork.SaveChangesAsync();
    }

    private async Task<Dictionary<string, Guid>> SeedFoldersAsync(params (string Key, string Name, string? Parent)[] items)
    {
        var result = new Dictionary<string, Guid>();
        foreach (var (key, name, parent) in items)
        {
            var folder = await folderManager.CreateAsync(name, parent is null ? null : result[parent]);
            await folderRepository.InsertAsync(folder);
            await unitOfWork.SaveChangesAsync();
            result[key] = folder.Id;
        }

        return result;
    }

    private async Task SeedEquipmentAsync(Dictionary<string, Guid> folders, Guid locationId, Dictionary<string, Guid>? suppliers,
        (string Key, string Code, string Name, string? Brand, string? Model, string Folder, int Units, int Stock, decimal Price, string Prefix)[] items)
    {
        var random = new Random(42);
        foreach (var item in items)
        {
            var equipment = await equipmentManager.CreateAsync(item.Code, item.Name, EquipmentType.Physical, item.Units > 0);
            equipment.Update(item.Name, item.Brand, item.Model, folders[item.Folder], EquipmentType.Physical, null, null);
            equipment.SetRentalPrice(item.Price);
            equipment.SetStockQuantity(item.Stock);
            await equipmentRepository.InsertAsync(equipment);
            _equipment[item.Key] = equipment;

            if (item.Units == 0)
            {
                await unitOfWork.SaveChangesAsync();
                var bulkLabel = await labelManager.AssignAsync(NextLabel(), LabelType.RentmanQr, equipment.Id, null);
                await labelRepository.InsertAsync(bulkLabel);
                _bulkLabels[item.Key] = bulkLabel.Code;
                continue;
            }

            var units = new List<EquipmentUnit>();
            for (var i = 1; i <= item.Units; i++)
            {
                var serial = $"{random.Next(1_000_000, 9_999_999)}{random.Next(100, 999)}";
                // ROE floor cases are tracked in Rentman as one record per 10 panels ("FLOOR 321-330").
                var internalRef = item.Key == "ledfloor" ? $"FLOOR {291 + i * 10}-{300 + i * 10}" : $"{item.Prefix} {i:000}";
                var unit = await unitManager.CreateAsync(equipment, internalRef, serial, locationId);
                var purchased = DateTime.Today.AddDays(-random.Next(120, 1100)).Date;
                unit.UpdateDetails(purchased, purchased.AddYears(2), purchased.AddYears(8),
                    suppliers is null ? null : item.Folder.StartsWith("speaker") || item.Folder is "amp" or "mic" ? suppliers["audio"]
                        : item.Folder is "moving" or "wash" or "profile" ? suppliers["light"] : null);
                await unitRepository.InsertAsync(unit);
                units.Add(unit);
            }

            await unitOfWork.SaveChangesAsync();
            _units[item.Key] = units;

            // Left without a label on purpose, so the demo can link a real Rentman label on the spot:
            // the last two projectors, and "FLOOR 321-330" whose real label is {"ID":"19483","cmpID":16,"isCase":0}.
            var labeled = item.Key switch
            {
                "vid301" => units.Take(units.Count - 2),
                "ledfloor" => units.Where(u => u.InternalRef != "FLOOR 321-330"),
                _ => units
            };
            foreach (var unit in labeled)
            {
                var label = await labelManager.AssignAsync(NextLabel(), LabelType.RentmanQr, null, unit.Id);
                await labelRepository.InsertAsync(label);
                _unitLabels[unit.Id] = label.Code;
            }
        }
    }

    /// <summary>Physical data, content, accessories, alternatives, suppliers and periodic inspections.</summary>
    private async Task SeedEquipmentDetailsAsync(Dictionary<string, Guid> suppliers)
    {
        _equipment["k3"].UpdatePhysical(130, 50, 35, 43, null, 1200, 5.5m, 1);
        _equipment["sb18"].UpdatePhysical(70, 70, 55, 52, null, 900, 4m, 1);
        _equipment["sharpy"].UpdatePhysical(42, 34, 60, 19.5m, null, 470, 2.1m, 2);
        _equipment["vid020"].UpdatePhysical(36, 3, 23, 1.2m, null, 15, 0.1m, 1);
        _equipment["vid301"].UpdatePhysical(60, 50, 25, 28, null, 1500, 6.5m, 1);
        _equipment["ledfloor"].UpdatePhysical(80, 133, 99, 160, null, 2000, 9m, 10);
        _equipment["roof"].UpdatePhysical(null, null, null, 1850, 12, null, null, 1);

        // The roof system is a kit: its sections travel with it (printed indented on the packing slip).
        await equipmentManager.AddRelationAsync(_equipment["roof"], EquipmentRelationKind.Content, _equipment["truss3"].Id, 12);
        await equipmentManager.AddRelationAsync(_equipment["roof"], EquipmentRelationKind.Content, _equipment["tower"].Id, 12);
        await equipmentManager.AddRelationAsync(_equipment["roof"], EquipmentRelationKind.Content, _equipment["hoist"].Id, 6);

        await equipmentManager.AddRelationAsync(_equipment["k3"], EquipmentRelationKind.Accessory, _equipment["xlr"].Id, 2);
        await equipmentManager.AddRelationAsync(_equipment["sharpy"], EquipmentRelationKind.Accessory, _equipment["dmx"].Id, 1);
        await equipmentManager.AddRelationAsync(_equipment["sharpy"], EquipmentRelationKind.Alternative, _equipment["sharpyplus"].Id, 1);
        await equipmentManager.AddRelationAsync(_equipment["sharpyplus"], EquipmentRelationKind.Alternative, _equipment["sharpy"].Id, 1);
        await equipmentManager.AddRelationAsync(_equipment["vid042"], EquipmentRelationKind.Alternative, _equipment["vid039"].Id, 1);

        await equipmentManager.AddSupplierAsync(_equipment["k3"], suppliers["audio"], "LA-K3-BLK", 385000, true);
        await equipmentManager.AddSupplierAsync(_equipment["sharpy"], suppliers["light"], "CP-SHARPY", 142000, true);
        await equipmentManager.AddSupplierAsync(_equipment["wash1200"], suppliers["light"], "CP-1200W", 98000, true);
        await equipmentManager.AddSupplierAsync(_equipment["wash1200"], suppliers["service"], null, null, false);

        // Chain hoists need a yearly rigging inspection: one is overdue, one has never been inspected.
        var hoist = _equipment["hoist"];
        hoist.SetInspection(12, "Yıllık zincir, fren ve kanca kontrolü (TS EN 14492-2).");
        var hoists = _units["hoist"];
        for (var i = 0; i < hoists.Count - 1; i++)
        {
            var monthsAgo = i == 4 ? 13 : 2 + i;
            await inspectionRepository.InsertAsync(inspectionManager.Record(hoist, hoists[i], DateTime.Today.AddMonths(-monthsAgo), true,
                "Zincir ve fren kontrol edildi, uygun."));
        }
    }

    private async Task AddRepairAsync(string equipmentKey, int unitIndex, string title, RepairStatus status, Guid? supplierId, decimal? cost)
    {
        var equipment = _equipment[equipmentKey];
        var unit = _units[equipmentKey][unitIndex];
        var repair = await repairManager.CreateAsync(equipment, unit, 1, title, DateTime.Today.AddDays(-6));
        repair.Update(title, "Depo kontrolünde tespit edildi.", supplierId, cost);
        await repairManager.ChangeStatusAsync(repair, status, DateTime.UtcNow);
        await repairRepository.InsertAsync(repair);
        await unitOfWork.SaveChangesAsync();
    }

    private async Task<Dictionary<string, Guid>> SeedCustomersAsync(string country, params (string Key, string Name, string Tax, string City, string Contact)[] items)
    {
        var result = new Dictionary<string, Guid>();
        foreach (var item in items)
        {
            var customer = await customerManager.CreateAsync(item.Name, item.Tax);
            customer.Update(item.Name, item.City + " VD", item.Contact, null, null, null, item.City, country, null);
            await customerRepository.InsertAsync(customer);
            result[item.Key] = customer.Id;
        }

        return result;
    }

    private async Task SeedTurkishProjectsAsync(Company company, Dictionary<string, Guid> customers, Guid locationId, Guid longTermProfileId)
    {
        var today = DateTime.Today;
        DateTime Day(int offset, int hour = 8) => today.AddDays(offset).AddHours(hour);
        const string sound = "SES SİSTEMİ", light = "IŞIK SİSTEMİ", video = "GÖRÜNTÜ SİSTEMİ", truss = "TRUSS";

        // Fixed installation running all year: most Sharpy Beams are tied up here, which creates real shortages.
        var uniq = await CreateProjectAsync(2039, "UNIQ HALL - SABİT SİSTEM", customers["bkm"], "UNIQ Hall", "#7c3aed",
            Day(-270), Day(90), null, null, locationId,
            [("sharpy", 14, light, null), ("robin", 12, light, null), ("atomic", 4, light, null), ("etc", 4, light, null),
             ("ma2", 1, light, "FOH"), ("k3", 6, $"{sound}/Hoparlör", null), ("sb18", 4, $"{sound}/Hoparlör", null), ("cl5", 1, $"{sound}/Mikser", "FOH")],
            crew: [("teknisyen1", "Ses teknisyeni")]);
        await CheckOutAllAsync(uniq);
        await projectManager.ChangeStatusAsync(uniq, ProjectStatus.OnLocation);

        var cerModern = await CreateProjectAsync(2147, "Atlantis Yapım CER-MODERN", customers["atlantis"], "IF Ankara", "#f97316",
            Day(-24), Day(-12), Day(-22), Day(-14), locationId, [("vid039", 2, null, null), ("vid072", 2, null, null), ("xlr", 20, null, null)]);
        await CheckOutAllAsync(cerModern);
        await projectManager.ChangeStatusAsync(cerModern, ProjectStatus.OnLocation);
        await CheckInAllAsync(cerModern);
        await projectManager.ChangeStatusAsync(cerModern, ProjectStatus.Returned);

        var pur = await CreateProjectAsync(2393, "PÜR STÜDYO PROJEKSİYON", customers["pur"], "Pür Recording Studios & Residence", "#f97316",
            Day(-3), Day(360), null, null, locationId,
            [("vid301", 4, video, null), ("vid090", 1, video, null), ("vid060", 1, video, null), ("vid063", 1, video, null), ("vid072", 2, video, null)],
            crew: [("teknisyen2", "Görüntü teknisyeni")]);
        await CheckOutAllAsync(pur);
        await projectManager.ChangeStatusAsync(pur, ProjectStatus.OnLocation);

        var amr = await CreateProjectAsync(2384, "AMR DIAB KONSER", customers["temacc"], "Ataköy Marina", "#f97316",
            Day(-2), Day(1, 23), Day(-1), Day(0, 23), locationId,
            [("k3", 6, $"{sound}/Hoparlör", null), ("sb18", 4, $"{sound}/Hoparlör", null), ("larak", 2, $"{sound}/Hoparlör", null),
             ("cl5", 1, $"{sound}/Mikser", null), ("wash1200", 8, light, null), ("sharpyplus", 8, light, null), ("ma3", 1, light, null),
             ("truss3", 16, truss, null), ("tower", 4, truss, null)],
            crew: [("teknisyen1", "Ses teknisyeni")]);
        await CheckOutAllAsync(amr);
        await projectManager.ChangeStatusAsync(amr, ProjectStatus.OnLocation);

        var zorlu = await CreateProjectAsync(2386, "Zorlu PSM Chauvet 2 ekim", customers["promise"], "Zorlu PSM", "#22c55e",
            Day(1), Day(3, 20), Day(2), Day(2, 23), locationId, [("strike", 8, light, null), ("robin", 6, light, null), ("dmx", 40, light, null)]);
        await CheckOutAllAsync(zorlu);
        await projectManager.ChangeStatusAsync(zorlu, ProjectStatus.Prepped);

        var ella = await CreateProjectAsync(2381, "Ella Event Toplantı Boğaziçi", customers["elli5"], "Çırağan Palace Kempinski", "#22c55e",
            Day(0), Day(1, 22), Day(1), Day(1, 18), locationId,
            [("vid042", 2, $"{video}/Ana sahne", "Ayaklı kurulacak"), ("vid034", 1, $"{video}/Ana sahne", null),
             ("ledfloor", 2, $"{video}/Ana sahne", null), ("vid020", 4, $"{video}/Koridor", "Sahne önü ön izleme"),
             ("ad2", 4, sound, "2 adet el telsiz, 2 adet yedek"), ("112p", 2, sound, null), ("xlr", 30, sound, null)],
            crew: [("teknisyen1", "Ses teknisyeni"), ("teknisyen2", "Görüntü teknisyeni")]);
        await projectManager.ChangeStatusAsync(ella, ProjectStatus.Confirmed);

        // Needs 16 Sharpy Beams while 14 are installed at UNIQ Hall: the demo shows the shortage warning.
        var teknofest = await CreateProjectAsync(2400, "Teknofest Şanlıurfa", customers["brand"], "Şanlıurfa GAP Arena", "#22c55e",
            Day(2), Day(6, 22), Day(3), Day(5, 23), locationId,
            [("sharpy", 16, light, null), ("wash1200", 10, light, null), ("ma3", 1, light, null), ("led045", 24, video, "6x2 m ekran"),
             ("roof", 1, truss, null), ("truss3", 20, truss, null)]);
        await projectManager.ChangeStatusAsync(teknofest, ProjectStatus.Confirmed);

        var nil = await CreateProjectAsync(2396, "NİL KARAİBRAHİMGİL - KONSER @İZMİR FUAR", customers["sek"], "İzmir Fuar Açıkhava", "#f97316",
            Day(4), Day(6, 23), Day(5), Day(5, 23), locationId,
            [("k3", 6, $"{sound}/Hoparlör", null), ("sb18", 4, $"{sound}/Hoparlör", null), ("la8", 4, $"{sound}/Hoparlör", null),
             ("cl5", 1, $"{sound}/Mikser", null), ("robin", 8, light, null), ("sharpyplus", 12, light, null)]);
        await projectManager.ChangeStatusAsync(nil, ProjectStatus.Pending);

        var iac = await CreateProjectAsync(2362, "Uluslararası Astronotik Kongresi (IAC) Antalya", customers["altus"], "Regnum Carya", "#f97316",
            Day(5), Day(12), Day(6), Day(11), locationId,
            [("vid301", 2, video, null), ("led045", 16, video, null), ("vid063", 2, video, null), ("ad2", 8, sound, null), ("dvx", 4, sound, null)]);
        await projectManager.ChangeStatusAsync(iac, ProjectStatus.Pending);

        var netflix = await CreateProjectAsync(2329, "STAGERSBASE NETFLIX 7 ekim Uniq", customers["ciragan"], "Çırağan Palace Kempinski", "#22c55e",
            Day(3), Day(5), Day(4), Day(4, 23), locationId, [("vid024", 2, null, null), ("etc", 2, null, null)]);
        await projectManager.ChangeStatusAsync(netflix, ProjectStatus.Pending);

        await CreateProjectAsync(2373, "BLOK3 ANKARA KONSER", customers["ceo"], "Ankara Congresium", "#22c55e",
            Day(8), Day(11), Day(9), Day(10), locationId, [("k3", 6, null, null), ("sb18", 4, null, null), ("sharpy", 6, null, null)]);

        // Lost job: the customer declined the quote, so the project was cancelled and reserves nothing.
        var lost = await CreateProjectAsync(2355, "BAYİ TOPLANTISI - HİLTON BOMONTİ", customers["bkm"], "Hilton Bomonti", "#94a3b8",
            Day(6), Day(7, 23), Day(7), Day(7, 23), locationId, [("vid301", 2, video, null), ("ad2", 6, sound, null)]);
        await projectManager.ChangeStatusAsync(lost, ProjectStatus.Pending);

        await unitOfWork.SaveChangesAsync();
        await SeedTurkishQuotesAsync(company, ella, amr, nil, uniq, longTermProfileId, iac, netflix, lost);
    }

    private async Task<Project> CreateProjectAsync(int number, string name, Guid customerId, string venue, string color,
        DateTime planStart, DateTime planEnd, DateTime? useStart, DateTime? useEnd, Guid locationId,
        (string Key, int Quantity, string? Section, string? Note)[] equipment, (string User, string Function)[]? crew = null)
    {
        var project = await projectManager.CreateAsync(name, planStart, planEnd, number);
        project.Update(name, customerId, venue, color, "PRODÜKSİYON", locationId, null);
        project.SetUsePeriod(useStart, useEnd);
        project.SetDocumentInfo(_users["satis"].Id, PaymentTerms);

        foreach (var (key, quantity, section, note) in equipment)
        {
            var line = await projectManager.AddEquipmentAsync(project, _equipment[key].Id, quantity, GetOrCreateSection(project, section));
            if (note is not null)
            {
                project.UpdateEquipment(line.Id, line.Quantity, note);
            }
        }

        foreach (var (user, function) in crew ?? [])
        {
            await projectManager.AddCrewAsync(project, _users[user].Id, function);
        }

        await projectRepository.InsertAsync(project);
        await unitOfWork.SaveChangesAsync();
        return project;
    }

    /// <summary>"SES SİSTEMİ/Hoparlör" → the "Hoparlör" sub-section of "SES SİSTEMİ", created when missing.</summary>
    private static Guid? GetOrCreateSection(Project project, string? path)
    {
        Guid? parentId = null;
        foreach (var name in (path ?? string.Empty).Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var section = project.Sections.FirstOrDefault(s => s.ParentId == parentId && s.Name == name) ?? project.AddSection(name, parentId);
            parentId = section.Id;
        }

        return parentId;
    }

    private async Task CheckOutAllAsync(Project project)
    {
        if (project.Status is ProjectStatus.Draft or ProjectStatus.Pending)
        {
            await projectManager.ChangeStatusAsync(project, ProjectStatus.Confirmed);
        }

        foreach (var line in project.Equipment.ToList())
        {
            var key = _equipment.First(e => e.Value.Id == line.EquipmentId).Key;
            var codes = _units.TryGetValue(key, out var units)
                ? units.Where(u => u.Status == UnitStatus.InStock && _unitLabels.ContainsKey(u.Id)).Take(line.Quantity).Select(u => _unitLabels[u.Id]).ToList()
                : Enumerable.Repeat(_bulkLabels[key], line.Quantity).ToList();

            foreach (var code in codes)
            {
                var (_, movement) = await warehouseManager.ScanAsync(project, code, ScanDirection.Out, null);
                if (movement is not null)
                {
                    await movementRepository.InsertAsync(movement);
                    await unitOfWork.SaveChangesAsync();
                }
            }
        }
    }

    private async Task CheckInAllAsync(Project project)
    {
        foreach (var line in project.Equipment.ToList())
        {
            var key = _equipment.First(e => e.Value.Id == line.EquipmentId).Key;
            var codes = _units.TryGetValue(key, out var units)
                ? units.Where(u => u.CurrentProjectId == project.Id).Select(u => _unitLabels[u.Id]).ToList()
                : Enumerable.Repeat(_bulkLabels[key], line.Quantity).ToList();

            foreach (var code in codes)
            {
                var (_, movement) = await warehouseManager.ScanAsync(project, code, ScanDirection.In, null);
                await movementRepository.InsertAsync(movement!);
                await unitOfWork.SaveChangesAsync();
            }
        }
    }

    private async Task SeedTurkishQuotesAsync(Company company, Project ella, Project amr, Project nil, Project uniq, Guid longTermProfileId,
        Project iac, Project netflix, Project lost)
    {
        var amrQuote = await quoteManager.CreateFromProjectAsync(amr, company, null, DateTime.Today.AddDays(-12));
        amrQuote.AddLine(QuoteLineType.Crew, null, "Ses ve ışık teknik ekip (4 kişi)", 4, 7500, applyFactor: true, discountPercent: 0, section: "PERSONEL VE NAKLİYE");
        amrQuote.AddLine(QuoteLineType.Transport, null, "Nakliye - İstanbul içi (kamyon)", 2, 9000, applyFactor: false, discountPercent: 0, section: "PERSONEL VE NAKLİYE");
        amrQuote.UpdateHeader(amrQuote.IssueDate, DateTime.Today.AddDays(-2), 10, company.DefaultVatRate, null);
        await quoteRepository.InsertAsync(amrQuote);
        await unitOfWork.SaveChangesAsync();
        await quoteManager.ChangeStatusAsync(amrQuote, QuoteStatus.Sent, amr);
        await quoteManager.ChangeStatusAsync(amrQuote, QuoteStatus.Accepted, amr);

        var ellaQuote = await quoteManager.CreateFromProjectAsync(ella, company, null, DateTime.Today.AddDays(-4));
        ellaQuote.AddLine(QuoteLineType.Crew, null, "Görüntü teknisyeni", 1, 6000, applyFactor: true, discountPercent: 0, section: "PERSONEL");
        ellaQuote.UpdateHeader(ellaQuote.IssueDate, DateTime.Today.AddDays(10), 5, company.DefaultVatRate, null);
        await quoteRepository.InsertAsync(ellaQuote);
        await unitOfWork.SaveChangesAsync();
        await quoteManager.ChangeStatusAsync(ellaQuote, QuoteStatus.Sent, ella);
        await quoteManager.ChangeStatusAsync(ellaQuote, QuoteStatus.Accepted, ella);

        var nilQuote = await quoteManager.CreateFromProjectAsync(nil, company, null, DateTime.Today);
        nilQuote.AddLine(QuoteLineType.Crew, null, "Ses ve ışık teknik ekip (6 kişi)", 6, 7500, applyFactor: true, discountPercent: 0, section: "PERSONEL VE NAKLİYE");
        nilQuote.AddLine(QuoteLineType.Transport, null, "Nakliye - İstanbul / İzmir (tır)", 1, 45000, applyFactor: false, discountPercent: 0, section: "PERSONEL VE NAKLİYE");
        nilQuote.UpdateHeader(DateTime.Today.AddDays(-3), DateTime.Today.AddDays(7), 0, company.DefaultVatRate, null);
        await quoteRepository.InsertAsync(nilQuote);
        await unitOfWork.SaveChangesAsync();
        // The customer asked for a discount: revision 2 is being prepared.
        await quoteManager.ChangeStatusAsync(nilQuote, QuoteStatus.Sent, nil);
        var nilRevision = quoteManager.Revise(nilQuote, DateTime.Today);
        nilRevision.UpdateHeader(DateTime.Today, DateTime.Today.AddDays(7), 8, company.DefaultVatRate, "Müşteri talebi: %8 iskonto.");
        await quoteRepository.InsertAsync(nilRevision);
        await unitOfWork.SaveChangesAsync();

        var iacQuote = await quoteManager.CreateFromProjectAsync(iac, company, null, DateTime.Today.AddDays(-1));
        iacQuote.AddLine(QuoteLineType.Crew, null, "Görüntü ekibi (3 kişi)", 3, 6500, applyFactor: true, discountPercent: 0, section: "PERSONEL");
        await quoteRepository.InsertAsync(iacQuote);
        await unitOfWork.SaveChangesAsync();
        await quoteManager.ChangeStatusAsync(iacQuote, QuoteStatus.Sent, iac);

        var netflixQuote = await quoteManager.CreateFromProjectAsync(netflix, company, null, DateTime.Today);
        await quoteRepository.InsertAsync(netflixQuote);
        await unitOfWork.SaveChangesAsync();

        var lostQuote = await quoteManager.CreateFromProjectAsync(lost, company, null, DateTime.Today.AddDays(-8));
        await quoteRepository.InsertAsync(lostQuote);
        await unitOfWork.SaveChangesAsync();
        await quoteManager.ChangeStatusAsync(lostQuote, QuoteStatus.Sent, lost);
        await quoteManager.ChangeStatusAsync(lostQuote, QuoteStatus.Rejected, lost, "Fiyat yüksek bulundu, rakip firmayla çalışılacak.");
        await unitOfWork.SaveChangesAsync();

        var uniqQuote = await quoteManager.CreateFromProjectAsync(uniq, company, longTermProfileId, DateTime.Today.AddDays(-275));
        await quoteRepository.InsertAsync(uniqQuote);
        await unitOfWork.SaveChangesAsync();
        await quoteManager.ChangeStatusAsync(uniqQuote, QuoteStatus.Sent, uniq);
        await quoteManager.ChangeStatusAsync(uniqQuote, QuoteStatus.Accepted, uniq);
        await unitOfWork.SaveChangesAsync();
    }

    // ---- Dubai ----------------------------------------------------------------------------------------------

    /// <summary>A smaller catalog so the Dubai location is not empty after signing in there.</summary>
    private async Task SeedDubaiAsync(Company company)
    {
        _labelWorkspace = DubaiRentmanWorkspace;
        _nextLabel = 910_000;

        var dip = await stockLocationRepository.InsertAsync(new StockLocation(Guid.CreateVersion7(), "DIP1 DUBAI",
            StockLocationType.Warehouse, "Dubai Investments Park 1", "Dubai"));
        await SeedLabelTemplatesAsync();

        var folders = await SeedFoldersAsync(("audio", "AUDIO", null), ("light", "LIGHT", null), ("video", "VIDEO", null));
        await SeedEquipmentAsync(folders, dip.Id, null,
        [
            ("ae-k2", "AUD-101", "L-ACOUSTICS K2 LINE ARRAY SPEAKER", "L-Acoustics", "K2", "audio", 8, 0, 950, "K2"),
            ("ae-ks28", "AUD-102", "L-ACOUSTICS KS28 SUB SPEAKER", "L-Acoustics", "KS28", "audio", 4, 0, 600, "KS28"),
            ("ae-dm3", "AUD-103", "YAMAHA DM3 MIXER", "Yamaha", "DM3", "audio", 2, 0, 450, "DM3"),
            ("ae-sharpy", "Light-101", "CLAY PAKY SHARPY BEAM", "Clay Paky", "Sharpy", "light", 12, 0, 180, "SHARPY"),
            ("ae-led", "Led-032", "UNILUMIN INDOOR P2.6 CURVE 50x50 CABINET", "Unilumin", "P2.6", "video", 48, 0, 60, "UNI"),
            ("ae-proc", "VID-053", "4K LED PROCESSOR / SWITCHER", "Novastar", "VX1000", "video", 2, 0, 350, "PROC")
        ]);

        var profile = await rentalFactorManager.CreateAsync("Standard", 0.5m, [(1, 1m), (2, 1.5m), (3, 2m), (7, 4m)], isDefault: true);
        await rentalFactorRepository.InsertAsync(profile);

        var customers = await SeedCustomersAsync("UAE",
            ("emaar", "Emaar Events LLC", "100234567800003", "Dubai", "Events Team"),
            ("dwtc", "Dubai World Trade Centre", "100987654300003", "Dubai", "Venue Operations"),
            ("atlantis", "Atlantis The Royal", "100555444300003", "Dubai", "Banqueting"));
        await unitOfWork.SaveChangesAsync();

        var today = DateTime.Today;
        var gala = await projectManager.CreateAsync("EXPO CITY GALA DINNER", today.AddDays(3).AddHours(8), today.AddDays(5).AddHours(23));
        gala.Update(gala.Name, customers["emaar"], "Expo City Dubai", "#0ea5e9", "PRODUCTION", dip.Id, null);
        gala.SetUsePeriod(today.AddDays(4).AddHours(16), today.AddDays(4).AddHours(23));
        gala.SetDocumentInfo(_users["satis"].Id, "Invoice after the event.");
        var soundSection = gala.AddSection("SOUND", null);
        var videoSection = gala.AddSection("VIDEO", null);
        await projectManager.AddEquipmentAsync(gala, _equipment["ae-k2"].Id, 8, soundSection.Id);
        await projectManager.AddEquipmentAsync(gala, _equipment["ae-ks28"].Id, 4, soundSection.Id);
        await projectManager.AddEquipmentAsync(gala, _equipment["ae-dm3"].Id, 1, soundSection.Id);
        await projectManager.AddEquipmentAsync(gala, _equipment["ae-led"].Id, 32, videoSection.Id);
        await projectManager.AddEquipmentAsync(gala, _equipment["ae-proc"].Id, 1, videoSection.Id);
        await projectRepository.InsertAsync(gala);
        await projectManager.ChangeStatusAsync(gala, ProjectStatus.Confirmed);
        await unitOfWork.SaveChangesAsync();

        var summit = await projectManager.CreateAsync("DWTC TECH SUMMIT", today.AddDays(9).AddHours(8), today.AddDays(12).AddHours(22));
        summit.Update(summit.Name, customers["dwtc"], "Dubai World Trade Centre", "#a855f7", "PRODUCTION", dip.Id, null);
        await projectManager.AddEquipmentAsync(summit, _equipment["ae-sharpy"].Id, 12);
        await projectManager.AddEquipmentAsync(summit, _equipment["ae-led"].Id, 24);
        await projectRepository.InsertAsync(summit);
        await projectManager.ChangeStatusAsync(summit, ProjectStatus.Pending);
        await unitOfWork.SaveChangesAsync();

        var quote = await quoteManager.CreateFromProjectAsync(gala, company, null, today.AddDays(-2));
        quote.AddLine(QuoteLineType.Crew, null, "Technical crew (3 persons)", 3, 1500, applyFactor: true, discountPercent: 0, section: "CREW");
        await quoteRepository.InsertAsync(quote);
        await unitOfWork.SaveChangesAsync();
        await quoteManager.ChangeStatusAsync(quote, QuoteStatus.Sent, gala);
        await quoteManager.ChangeStatusAsync(quote, QuoteStatus.Accepted, gala);
        await unitOfWork.SaveChangesAsync();
    }

    /// <summary>Same content a Rentman QR label holds, so demo labels scan exactly like the real ones.</summary>
    private string NextLabel() => $"{{\"ID\":\"{_nextLabel++}\",\"cmpID\":{_labelWorkspace},\"isCase\":0}}";
}
