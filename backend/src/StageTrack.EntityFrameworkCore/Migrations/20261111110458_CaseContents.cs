using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StageTrack.EntityFrameworkCore.Migrations
{
    /// <inheritdoc />
    public partial class CaseContents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CaseContents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CaseEquipmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EquipmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UnitId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Quantity = table.Column<int>(type: "int", nullable: false),
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
                    table.PrimaryKey("PK_CaseContents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CaseContents_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CaseContents_EquipmentUnits_UnitId",
                        column: x => x.UnitId,
                        principalTable: "EquipmentUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CaseContents_Equipment_CaseEquipmentId",
                        column: x => x.CaseEquipmentId,
                        principalTable: "Equipment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CaseContents_Equipment_EquipmentId",
                        column: x => x.EquipmentId,
                        principalTable: "Equipment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CaseContents_CaseEquipmentId",
                table: "CaseContents",
                column: "CaseEquipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_CaseContents_CompanyId_CaseEquipmentId_SortOrder",
                table: "CaseContents",
                columns: new[] { "CompanyId", "CaseEquipmentId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_CaseContents_CompanyId_UnitId",
                table: "CaseContents",
                columns: new[] { "CompanyId", "UnitId" },
                unique: true,
                filter: "[IsDeleted] = 0 AND [UnitId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CaseContents_EquipmentId",
                table: "CaseContents",
                column: "EquipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_CaseContents_UnitId",
                table: "CaseContents",
                column: "UnitId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CaseContents");
        }
    }
}
