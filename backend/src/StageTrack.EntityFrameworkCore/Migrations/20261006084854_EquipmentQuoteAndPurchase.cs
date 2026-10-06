using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StageTrack.EntityFrameworkCore.Migrations
{
    /// <inheritdoc />
    public partial class EquipmentQuoteAndPurchase : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PurchaseDate",
                table: "Equipment",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PurchaseSupplierId",
                table: "Equipment",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ShowInQuotes",
                table: "Equipment",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "WarrantyEndDate",
                table: "Equipment",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Equipment_PurchaseSupplierId",
                table: "Equipment",
                column: "PurchaseSupplierId");

            migrationBuilder.AddForeignKey(
                name: "FK_Equipment_Suppliers_PurchaseSupplierId",
                table: "Equipment",
                column: "PurchaseSupplierId",
                principalTable: "Suppliers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Equipment_Suppliers_PurchaseSupplierId",
                table: "Equipment");

            migrationBuilder.DropIndex(
                name: "IX_Equipment_PurchaseSupplierId",
                table: "Equipment");

            migrationBuilder.DropColumn(
                name: "PurchaseDate",
                table: "Equipment");

            migrationBuilder.DropColumn(
                name: "PurchaseSupplierId",
                table: "Equipment");

            migrationBuilder.DropColumn(
                name: "ShowInQuotes",
                table: "Equipment");

            migrationBuilder.DropColumn(
                name: "WarrantyEndDate",
                table: "Equipment");
        }
    }
}
