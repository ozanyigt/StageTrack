using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StageTrack.EntityFrameworkCore.Migrations
{
    /// <inheritdoc />
    public partial class RentmanWorkspace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RentmanWorkspaceId",
                table: "Companies",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Companies_RentmanWorkspaceId",
                table: "Companies",
                column: "RentmanWorkspaceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Companies_RentmanWorkspaceId",
                table: "Companies");

            migrationBuilder.DropColumn(
                name: "RentmanWorkspaceId",
                table: "Companies");
        }
    }
}
