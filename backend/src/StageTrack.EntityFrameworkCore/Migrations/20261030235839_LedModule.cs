using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StageTrack.EntityFrameworkCore.Migrations
{
    /// <inheritdoc />
    public partial class LedModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EquipmentLedSpecs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EquipmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Role = table.Column<int>(type: "int", nullable: false),
                    ExtenderEthernetPorts = table.Column<int>(type: "int", nullable: true),
                    FiberPorts = table.Column<int>(type: "int", nullable: true),
                    MaxPixels = table.Column<long>(type: "bigint", nullable: true),
                    PitchMm = table.Column<decimal>(type: "decimal(12,3)", nullable: true),
                    WidthMm = table.Column<int>(type: "int", nullable: true),
                    HeightMm = table.Column<int>(type: "int", nullable: true),
                    PixelWidth = table.Column<int>(type: "int", nullable: true),
                    PixelHeight = table.Column<int>(type: "int", nullable: true),
                    WattMax = table.Column<decimal>(type: "decimal(12,3)", nullable: true),
                    WattAvg = table.Column<decimal>(type: "decimal(12,3)", nullable: true),
                    MaxLink = table.Column<int>(type: "int", nullable: true),
                    AvgLink = table.Column<int>(type: "int", nullable: true),
                    PanelType = table.Column<int>(type: "int", nullable: true),
                    Group = table.Column<int>(type: "int", nullable: true),
                    AngleMin = table.Column<decimal>(type: "decimal(12,3)", nullable: true),
                    AngleMax = table.Column<decimal>(type: "decimal(12,3)", nullable: true),
                    AngleStep = table.Column<decimal>(type: "decimal(12,3)", nullable: true),
                    CasePanelCount = table.Column<int>(type: "int", nullable: true),
                    CaseDimensionsCm = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CaseWeightKg = table.Column<decimal>(type: "decimal(12,3)", nullable: true),
                    TransportKind = table.Column<int>(type: "int", nullable: true),
                    MaxStack = table.Column<int>(type: "int", nullable: true),
                    ReceivingCard = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PwmHz = table.Column<int>(type: "int", nullable: true),
                    HasExclusiveProcessors = table.Column<bool>(type: "bit", nullable: true),
                    TotalPixels = table.Column<long>(type: "bigint", nullable: true),
                    ProcessorEthernetPorts = table.Column<int>(type: "int", nullable: true),
                    PixelsPerPort = table.Column<long>(type: "bigint", nullable: true),
                    OptPorts = table.Column<int>(type: "int", nullable: true),
                    CompanyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreationTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    LastModificationTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifierId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletionTime = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EquipmentLedSpecs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EquipmentLedSpecs_Equipment_EquipmentId",
                        column: x => x.EquipmentId,
                        principalTable: "Equipment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LedPanelFavorites",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EquipmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreationTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    LastModificationTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifierId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletionTime = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LedPanelFavorites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LedPanelFavorites_Equipment_EquipmentId",
                        column: x => x.EquipmentId,
                        principalTable: "Equipment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LedStageSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StageWidthM = table.Column<decimal>(type: "decimal(12,3)", nullable: false),
                    StageDepthM = table.Column<decimal>(type: "decimal(12,3)", nullable: false),
                    StageHeightM = table.Column<decimal>(type: "decimal(12,3)", nullable: false),
                    FrontGapM = table.Column<decimal>(type: "decimal(12,3)", nullable: false),
                    Mount = table.Column<int>(type: "int", nullable: false),
                    Carrier = table.Column<int>(type: "int", nullable: false),
                    LegDepthM = table.Column<decimal>(type: "decimal(12,3)", nullable: false),
                    BottomM = table.Column<decimal>(type: "decimal(12,3)", nullable: false),
                    GroundSupport = table.Column<bool>(type: "bit", nullable: false),
                    GroundSupportHeightM = table.Column<decimal>(type: "decimal(12,3)", nullable: false),
                    TrussHeightM = table.Column<decimal>(type: "decimal(12,3)", nullable: false),
                    HangAllowanceM = table.Column<decimal>(type: "decimal(12,3)", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreationTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    LastModificationTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifierId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletionTime = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LedStageSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LedTransportSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GapMm = table.Column<int>(type: "int", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreationTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    LastModificationTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifierId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletionTime = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LedTransportSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LedTransportVehicles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    LengthMm = table.Column<int>(type: "int", nullable: false),
                    WidthMm = table.Column<int>(type: "int", nullable: false),
                    HeightMm = table.Column<int>(type: "int", nullable: false),
                    CapacityKg = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreationTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    LastModificationTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifierId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletionTime = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LedTransportVehicles", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentLedSpecs_CompanyId_EquipmentId",
                table: "EquipmentLedSpecs",
                columns: new[] { "CompanyId", "EquipmentId" },
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentLedSpecs_CompanyId_Role",
                table: "EquipmentLedSpecs",
                columns: new[] { "CompanyId", "Role" });

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentLedSpecs_EquipmentId",
                table: "EquipmentLedSpecs",
                column: "EquipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_LedPanelFavorites_CompanyId_UserId_EquipmentId",
                table: "LedPanelFavorites",
                columns: new[] { "CompanyId", "UserId", "EquipmentId" },
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_LedPanelFavorites_EquipmentId",
                table: "LedPanelFavorites",
                column: "EquipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_LedStageSettings_CompanyId",
                table: "LedStageSettings",
                column: "CompanyId",
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_LedTransportSettings_CompanyId",
                table: "LedTransportSettings",
                column: "CompanyId",
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_LedTransportVehicles_CompanyId_SortOrder",
                table: "LedTransportVehicles",
                columns: new[] { "CompanyId", "SortOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EquipmentLedSpecs");

            migrationBuilder.DropTable(
                name: "LedPanelFavorites");

            migrationBuilder.DropTable(
                name: "LedStageSettings");

            migrationBuilder.DropTable(
                name: "LedTransportSettings");

            migrationBuilder.DropTable(
                name: "LedTransportVehicles");
        }
    }
}
