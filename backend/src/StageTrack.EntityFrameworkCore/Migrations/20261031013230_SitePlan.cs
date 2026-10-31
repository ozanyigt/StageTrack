using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StageTrack.EntityFrameworkCore.Migrations
{
    /// <inheritdoc />
    public partial class SitePlan : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SitePlans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    CentreLat = table.Column<double>(type: "float", nullable: false),
                    CentreLng = table.Column<double>(type: "float", nullable: false),
                    Zoom = table.Column<double>(type: "float", nullable: false),
                    BaseLayer = table.Column<int>(type: "int", nullable: false),
                    NightMode = table.Column<bool>(type: "bit", nullable: false),
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
                    table.PrimaryKey("PK_SitePlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SitePlans_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SitePlanItem",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SitePlanId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EquipmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Label = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    Lat = table.Column<double>(type: "float", nullable: false),
                    Lng = table.Column<double>(type: "float", nullable: false),
                    RotationDeg = table.Column<double>(type: "float", nullable: false),
                    Layer = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    LightHeightM = table.Column<decimal>(type: "decimal(12,3)", nullable: true),
                    LightIntensity = table.Column<int>(type: "int", nullable: true),
                    LightRadiusM = table.Column<decimal>(type: "decimal(12,3)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SitePlanItem", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SitePlanItem_Equipment_EquipmentId",
                        column: x => x.EquipmentId,
                        principalTable: "Equipment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SitePlanItem_SitePlans_SitePlanId",
                        column: x => x.SitePlanId,
                        principalTable: "SitePlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SitePlanZone",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SitePlanId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Kind = table.Column<int>(type: "int", nullable: false),
                    Points = table.Column<string>(type: "nvarchar(max)", maxLength: 16000, nullable: false),
                    Color = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    Layer = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SitePlanZone", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SitePlanZone_SitePlans_SitePlanId",
                        column: x => x.SitePlanId,
                        principalTable: "SitePlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SitePlanItem_EquipmentId",
                table: "SitePlanItem",
                column: "EquipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_SitePlanItem_SitePlanId",
                table: "SitePlanItem",
                column: "SitePlanId");

            migrationBuilder.CreateIndex(
                name: "IX_SitePlans_CompanyId_ProjectId",
                table: "SitePlans",
                columns: new[] { "CompanyId", "ProjectId" },
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_SitePlans_ProjectId",
                table: "SitePlans",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_SitePlanZone_SitePlanId",
                table: "SitePlanZone",
                column: "SitePlanId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SitePlanItem");

            migrationBuilder.DropTable(
                name: "SitePlanZone");

            migrationBuilder.DropTable(
                name: "SitePlans");
        }
    }
}
