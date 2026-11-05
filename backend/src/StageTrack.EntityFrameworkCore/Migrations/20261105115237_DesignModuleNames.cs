using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StageTrack.EntityFrameworkCore.Migrations
{
    /// <inheritdoc />
    public partial class DesignModuleNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_LedStageSettings_Companies_CompanyId",
                table: "LedStageSettings");

            migrationBuilder.DropPrimaryKey(
                name: "PK_LedStageSettings",
                table: "LedStageSettings");

            migrationBuilder.RenameTable(
                name: "LedStageSettings",
                newName: "StageSettings");

            migrationBuilder.RenameIndex(
                name: "IX_LedStageSettings_CompanyId",
                table: "StageSettings",
                newName: "IX_StageSettings_CompanyId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_StageSettings",
                table: "StageSettings",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_StageSettings_Companies_CompanyId",
                table: "StageSettings",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.DropForeignKey(
                name: "FK_LedTransportSettings_Companies_CompanyId",
                table: "LedTransportSettings");

            migrationBuilder.DropPrimaryKey(
                name: "PK_LedTransportSettings",
                table: "LedTransportSettings");

            migrationBuilder.RenameTable(
                name: "LedTransportSettings",
                newName: "TransportSettings");

            migrationBuilder.RenameIndex(
                name: "IX_LedTransportSettings_CompanyId",
                table: "TransportSettings",
                newName: "IX_TransportSettings_CompanyId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_TransportSettings",
                table: "TransportSettings",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_TransportSettings_Companies_CompanyId",
                table: "TransportSettings",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.DropForeignKey(
                name: "FK_LedTransportVehicles_Companies_CompanyId",
                table: "LedTransportVehicles");

            migrationBuilder.DropPrimaryKey(
                name: "PK_LedTransportVehicles",
                table: "LedTransportVehicles");

            migrationBuilder.RenameTable(
                name: "LedTransportVehicles",
                newName: "TransportVehicles");

            migrationBuilder.RenameIndex(
                name: "IX_LedTransportVehicles_CompanyId_SortOrder",
                table: "TransportVehicles",
                newName: "IX_TransportVehicles_CompanyId_SortOrder");

            migrationBuilder.AddPrimaryKey(
                name: "PK_TransportVehicles",
                table: "TransportVehicles",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_TransportVehicles_Companies_CompanyId",
                table: "TransportVehicles",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // The permission names live in the role rows as text, and the module name in the firm row, so
            // renaming the constants is only half the job: without this every role loses the module and
            // every firm that bought it stops seeing it.
            migrationBuilder.Sql("UPDATE [RolePermissions] SET [Name] = 'StageTrack.Design' + SUBSTRING([Name], 15, 200) WHERE [Name] LIKE 'StageTrack.Led%'");
            migrationBuilder.Sql("UPDATE [RolePermissions] SET [Name] = 'StageTrack.Design.Draft' WHERE [Name] = 'StageTrack.Design.Design'");
            migrationBuilder.Sql("UPDATE [Tenants] SET [Modules] = NULLIF(STUFF(REPLACE(',' + ISNULL([Modules], '') + ',', ',Led,', ',Design,'), 1, 1, ''), '') WHERE [Modules] LIKE '%Led%'");
            migrationBuilder.Sql("UPDATE [Tenants] SET [Modules] = LEFT([Modules], LEN([Modules]) - 1) WHERE [Modules] LIKE '%,'");

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StageSettings_Companies_CompanyId",
                table: "StageSettings");

            migrationBuilder.DropPrimaryKey(
                name: "PK_StageSettings",
                table: "StageSettings");

            migrationBuilder.RenameTable(
                name: "StageSettings",
                newName: "LedStageSettings");

            migrationBuilder.RenameIndex(
                name: "IX_StageSettings_CompanyId",
                table: "LedStageSettings",
                newName: "IX_LedStageSettings_CompanyId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_LedStageSettings",
                table: "LedStageSettings",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_LedStageSettings_Companies_CompanyId",
                table: "LedStageSettings",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.DropForeignKey(
                name: "FK_TransportSettings_Companies_CompanyId",
                table: "TransportSettings");

            migrationBuilder.DropPrimaryKey(
                name: "PK_TransportSettings",
                table: "TransportSettings");

            migrationBuilder.RenameTable(
                name: "TransportSettings",
                newName: "LedTransportSettings");

            migrationBuilder.RenameIndex(
                name: "IX_TransportSettings_CompanyId",
                table: "LedTransportSettings",
                newName: "IX_LedTransportSettings_CompanyId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_LedTransportSettings",
                table: "LedTransportSettings",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_LedTransportSettings_Companies_CompanyId",
                table: "LedTransportSettings",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.DropForeignKey(
                name: "FK_TransportVehicles_Companies_CompanyId",
                table: "TransportVehicles");

            migrationBuilder.DropPrimaryKey(
                name: "PK_TransportVehicles",
                table: "TransportVehicles");

            migrationBuilder.RenameTable(
                name: "TransportVehicles",
                newName: "LedTransportVehicles");

            migrationBuilder.RenameIndex(
                name: "IX_TransportVehicles_CompanyId_SortOrder",
                table: "LedTransportVehicles",
                newName: "IX_LedTransportVehicles_CompanyId_SortOrder");

            migrationBuilder.AddPrimaryKey(
                name: "PK_LedTransportVehicles",
                table: "LedTransportVehicles",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_LedTransportVehicles_Companies_CompanyId",
                table: "LedTransportVehicles",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.Sql("UPDATE [RolePermissions] SET [Name] = 'StageTrack.Led.Design' WHERE [Name] = 'StageTrack.Design.Draft'");
            migrationBuilder.Sql("UPDATE [RolePermissions] SET [Name] = 'StageTrack.Led' + SUBSTRING([Name], 18, 200) WHERE [Name] LIKE 'StageTrack.Design%'");
            migrationBuilder.Sql("UPDATE [Tenants] SET [Modules] = NULLIF(STUFF(REPLACE(',' + ISNULL([Modules], '') + ',', ',Design,', ',Led,'), 1, 1, ''), '') WHERE [Modules] LIKE '%Design%'");
            migrationBuilder.Sql("UPDATE [Tenants] SET [Modules] = LEFT([Modules], LEN([Modules]) - 1) WHERE [Modules] LIKE '%,'");

        }
    }
}
