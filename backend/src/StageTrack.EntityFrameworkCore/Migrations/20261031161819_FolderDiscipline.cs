using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StageTrack.EntityFrameworkCore.Migrations
{
    /// <inheritdoc />
    public partial class FolderDiscipline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Discipline",
                table: "EquipmentFolders",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentFolders_CompanyId_Discipline",
                table: "EquipmentFolders",
                columns: new[] { "CompanyId", "Discipline" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EquipmentFolders_CompanyId_Discipline",
                table: "EquipmentFolders");

            migrationBuilder.DropColumn(
                name: "Discipline",
                table: "EquipmentFolders");
        }
    }
}
