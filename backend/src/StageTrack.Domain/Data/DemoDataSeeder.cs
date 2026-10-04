using Microsoft.Extensions.Logging;
using StageTrack.Companies;
using StageTrack.Customers;
using StageTrack.Identity;
using StageTrack.Inventory;
using StageTrack.Permissions;
using StageTrack.Pricing;
using StageTrack.Projects;
using StageTrack.Quotes;
using StageTrack.Repositories;
using StageTrack.Session;
using StageTrack.Warehouse;

namespace StageTrack.Data;

/// <summary>
/// Creates a realistic demo data set (names taken from the customer's Rentman screens) relative to today,
/// so the calendar and warehouse board always look "live". Runs only on an empty database.
/// Every device gets a numeric label that imitates a Rentman QR code; a few Optoma projectors are left
/// unlabeled on purpose to demonstrate linking an unknown label from the scan screen.
/// </summary>
public class DemoDataSeeder(
    ICompanyRepository companyRepository,
    IRoleRepository roleRepository,
    UserManager userManager,
    IUserRepository userRepository,
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
    IUnitOfWork unitOfWork,
    ICurrentCompany currentCompany,
    ILogger<DemoDataSeeder> logger)
{
    /// <summary>Rentman workspace of Staras TR, as printed in its QR labels ({"ID":"19483","cmpID":16,"isCase":0}).</summary>
    private const int TurkeyRentmanWorkspace = 16;

    /// <summary>Demo label IDs start far above real Rentman IDs, so a real label never matches a fake device.</summary>
    private const int FirstLabelNumber = 900_000;

    private int _nextLabel = FirstLabelNumber;

    private readonly Dictionary<string, Equipment> _equipment = new();
    private readonly Dictionary<string, List<EquipmentUnit>> _units = new();
    private readonly Dictionary<Guid, string> _unitLabels = new();
    private readonly Dictionary<string, string> _bulkLabels = new();

    public async Task SeedAsync()
    {
        if (await companyRepository.GetCountAsync() > 0)
        {
            return;
        }

        logger.LogInformation("Seeding demo data...");

        var tr = new Company(Guid.CreateVersion7(), "Staras Technical TR", "TR", "TRY", 20, "TR");
        tr.SetRentmanWorkspace(TurkeyRentmanWorkspace);
        await companyRepository.InsertAsync(tr);
        var ae = await companyRepository.InsertAsync(new Company(Guid.CreateVersion7(), "Staras Electronic Equipment Rental LLC", "AE", "AED", 5, "AE"));

        await SeedIdentityAsync(tr, ae);
        await unitOfWork.SaveChangesAsync();

        using (currentCompany.Change(tr.Id))
        {
            await SeedTurkeyAsync(tr);
        }

        using (currentCompany.Change(ae.Id))
        {
            await stockLocationRepository.InsertAsync(new StockLocation(Guid.CreateVersion7(), "DIP1 DUBAI", StockLocationType.Warehouse, "Dubai Investments Park 1", "Dubai"));
            var dubaiProfile = await rentalFactorManager.CreateAsync("Standard", 0.5m, [(1, 1m), (2, 1.5m), (3, 2m), (7, 4m)], isDefault: true);
            await rentalFactorRepository.InsertAsync(dubaiProfile);
            await unitOfWork.SaveChangesAsync();
        }

        logger.LogInformation("Demo data seeded. Label codes {First} … {Last}.",
            LabelCodeParser.Format(TurkeyRentmanWorkspace, false, FirstLabelNumber.ToString()),
            LabelCodeParser.Format(TurkeyRentmanWorkspace, false, (_nextLabel - 1).ToString()));
    }

    private async Task SeedIdentityAsync(Company tr, Company ae)
    {
        // The static admin role always resolves to every permission (see IUserRepository.GetPermissionsAsync).
        var admin = new AppRole(Guid.CreateVersion7(), AppRole.AdminRoleName, isStatic: true);

        var warehouse = new AppRole(Guid.CreateVersion7(), "warehouse");
        foreach (var permission in new[]
                 {
                     StageTrackPermissions.Equipment.Default, StageTrackPermissions.Labels.Assign,
                     StageTrackPermissions.Projects.Default, StageTrackPermissions.Projects.ChangeStatus,
                     StageTrackPermissions.Warehouse.Default, StageTrackPermissions.Warehouse.Scan
                 })
        {
            warehouse.Grant(permission);
        }

        var sales = new AppRole(Guid.CreateVersion7(), "sales");
        foreach (var permission in new[]
                 {
                     StageTrackPermissions.Equipment.Default, StageTrackPermissions.Customers.Default,
                     StageTrackPermissions.Customers.Manage, StageTrackPermissions.Projects.Default,
                     StageTrackPermissions.Projects.Manage, StageTrackPermissions.Projects.ChangeStatus,
                     StageTrackPermissions.Quotes.Default, StageTrackPermissions.Quotes.Manage,
                     StageTrackPermissions.Warehouse.Default
                 })
        {
            sales.Grant(permission);
        }

        await roleRepository.InsertAsync(admin);
        await roleRepository.InsertAsync(warehouse);
        await roleRepository.InsertAsync(sales);

        var adminUser = await userManager.CreateAsync("admin", "Demo Yönetici", "Admin123!", "admin@demo.local");
        adminUser.AddRole(admin.Id);
        adminUser.AddCompany(tr.Id);
        adminUser.AddCompany(ae.Id);

        var depoUser = await userManager.CreateAsync("depo", "Depo Sorumlusu", "Depo123!", "depo@demo.local");
        depoUser.AddRole(warehouse.Id);
        depoUser.AddCompany(tr.Id);

        var salesUser = await userManager.CreateAsync("satis", "Satış Temsilcisi", "Satis123!", "satis@demo.local");
        salesUser.AddRole(sales.Id);
        salesUser.AddCompany(tr.Id);

        var dubaiUser = await userManager.CreateAsync("dubai", "Dubai Operations", "Dubai123!", "dubai@demo.local", "en");
        dubaiUser.AddRole(admin.Id);
        dubaiUser.AddCompany(ae.Id);
    }

    private async Task SeedTurkeyAsync(Company company)
    {
        var gunesli = await stockLocationRepository.InsertAsync(new StockLocation(Guid.CreateVersion7(), "GÜNEŞLİ",
            StockLocationType.Warehouse, "Bağlar Mah. 63. Sok 7Z1 Bağcılar", "İstanbul"));
        await stockLocationRepository.InsertAsync(new StockLocation(Guid.CreateVersion7(), "DIP1 DUBAI",
            StockLocationType.StorageLocation, null, "Dubai"));

        var folders = await SeedFoldersAsync();
        await SeedEquipmentAsync(folders, gunesli.Id);
        await unitOfWork.SaveChangesAsync();

        var standard = await rentalFactorManager.CreateAsync("Standart", 0.5m,
            [(1, 1m), (2, 1.5m), (3, 2m), (4, 2.5m), (5, 3m), (7, 4m)], isDefault: true);
        await rentalFactorRepository.InsertAsync(standard);
        await unitOfWork.SaveChangesAsync();
        var longTerm = await rentalFactorManager.CreateAsync("Uzun dönem / Sabit kurulum", 0.2m,
            [(1, 1m), (7, 3m), (30, 8m), (90, 18m)], isDefault: false);
        await rentalFactorRepository.InsertAsync(longTerm);

        var customers = await SeedCustomersAsync();
        await unitOfWork.SaveChangesAsync();

        await SeedProjectsAsync(company, customers, gunesli.Id, longTerm.Id);
    }

    private async Task<Dictionary<string, Guid>> SeedFoldersAsync()
    {
        var result = new Dictionary<string, Guid>();

        async Task<Guid> Add(string key, string name, string? parentKey)
        {
            var folder = await folderManager.CreateAsync(name, parentKey is null ? null : result[parentKey]);
            await folderRepository.InsertAsync(folder);
            await unitOfWork.SaveChangesAsync();
            result[key] = folder.Id;
            return folder.Id;
        }

        await Add("audio", "AUDIO", null);
        await Add("speaker", "Hoparlör", "audio");
        await Add("amp", "Amfi", "audio");
        await Add("console-a", "Mikser", "audio");
        await Add("mic", "Mikrofon", "audio");
        await Add("cable-a", "Kablo", "audio");
        await Add("light", "LIGHT", null);
        await Add("moving", "Moving Head", "light");
        await Add("wash", "Wash", "light");
        await Add("profile", "Profil / Strobe", "light");
        await Add("console-l", "Işık Konsolu", "light");
        await Add("cable-l", "Kablo", "light");
        await Add("video", "VIDEO", null);
        await Add("display", "Display", "video");
        await Add("led", "Led Screen", "video");
        await Add("projection", "Projeksiyon", "video");
        await Add("media", "Media Server", "video");
        await Add("network", "Network", "video");
        await Add("truss", "TRUSS", null);
        return result;
    }

    private async Task SeedEquipmentAsync(Dictionary<string, Guid> folders, Guid locationId)
    {
        // key, code, name, brand, model, folder, units (0 = quantity tracked), stock, daily price (TRY), unit ref prefix
        (string Key, string Code, string Name, string? Brand, string? Model, string Folder, int Units, int Stock, decimal Price, string Prefix)[] items =
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
            ("tower", "Truss-087", "HTS TRUSS 3M TOWER SECTION 45*45", "HTS", "45*45", "truss", 0, 16, 250, "")
        ];

        var random = new Random(42);
        foreach (var item in items)
        {
            var equipment = await equipmentManager.CreateAsync(item.Code, item.Name, EquipmentType.Physical, item.Units > 0);
            equipment.Update(item.Name, item.Brand, item.Model, folders[item.Folder], EquipmentType.Physical, null, null, null);
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

        // Two wash spots are in repair, as in the customer's Rentman "Repairs" screen.
        unitManager.ChangeStatus(_units["wash1200"][18], UnitStatus.InRepair);
        unitManager.ChangeStatus(_units["wash1200"][19], UnitStatus.InRepair);
    }

    private async Task<Dictionary<string, Guid>> SeedCustomersAsync()
    {
        (string Key, string Name, string Tax, string City, string Contact)[] items =
        [
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
            ("regnum", "Regnum Carya Golf & Spa Resort", "7340023987", "Antalya", "Etkinlik Müdürü")
        ];

        var result = new Dictionary<string, Guid>();
        foreach (var item in items)
        {
            var customer = await customerManager.CreateAsync(item.Name, item.Tax);
            customer.Update(item.Name, item.City + " VD", item.Contact, null, null, null, item.City, "Türkiye", null);
            await customerRepository.InsertAsync(customer);
            result[item.Key] = customer.Id;
        }

        return result;
    }

    private async Task SeedProjectsAsync(Company company, Dictionary<string, Guid> customers, Guid locationId, Guid longTermProfileId)
    {
        var today = DateTime.Today;
        DateTime Day(int offset, int hour = 8) => today.AddDays(offset).AddHours(hour);

        // Fixed installation running all year: most Sharpy Beams are tied up here, which creates real shortages.
        var uniq = await CreateProjectAsync(2039, "UNIQ HALL - SABİT SİSTEM", customers["bkm"], "UNIQ Hall", "#7c3aed",
            Day(-270), Day(90), null, null, locationId,
            [("sharpy", 14), ("robin", 12), ("atomic", 4), ("etc", 4), ("ma2", 1), ("k3", 6), ("sb18", 4), ("cl5", 1)]);
        await CheckOutAllAsync(uniq);
        await projectManager.ChangeStatusAsync(uniq, ProjectStatus.OnLocation);

        var cerModern = await CreateProjectAsync(2147, "Atlantis Yapım CER-MODERN", customers["atlantis"], "IF Ankara", "#f97316",
            Day(-24), Day(-12), Day(-22), Day(-14), locationId, [("vid039", 2), ("vid072", 2), ("xlr", 20)]);
        await CheckOutAllAsync(cerModern);
        await projectManager.ChangeStatusAsync(cerModern, ProjectStatus.OnLocation);
        await CheckInAllAsync(cerModern);
        await projectManager.ChangeStatusAsync(cerModern, ProjectStatus.Returned);

        var pur = await CreateProjectAsync(2393, "PÜR STÜDYO PROJEKSİYON", customers["pur"], "Pür Recording Studios & Residence", "#f97316",
            Day(-3), Day(360), null, null, locationId,
            [("vid301", 4), ("vid090", 1), ("vid060", 1), ("vid063", 1), ("vid072", 2)]);
        await CheckOutAllAsync(pur);
        await projectManager.ChangeStatusAsync(pur, ProjectStatus.OnLocation);

        var amr = await CreateProjectAsync(2384, "AMR DIAB KONSER", customers["temacc"], "Ataköy Marina", "#f97316",
            Day(-2), Day(1, 23), Day(-1), Day(0, 23), locationId,
            [("k3", 6), ("sb18", 4), ("larak", 2), ("cl5", 1), ("wash1200", 8), ("sharpyplus", 8), ("ma3", 1), ("truss3", 16), ("tower", 4)]);
        await CheckOutAllAsync(amr);
        await projectManager.ChangeStatusAsync(amr, ProjectStatus.OnLocation);

        var zorlu = await CreateProjectAsync(2386, "Zorlu PSM Chauvet 2 ekim", customers["promise"], "Zorlu PSM", "#22c55e",
            Day(1), Day(3, 20), Day(2), Day(2, 23), locationId, [("strike", 8), ("robin", 6), ("dmx", 40)]);
        await CheckOutAllAsync(zorlu);
        await projectManager.ChangeStatusAsync(zorlu, ProjectStatus.Prepped);

        var ella = await CreateProjectAsync(2381, "Ella Event Toplantı Boğaziçi", customers["elli5"], "Çırağan Palace Kempinski", "#22c55e",
            Day(0), Day(1, 22), Day(1), Day(1, 18), locationId, [("vid042", 2), ("vid034", 1), ("vid020", 4), ("ledfloor", 2), ("ad2", 4), ("112p", 2), ("xlr", 30)]);
        await projectManager.ChangeStatusAsync(ella, ProjectStatus.Confirmed);

        // Needs 16 Sharpy Beams while 14 are installed at UNIQ Hall: the demo shows the shortage warning.
        var teknofest = await CreateProjectAsync(2400, "Teknofest Şanlıurfa", customers["brand"], "Şanlıurfa GAP Arena", "#22c55e",
            Day(2), Day(6, 22), Day(3), Day(5, 23), locationId, [("sharpy", 16), ("wash1200", 10), ("led045", 24), ("truss3", 20), ("ma3", 1)]);
        await projectManager.ChangeStatusAsync(teknofest, ProjectStatus.Confirmed);

        var nil = await CreateProjectAsync(2396, "NİL KARAİBRAHİMGİL - KONSER @İZMİR FUAR", customers["sek"], "İzmir Fuar Açıkhava", "#f97316",
            Day(4), Day(6, 23), Day(5), Day(5, 23), locationId, [("k3", 6), ("sb18", 4), ("la8", 4), ("cl5", 1), ("robin", 8), ("sharpyplus", 12)]);
        await projectManager.ChangeStatusAsync(nil, ProjectStatus.Pending);

        var iac = await CreateProjectAsync(2362, "Uluslararası Astronotik Kongresi (IAC) Antalya", customers["altus"], "Regnum Carya", "#f97316",
            Day(5), Day(12), Day(6), Day(11), locationId, [("vid301", 2), ("led045", 16), ("vid063", 2), ("ad2", 8), ("dvx", 4)]);
        await projectManager.ChangeStatusAsync(iac, ProjectStatus.Pending);

        var netflix = await CreateProjectAsync(2329, "STAGERSBASE NETFLIX 7 ekim Uniq", customers["ciragan"], "Çırağan Palace Kempinski", "#22c55e",
            Day(3), Day(5), Day(4), Day(4, 23), locationId, [("vid024", 2), ("etc", 2)]);
        await projectManager.ChangeStatusAsync(netflix, ProjectStatus.Pending);

        await CreateProjectAsync(2373, "BLOK3 ANKARA KONSER", customers["ceo"], "Ankara Congresium", "#22c55e",
            Day(8), Day(11), Day(9), Day(10), locationId, [("k3", 6), ("sb18", 4), ("sharpy", 6)]);

        await unitOfWork.SaveChangesAsync();
        await SeedQuotesAsync(company, ella, amr, nil, uniq, longTermProfileId);
    }

    private async Task<Project> CreateProjectAsync(int number, string name, Guid customerId, string venue, string color,
        DateTime planStart, DateTime planEnd, DateTime? useStart, DateTime? useEnd, Guid locationId,
        (string Key, int Quantity)[] equipment)
    {
        var project = await projectManager.CreateAsync(name, planStart, planEnd, number);
        project.Update(name, customerId, venue, color, "PRODÜKSİYON", locationId, null);
        project.SetUsePeriod(useStart, useEnd);
        foreach (var (key, quantity) in equipment)
        {
            await projectManager.AddEquipmentAsync(project, _equipment[key].Id, quantity);
        }

        await projectRepository.InsertAsync(project);
        await unitOfWork.SaveChangesAsync();
        return project;
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

    private async Task SeedQuotesAsync(Company company, Project ella, Project amr, Project nil, Project uniq, Guid longTermProfileId)
    {
        var amrQuote = await quoteManager.CreateFromProjectAsync(amr, company, null, DateTime.Today.AddDays(-12));
        amrQuote.AddLine(QuoteLineType.Crew, null, "Ses ve ışık teknik ekip (4 kişi)", 4, 7500, applyFactor: true, discountPercent: 0);
        amrQuote.AddLine(QuoteLineType.Transport, null, "Nakliye - İstanbul içi (kamyon)", 2, 9000, applyFactor: false, discountPercent: 0);
        amrQuote.UpdateHeader(amrQuote.IssueDate, DateTime.Today.AddDays(-2), 10, company.DefaultVatRate, null);
        await quoteRepository.InsertAsync(amrQuote);
        await unitOfWork.SaveChangesAsync();
        await quoteManager.ChangeStatusAsync(amrQuote, QuoteStatus.Sent, amr);
        await quoteManager.ChangeStatusAsync(amrQuote, QuoteStatus.Accepted, amr);

        var ellaQuote = await quoteManager.CreateFromProjectAsync(ella, company, null, DateTime.Today.AddDays(-4));
        ellaQuote.AddLine(QuoteLineType.Crew, null, "Görüntü teknisyeni", 1, 6000, applyFactor: true, discountPercent: 0);
        ellaQuote.UpdateHeader(ellaQuote.IssueDate, DateTime.Today.AddDays(10), 5, company.DefaultVatRate, null);
        await quoteRepository.InsertAsync(ellaQuote);
        await unitOfWork.SaveChangesAsync();
        await quoteManager.ChangeStatusAsync(ellaQuote, QuoteStatus.Sent, ella);

        var nilQuote = await quoteManager.CreateFromProjectAsync(nil, company, null, DateTime.Today);
        nilQuote.AddLine(QuoteLineType.Crew, null, "Ses ve ışık teknik ekip (6 kişi)", 6, 7500, applyFactor: true, discountPercent: 0);
        nilQuote.AddLine(QuoteLineType.Transport, null, "Nakliye - İstanbul / İzmir (tır)", 1, 45000, applyFactor: false, discountPercent: 0);
        await quoteRepository.InsertAsync(nilQuote);
        await unitOfWork.SaveChangesAsync();

        var uniqQuote = await quoteManager.CreateFromProjectAsync(uniq, company, longTermProfileId, DateTime.Today.AddDays(-275));
        await quoteRepository.InsertAsync(uniqQuote);
        await unitOfWork.SaveChangesAsync();
        await quoteManager.ChangeStatusAsync(uniqQuote, QuoteStatus.Sent, uniq);
        await quoteManager.ChangeStatusAsync(uniqQuote, QuoteStatus.Accepted, uniq);
        await unitOfWork.SaveChangesAsync();
    }

    /// <summary>Same content a Rentman QR label holds, so demo labels scan exactly like the real ones.</summary>
    private string NextLabel() => $"{{\"ID\":\"{_nextLabel++}\",\"cmpID\":{TurkeyRentmanWorkspace},\"isCase\":0}}";
}
