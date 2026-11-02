using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StageTrack.EntityFrameworkCore.Migrations
{
    /// <inheritdoc />
    public partial class SiteVenue : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "Venue_BehindStageM",
                table: "SitePlans",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Venue_ClearHeightM",
                table: "SitePlans",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Venue_DepthM",
                table: "SitePlans",
                type: "float",
                nullable: true);

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

            migrationBuilder.AddColumn<Guid>(
                name: "Venue_PlanAttachmentId",
                table: "SitePlans",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Venue_PlanMetresPerPixel",
                table: "SitePlans",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Venue_PlanOriginXM",
                table: "SitePlans",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Venue_PlanOriginZM",
                table: "SitePlans",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Venue_PlanRotationDeg",
                table: "SitePlans",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Venue_RakeDeg",
                table: "SitePlans",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Venue_StageOffsetXM",
                table: "SitePlans",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Venue_WidthM",
                table: "SitePlans",
                type: "float",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Venue_BehindStageM",
                table: "SitePlans");

            migrationBuilder.DropColumn(
                name: "Venue_ClearHeightM",
                table: "SitePlans");

            migrationBuilder.DropColumn(
                name: "Venue_DepthM",
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
                name: "Venue_PlanAttachmentId",
                table: "SitePlans");

            migrationBuilder.DropColumn(
                name: "Venue_PlanMetresPerPixel",
                table: "SitePlans");

            migrationBuilder.DropColumn(
                name: "Venue_PlanOriginXM",
                table: "SitePlans");

            migrationBuilder.DropColumn(
                name: "Venue_PlanOriginZM",
                table: "SitePlans");

            migrationBuilder.DropColumn(
                name: "Venue_PlanRotationDeg",
                table: "SitePlans");

            migrationBuilder.DropColumn(
                name: "Venue_RakeDeg",
                table: "SitePlans");

            migrationBuilder.DropColumn(
                name: "Venue_StageOffsetXM",
                table: "SitePlans");

            migrationBuilder.DropColumn(
                name: "Venue_WidthM",
                table: "SitePlans");
        }
    }
}
