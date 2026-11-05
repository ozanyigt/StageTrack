using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StageTrack.EntityFrameworkCore.Migrations
{
    /// <inheritdoc />
    public partial class DropSitePlanMapData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SitePlanItem");

            migrationBuilder.DropTable(
                name: "SitePlanZone");

            migrationBuilder.DropColumn(
                name: "BaseLayer",
                table: "SitePlans");

            migrationBuilder.DropColumn(
                name: "CentreLat",
                table: "SitePlans");

            migrationBuilder.DropColumn(
                name: "CentreLng",
                table: "SitePlans");

            migrationBuilder.DropColumn(
                name: "NightMode",
                table: "SitePlans");

            migrationBuilder.DropColumn(
                name: "Venue_MapRotationDeg",
                table: "SitePlans");

            migrationBuilder.DropColumn(
                name: "Venue_OriginLat",
                table: "SitePlans");

            migrationBuilder.DropColumn(
                name: "Venue_OriginLng",
                table: "SitePlans");

            migrationBuilder.DropColumn(
                name: "Zoom",
                table: "SitePlans");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BaseLayer",
                table: "SitePlans",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<double>(
                name: "CentreLat",
                table: "SitePlans",
                type: "float",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "CentreLng",
                table: "SitePlans",
                type: "float",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<bool>(
                name: "NightMode",
                table: "SitePlans",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<double>(
                name: "Venue_MapRotationDeg",
                table: "SitePlans",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Venue_OriginLat",
                table: "SitePlans",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Venue_OriginLng",
                table: "SitePlans",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Zoom",
                table: "SitePlans",
                type: "float",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.CreateTable(
                name: "SitePlanItem",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EquipmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Label = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    Lat = table.Column<double>(type: "float", nullable: false),
                    Layer = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    LightHeightM = table.Column<decimal>(type: "decimal(12,3)", nullable: true),
                    LightIntensity = table.Column<int>(type: "int", nullable: true),
                    LightRadiusM = table.Column<decimal>(type: "decimal(12,3)", nullable: true),
                    Lng = table.Column<double>(type: "float", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    RotationDeg = table.Column<double>(type: "float", nullable: false),
                    SitePlanId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
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
                    Color = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    Kind = table.Column<int>(type: "int", nullable: false),
                    Layer = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    Name = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Points = table.Column<string>(type: "nvarchar(max)", maxLength: 16000, nullable: false),
                    SitePlanId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
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
                name: "IX_SitePlanZone_SitePlanId",
                table: "SitePlanZone",
                column: "SitePlanId");
        }
    }
}
