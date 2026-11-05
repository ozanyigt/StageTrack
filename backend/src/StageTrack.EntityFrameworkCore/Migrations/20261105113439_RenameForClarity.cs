using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StageTrack.EntityFrameworkCore.Migrations
{
    /// <inheritdoc />
    public partial class RenameForClarity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProjectCrew_Projects_ProjectId",
                table: "ProjectCrew");

            migrationBuilder.DropForeignKey(
                name: "FK_ProjectCrew_Users_UserId",
                table: "ProjectCrew");

            migrationBuilder.DropForeignKey(
                name: "FK_ProjectEquipment_Equipment_EquipmentId",
                table: "ProjectEquipment");

            migrationBuilder.DropForeignKey(
                name: "FK_ProjectEquipment_Projects_ProjectId",
                table: "ProjectEquipment");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ProjectEquipment",
                table: "ProjectEquipment");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ProjectCrew",
                table: "ProjectCrew");

            migrationBuilder.RenameTable(
                name: "ProjectEquipment",
                newName: "ProjectEquipmentLines");

            migrationBuilder.RenameTable(
                name: "ProjectCrew",
                newName: "ProjectCrewMembers");

            migrationBuilder.RenameColumn(
                name: "Venue",
                table: "Projects",
                newName: "VenueName");

            migrationBuilder.RenameIndex(
                name: "IX_ProjectEquipment_ProjectId",
                table: "ProjectEquipmentLines",
                newName: "IX_ProjectEquipmentLines_ProjectId");

            migrationBuilder.RenameIndex(
                name: "IX_ProjectEquipment_EquipmentId",
                table: "ProjectEquipmentLines",
                newName: "IX_ProjectEquipmentLines_EquipmentId");

            migrationBuilder.RenameIndex(
                name: "IX_ProjectCrew_UserId",
                table: "ProjectCrewMembers",
                newName: "IX_ProjectCrewMembers_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_ProjectCrew_ProjectId_UserId",
                table: "ProjectCrewMembers",
                newName: "IX_ProjectCrewMembers_ProjectId_UserId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ProjectEquipmentLines",
                table: "ProjectEquipmentLines",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ProjectCrewMembers",
                table: "ProjectCrewMembers",
                column: "Id");

            // The record is the job's venue now rather than a site plan, and the measurements inside it are
            // the room. Renamed rather than rebuilt: these rows are the halls firms have already measured.
            migrationBuilder.DropCheckConstraint(
                name: "CK_SitePlans_Venue_AllOrNothing",
                table: "SitePlans");

            migrationBuilder.DropForeignKey(
                name: "FK_SitePlans_Companies_CompanyId",
                table: "SitePlans");

            migrationBuilder.DropForeignKey(
                name: "FK_SitePlans_Projects_ProjectId",
                table: "SitePlans");

            migrationBuilder.DropPrimaryKey(
                name: "PK_SitePlans",
                table: "SitePlans");

            migrationBuilder.RenameTable(
                name: "SitePlans",
                newName: "ProjectVenues");

            migrationBuilder.RenameColumn(
                name: "Venue_WidthM",
                table: "ProjectVenues",
                newName: "Room_WidthM");

            migrationBuilder.RenameColumn(
                name: "Venue_DepthM",
                table: "ProjectVenues",
                newName: "Room_DepthM");

            migrationBuilder.RenameColumn(
                name: "Venue_ClearHeightM",
                table: "ProjectVenues",
                newName: "Room_ClearHeightM");

            migrationBuilder.RenameColumn(
                name: "Venue_StageOffsetXM",
                table: "ProjectVenues",
                newName: "Room_StageOffsetXM");

            migrationBuilder.RenameColumn(
                name: "Venue_BehindStageM",
                table: "ProjectVenues",
                newName: "Room_BehindStageM");

            migrationBuilder.RenameColumn(
                name: "Venue_RakeDeg",
                table: "ProjectVenues",
                newName: "Room_RakeDeg");

            migrationBuilder.RenameColumn(
                name: "Venue_PlanAttachmentId",
                table: "ProjectVenues",
                newName: "Room_PlanAttachmentId");

            migrationBuilder.RenameColumn(
                name: "Venue_PlanMetresPerPixel",
                table: "ProjectVenues",
                newName: "Room_PlanMetresPerPixel");

            migrationBuilder.RenameColumn(
                name: "Venue_PlanOriginXM",
                table: "ProjectVenues",
                newName: "Room_PlanOriginXM");

            migrationBuilder.RenameColumn(
                name: "Venue_PlanOriginZM",
                table: "ProjectVenues",
                newName: "Room_PlanOriginZM");

            migrationBuilder.RenameColumn(
                name: "Venue_PlanRotationDeg",
                table: "ProjectVenues",
                newName: "Room_PlanRotationDeg");

            migrationBuilder.RenameIndex(
                name: "IX_SitePlans_CompanyId_ProjectId",
                table: "ProjectVenues",
                newName: "IX_ProjectVenues_CompanyId_ProjectId");

            migrationBuilder.RenameIndex(
                name: "IX_SitePlans_ProjectId",
                table: "ProjectVenues",
                newName: "IX_ProjectVenues_ProjectId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ProjectVenues",
                table: "ProjectVenues",
                column: "Id");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ProjectVenues_Room_AllOrNothing",
                table: "ProjectVenues",
                sql: "([Room_WidthM] IS NULL AND [Room_DepthM] IS NULL AND [Room_ClearHeightM] IS NULL AND [Room_StageOffsetXM] IS NULL AND [Room_BehindStageM] IS NULL AND [Room_RakeDeg] IS NULL AND [Room_PlanOriginXM] IS NULL AND [Room_PlanOriginZM] IS NULL AND [Room_PlanRotationDeg] IS NULL) OR ([Room_WidthM] IS NOT NULL AND [Room_DepthM] IS NOT NULL AND [Room_ClearHeightM] IS NOT NULL AND [Room_StageOffsetXM] IS NOT NULL AND [Room_BehindStageM] IS NOT NULL AND [Room_RakeDeg] IS NOT NULL AND [Room_PlanOriginXM] IS NOT NULL AND [Room_PlanOriginZM] IS NOT NULL AND [Room_PlanRotationDeg] IS NOT NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectVenues_Companies_CompanyId",
                table: "ProjectVenues",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectVenues_Projects_ProjectId",
                table: "ProjectVenues",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);


            migrationBuilder.AddForeignKey(
                name: "FK_ProjectCrewMembers_Projects_ProjectId",
                table: "ProjectCrewMembers",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectCrewMembers_Users_UserId",
                table: "ProjectCrewMembers",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectEquipmentLines_Equipment_EquipmentId",
                table: "ProjectEquipmentLines",
                column: "EquipmentId",
                principalTable: "Equipment",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectEquipmentLines_Projects_ProjectId",
                table: "ProjectEquipmentLines",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProjectCrewMembers_Projects_ProjectId",
                table: "ProjectCrewMembers");

            migrationBuilder.DropForeignKey(
                name: "FK_ProjectCrewMembers_Users_UserId",
                table: "ProjectCrewMembers");

            migrationBuilder.DropForeignKey(
                name: "FK_ProjectEquipmentLines_Equipment_EquipmentId",
                table: "ProjectEquipmentLines");

            migrationBuilder.DropForeignKey(
                name: "FK_ProjectEquipmentLines_Projects_ProjectId",
                table: "ProjectEquipmentLines");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ProjectEquipmentLines",
                table: "ProjectEquipmentLines");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ProjectCrewMembers",
                table: "ProjectCrewMembers");

            migrationBuilder.RenameTable(
                name: "ProjectEquipmentLines",
                newName: "ProjectEquipment");

            migrationBuilder.RenameTable(
                name: "ProjectCrewMembers",
                newName: "ProjectCrew");

            migrationBuilder.RenameColumn(
                name: "VenueName",
                table: "Projects",
                newName: "Venue");

            migrationBuilder.RenameIndex(
                name: "IX_ProjectEquipmentLines_ProjectId",
                table: "ProjectEquipment",
                newName: "IX_ProjectEquipment_ProjectId");

            migrationBuilder.RenameIndex(
                name: "IX_ProjectEquipmentLines_EquipmentId",
                table: "ProjectEquipment",
                newName: "IX_ProjectEquipment_EquipmentId");

            migrationBuilder.RenameIndex(
                name: "IX_ProjectCrewMembers_UserId",
                table: "ProjectCrew",
                newName: "IX_ProjectCrew_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_ProjectCrewMembers_ProjectId_UserId",
                table: "ProjectCrew",
                newName: "IX_ProjectCrew_ProjectId_UserId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ProjectEquipment",
                table: "ProjectEquipment",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ProjectCrew",
                table: "ProjectCrew",
                column: "Id");

            migrationBuilder.DropForeignKey(
                name: "FK_ProjectVenues_Companies_CompanyId",
                table: "ProjectVenues");

            migrationBuilder.DropForeignKey(
                name: "FK_ProjectVenues_Projects_ProjectId",
                table: "ProjectVenues");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ProjectVenues",
                table: "ProjectVenues");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ProjectVenues_Room_AllOrNothing",
                table: "ProjectVenues");

            migrationBuilder.RenameTable(
                name: "ProjectVenues",
                newName: "SitePlans");

            migrationBuilder.RenameColumn(
                name: "Room_WidthM",
                table: "SitePlans",
                newName: "Venue_WidthM");

            migrationBuilder.RenameColumn(
                name: "Room_DepthM",
                table: "SitePlans",
                newName: "Venue_DepthM");

            migrationBuilder.RenameColumn(
                name: "Room_ClearHeightM",
                table: "SitePlans",
                newName: "Venue_ClearHeightM");

            migrationBuilder.RenameColumn(
                name: "Room_StageOffsetXM",
                table: "SitePlans",
                newName: "Venue_StageOffsetXM");

            migrationBuilder.RenameColumn(
                name: "Room_BehindStageM",
                table: "SitePlans",
                newName: "Venue_BehindStageM");

            migrationBuilder.RenameColumn(
                name: "Room_RakeDeg",
                table: "SitePlans",
                newName: "Venue_RakeDeg");

            migrationBuilder.RenameColumn(
                name: "Room_PlanAttachmentId",
                table: "SitePlans",
                newName: "Venue_PlanAttachmentId");

            migrationBuilder.RenameColumn(
                name: "Room_PlanMetresPerPixel",
                table: "SitePlans",
                newName: "Venue_PlanMetresPerPixel");

            migrationBuilder.RenameColumn(
                name: "Room_PlanOriginXM",
                table: "SitePlans",
                newName: "Venue_PlanOriginXM");

            migrationBuilder.RenameColumn(
                name: "Room_PlanOriginZM",
                table: "SitePlans",
                newName: "Venue_PlanOriginZM");

            migrationBuilder.RenameColumn(
                name: "Room_PlanRotationDeg",
                table: "SitePlans",
                newName: "Venue_PlanRotationDeg");

            migrationBuilder.RenameIndex(
                name: "IX_ProjectVenues_CompanyId_ProjectId",
                table: "SitePlans",
                newName: "IX_SitePlans_CompanyId_ProjectId");

            migrationBuilder.RenameIndex(
                name: "IX_ProjectVenues_ProjectId",
                table: "SitePlans",
                newName: "IX_SitePlans_ProjectId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_SitePlans",
                table: "SitePlans",
                column: "Id");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SitePlans_Venue_AllOrNothing",
                table: "SitePlans",
                sql: "([Venue_WidthM] IS NULL AND [Venue_DepthM] IS NULL AND [Venue_ClearHeightM] IS NULL AND [Venue_StageOffsetXM] IS NULL AND [Venue_BehindStageM] IS NULL AND [Venue_RakeDeg] IS NULL AND [Venue_PlanOriginXM] IS NULL AND [Venue_PlanOriginZM] IS NULL AND [Venue_PlanRotationDeg] IS NULL) OR ([Venue_WidthM] IS NOT NULL AND [Venue_DepthM] IS NOT NULL AND [Venue_ClearHeightM] IS NOT NULL AND [Venue_StageOffsetXM] IS NOT NULL AND [Venue_BehindStageM] IS NOT NULL AND [Venue_RakeDeg] IS NOT NULL AND [Venue_PlanOriginXM] IS NOT NULL AND [Venue_PlanOriginZM] IS NOT NULL AND [Venue_PlanRotationDeg] IS NOT NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_SitePlans_Companies_CompanyId",
                table: "SitePlans",
                column: "CompanyId",
                principalTable: "Companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SitePlans_Projects_ProjectId",
                table: "SitePlans",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);


            migrationBuilder.AddForeignKey(
                name: "FK_ProjectCrew_Projects_ProjectId",
                table: "ProjectCrew",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectCrew_Users_UserId",
                table: "ProjectCrew",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectEquipment_Equipment_EquipmentId",
                table: "ProjectEquipment",
                column: "EquipmentId",
                principalTable: "Equipment",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectEquipment_Projects_ProjectId",
                table: "ProjectEquipment",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
