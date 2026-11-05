using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StageTrack.EntityFrameworkCore.Migrations
{
    /// <inheritdoc />
    public partial class IntegrityConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Suppliers_CompanyId_Name",
                table: "Suppliers");

            migrationBuilder.DropIndex(
                name: "IX_Customers_CompanyId_TaxNumber",
                table: "Customers");

            migrationBuilder.CreateIndex(
                name: "IX_UnitInspections_CompanyId",
                table: "UnitInspections",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Tasks_CompanyId",
                table: "Tasks",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Suppliers_CompanyId_Name",
                table: "Suppliers",
                columns: new[] { "CompanyId", "Name" },
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_RentalFactorProfiles_CompanyId",
                table: "RentalFactorProfiles",
                column: "CompanyId",
                unique: true,
                filter: "[IsDeleted] = 0 AND [IsDefault] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_Notes_CompanyId",
                table: "Notes",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_LabelTemplates_CompanyId",
                table: "LabelTemplates",
                column: "CompanyId",
                unique: true,
                filter: "[IsDeleted] = 0 AND [IsDefault] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_Equipment_CompanyId_Name",
                table: "Equipment",
                columns: new[] { "CompanyId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_Customers_CompanyId_TaxNumber",
                table: "Customers",
                columns: new[] { "CompanyId", "TaxNumber" },
                unique: true,
                filter: "[IsDeleted] = 0 AND [TaxNumber] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Attachments_CompanyId",
                table: "Attachments",
                column: "CompanyId");

            migrationBuilder.AddForeignKey(
                name: "FK_Attachments_Companies_CompanyId",
                table: "Attachments",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_AuditLogs_Companies_CompanyId",
                table: "AuditLogs",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Customers_Companies_CompanyId",
                table: "Customers",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Equipment_Companies_CompanyId",
                table: "Equipment",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_EquipmentFolders_Companies_CompanyId",
                table: "EquipmentFolders",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_EquipmentLabels_Companies_CompanyId",
                table: "EquipmentLabels",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_EquipmentLedSpecs_Companies_CompanyId",
                table: "EquipmentLedSpecs",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_EquipmentUnits_Companies_CompanyId",
                table: "EquipmentUnits",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LabelTemplates_Companies_CompanyId",
                table: "LabelTemplates",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LedPanelFavorites_Companies_CompanyId",
                table: "LedPanelFavorites",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LedStageSettings_Companies_CompanyId",
                table: "LedStageSettings",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LedTransportSettings_Companies_CompanyId",
                table: "LedTransportSettings",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LedTransportVehicles_Companies_CompanyId",
                table: "LedTransportVehicles",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Notes_Companies_CompanyId",
                table: "Notes",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Projects_Companies_CompanyId",
                table: "Projects",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Quotes_Companies_CompanyId",
                table: "Quotes",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RentalFactorProfiles_Companies_CompanyId",
                table: "RentalFactorProfiles",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Repairs_Companies_CompanyId",
                table: "Repairs",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SitePlans_Companies_CompanyId",
                table: "SitePlans",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_StockLocations_Companies_CompanyId",
                table: "StockLocations",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Suppliers_Companies_CompanyId",
                table: "Suppliers",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Tasks_Companies_CompanyId",
                table: "Tasks",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_UnitInspections_Companies_CompanyId",
                table: "UnitInspections",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_WarehouseMovements_Companies_CompanyId",
                table: "WarehouseMovements",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Attachments_Companies_CompanyId",
                table: "Attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_AuditLogs_Companies_CompanyId",
                table: "AuditLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_Customers_Companies_CompanyId",
                table: "Customers");

            migrationBuilder.DropForeignKey(
                name: "FK_Equipment_Companies_CompanyId",
                table: "Equipment");

            migrationBuilder.DropForeignKey(
                name: "FK_EquipmentFolders_Companies_CompanyId",
                table: "EquipmentFolders");

            migrationBuilder.DropForeignKey(
                name: "FK_EquipmentLabels_Companies_CompanyId",
                table: "EquipmentLabels");

            migrationBuilder.DropForeignKey(
                name: "FK_EquipmentLedSpecs_Companies_CompanyId",
                table: "EquipmentLedSpecs");

            migrationBuilder.DropForeignKey(
                name: "FK_EquipmentUnits_Companies_CompanyId",
                table: "EquipmentUnits");

            migrationBuilder.DropForeignKey(
                name: "FK_LabelTemplates_Companies_CompanyId",
                table: "LabelTemplates");

            migrationBuilder.DropForeignKey(
                name: "FK_LedPanelFavorites_Companies_CompanyId",
                table: "LedPanelFavorites");

            migrationBuilder.DropForeignKey(
                name: "FK_LedStageSettings_Companies_CompanyId",
                table: "LedStageSettings");

            migrationBuilder.DropForeignKey(
                name: "FK_LedTransportSettings_Companies_CompanyId",
                table: "LedTransportSettings");

            migrationBuilder.DropForeignKey(
                name: "FK_LedTransportVehicles_Companies_CompanyId",
                table: "LedTransportVehicles");

            migrationBuilder.DropForeignKey(
                name: "FK_Notes_Companies_CompanyId",
                table: "Notes");

            migrationBuilder.DropForeignKey(
                name: "FK_Projects_Companies_CompanyId",
                table: "Projects");

            migrationBuilder.DropForeignKey(
                name: "FK_Quotes_Companies_CompanyId",
                table: "Quotes");

            migrationBuilder.DropForeignKey(
                name: "FK_RentalFactorProfiles_Companies_CompanyId",
                table: "RentalFactorProfiles");

            migrationBuilder.DropForeignKey(
                name: "FK_Repairs_Companies_CompanyId",
                table: "Repairs");

            migrationBuilder.DropForeignKey(
                name: "FK_SitePlans_Companies_CompanyId",
                table: "SitePlans");

            migrationBuilder.DropForeignKey(
                name: "FK_StockLocations_Companies_CompanyId",
                table: "StockLocations");

            migrationBuilder.DropForeignKey(
                name: "FK_Suppliers_Companies_CompanyId",
                table: "Suppliers");

            migrationBuilder.DropForeignKey(
                name: "FK_Tasks_Companies_CompanyId",
                table: "Tasks");

            migrationBuilder.DropForeignKey(
                name: "FK_UnitInspections_Companies_CompanyId",
                table: "UnitInspections");

            migrationBuilder.DropForeignKey(
                name: "FK_WarehouseMovements_Companies_CompanyId",
                table: "WarehouseMovements");

            migrationBuilder.DropIndex(
                name: "IX_UnitInspections_CompanyId",
                table: "UnitInspections");

            migrationBuilder.DropIndex(
                name: "IX_Tasks_CompanyId",
                table: "Tasks");

            migrationBuilder.DropIndex(
                name: "IX_Suppliers_CompanyId_Name",
                table: "Suppliers");

            migrationBuilder.DropIndex(
                name: "IX_RentalFactorProfiles_CompanyId",
                table: "RentalFactorProfiles");

            migrationBuilder.DropIndex(
                name: "IX_Notes_CompanyId",
                table: "Notes");

            migrationBuilder.DropIndex(
                name: "IX_LabelTemplates_CompanyId",
                table: "LabelTemplates");

            migrationBuilder.DropIndex(
                name: "IX_Equipment_CompanyId_Name",
                table: "Equipment");

            migrationBuilder.DropIndex(
                name: "IX_Customers_CompanyId_TaxNumber",
                table: "Customers");

            migrationBuilder.DropIndex(
                name: "IX_Attachments_CompanyId",
                table: "Attachments");

            migrationBuilder.CreateIndex(
                name: "IX_Suppliers_CompanyId_Name",
                table: "Suppliers",
                columns: new[] { "CompanyId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_Customers_CompanyId_TaxNumber",
                table: "Customers",
                columns: new[] { "CompanyId", "TaxNumber" });
        }
    }
}
