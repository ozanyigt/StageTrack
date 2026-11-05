using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StageTrack.EntityFrameworkCore.Migrations
{
    /// <inheritdoc />
    public partial class ColumnTypesAndChecks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EquipmentLedSpecs_Equipment_EquipmentId",
                table: "EquipmentLedSpecs");

            migrationBuilder.AlterColumn<decimal>(
                name: "PitchMm",
                table: "EquipmentLedSpecs",
                type: "decimal(9,4)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(12,3)",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "VolumeM3",
                table: "Equipment",
                type: "decimal(12,6)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(12,3)",
                oldNullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_SitePlans_Venue_AllOrNothing",
                table: "SitePlans",
                sql: "([Venue_WidthM] IS NULL AND [Venue_DepthM] IS NULL AND [Venue_ClearHeightM] IS NULL AND [Venue_StageOffsetXM] IS NULL AND [Venue_BehindStageM] IS NULL AND [Venue_RakeDeg] IS NULL AND [Venue_PlanOriginXM] IS NULL AND [Venue_PlanOriginZM] IS NULL AND [Venue_PlanRotationDeg] IS NULL) OR ([Venue_WidthM] IS NOT NULL AND [Venue_DepthM] IS NOT NULL AND [Venue_ClearHeightM] IS NOT NULL AND [Venue_StageOffsetXM] IS NOT NULL AND [Venue_BehindStageM] IS NOT NULL AND [Venue_RakeDeg] IS NOT NULL AND [Venue_PlanOriginXM] IS NOT NULL AND [Venue_PlanOriginZM] IS NOT NULL AND [Venue_PlanRotationDeg] IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_Quotes_CompanyId_IssueDate",
                table: "Quotes",
                columns: new[] { "CompanyId", "IssueDate" });

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentUnits_CompanyId_IsArchived_Status",
                table: "EquipmentUnits",
                columns: new[] { "CompanyId", "IsArchived", "Status" });

            migrationBuilder.AddForeignKey(
                name: "FK_EquipmentLedSpecs_Equipment_EquipmentId",
                table: "EquipmentLedSpecs",
                column: "EquipmentId",
                principalTable: "Equipment",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EquipmentLedSpecs_Equipment_EquipmentId",
                table: "EquipmentLedSpecs");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SitePlans_Venue_AllOrNothing",
                table: "SitePlans");

            migrationBuilder.DropIndex(
                name: "IX_Quotes_CompanyId_IssueDate",
                table: "Quotes");

            migrationBuilder.DropIndex(
                name: "IX_EquipmentUnits_CompanyId_IsArchived_Status",
                table: "EquipmentUnits");

            migrationBuilder.AlterColumn<decimal>(
                name: "PitchMm",
                table: "EquipmentLedSpecs",
                type: "decimal(12,3)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(9,4)",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "VolumeM3",
                table: "Equipment",
                type: "decimal(12,3)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(12,6)",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_EquipmentLedSpecs_Equipment_EquipmentId",
                table: "EquipmentLedSpecs",
                column: "EquipmentId",
                principalTable: "Equipment",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
