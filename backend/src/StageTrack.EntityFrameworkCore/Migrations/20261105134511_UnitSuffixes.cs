using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StageTrack.EntityFrameworkCore.Migrations
{
    /// <inheritdoc />
    public partial class UnitSuffixes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "VatRate",
                table: "Quotes",
                newName: "VatPercent");

            migrationBuilder.RenameColumn(
                name: "WattMax",
                table: "EquipmentLedSpecs",
                newName: "PowerMaxW");

            migrationBuilder.RenameColumn(
                name: "WattAvg",
                table: "EquipmentLedSpecs",
                newName: "PowerAvgW");

            migrationBuilder.RenameColumn(
                name: "AngleStep",
                table: "EquipmentLedSpecs",
                newName: "AngleStepDeg");

            migrationBuilder.RenameColumn(
                name: "AngleMin",
                table: "EquipmentLedSpecs",
                newName: "AngleMinDeg");

            migrationBuilder.RenameColumn(
                name: "AngleMax",
                table: "EquipmentLedSpecs",
                newName: "AngleMaxDeg");

            migrationBuilder.RenameColumn(
                name: "DefaultVatRate",
                table: "Companies",
                newName: "DefaultVatPercent");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "VatPercent",
                table: "Quotes",
                newName: "VatRate");

            migrationBuilder.RenameColumn(
                name: "PowerMaxW",
                table: "EquipmentLedSpecs",
                newName: "WattMax");

            migrationBuilder.RenameColumn(
                name: "PowerAvgW",
                table: "EquipmentLedSpecs",
                newName: "WattAvg");

            migrationBuilder.RenameColumn(
                name: "AngleStepDeg",
                table: "EquipmentLedSpecs",
                newName: "AngleStep");

            migrationBuilder.RenameColumn(
                name: "AngleMinDeg",
                table: "EquipmentLedSpecs",
                newName: "AngleMin");

            migrationBuilder.RenameColumn(
                name: "AngleMaxDeg",
                table: "EquipmentLedSpecs",
                newName: "AngleMax");

            migrationBuilder.RenameColumn(
                name: "DefaultVatPercent",
                table: "Companies",
                newName: "DefaultVatRate");
        }
    }
}
