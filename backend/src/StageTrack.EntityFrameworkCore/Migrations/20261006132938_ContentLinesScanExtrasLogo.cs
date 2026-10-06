using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StageTrack.EntityFrameworkCore.Migrations
{
    /// <inheritdoc />
    public partial class ContentLinesScanExtrasLogo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EquipmentUnits_CompanyId_InternalRef",
                table: "EquipmentUnits");

            migrationBuilder.AddColumn<byte[]>(
                name: "LogoContent",
                table: "Tenants",
                type: "varbinary(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LogoContentType",
                table: "Tenants",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsContent",
                table: "QuoteLines",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsWarehouseExtras",
                table: "ProjectSections",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ContentQuantity",
                table: "ProjectEquipment",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsExtra",
                table: "ProjectEquipment",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "ParentLineId",
                table: "ProjectEquipment",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsPriceManual",
                table: "Equipment",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentUnits_CompanyId_EquipmentId_InternalRef",
                table: "EquipmentUnits",
                columns: new[] { "CompanyId", "EquipmentId", "InternalRef" },
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentUnits_CompanyId_InternalRef",
                table: "EquipmentUnits",
                columns: new[] { "CompanyId", "InternalRef" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EquipmentUnits_CompanyId_EquipmentId_InternalRef",
                table: "EquipmentUnits");

            migrationBuilder.DropIndex(
                name: "IX_EquipmentUnits_CompanyId_InternalRef",
                table: "EquipmentUnits");

            migrationBuilder.DropColumn(
                name: "LogoContent",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "LogoContentType",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "IsContent",
                table: "QuoteLines");

            migrationBuilder.DropColumn(
                name: "IsWarehouseExtras",
                table: "ProjectSections");

            migrationBuilder.DropColumn(
                name: "ContentQuantity",
                table: "ProjectEquipment");

            migrationBuilder.DropColumn(
                name: "IsExtra",
                table: "ProjectEquipment");

            migrationBuilder.DropColumn(
                name: "ParentLineId",
                table: "ProjectEquipment");

            migrationBuilder.DropColumn(
                name: "IsPriceManual",
                table: "Equipment");

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentUnits_CompanyId_InternalRef",
                table: "EquipmentUnits",
                columns: new[] { "CompanyId", "InternalRef" },
                unique: true,
                filter: "[IsDeleted] = 0");
        }
    }
}
