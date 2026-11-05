using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StageTrack.Projects;
using StageTrack.Venues;

namespace StageTrack.EntityFrameworkCore;

public class ProjectVenueConfiguration : IEntityTypeConfiguration<ProjectVenue>
{
    public void Configure(EntityTypeBuilder<ProjectVenue> b)
    {
        b.Property(x => x.Name).HasMaxLength(VenueConsts.MaxNameLength).IsRequired();

        // One venue per job, like its quote.
        b.HasIndex(x => new { x.CompanyId, x.ProjectId }).IsUnique().HasFilter("[IsDeleted] = 0");
        b.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);

        // The room lives in the venue's own row: it is one set of numbers, never queried on its own.
        b.OwnsOne(x => x.Room, v => v.ToTable("ProjectVenues"));
        b.Navigation(x => x.Room).IsRequired(false);

        // Table splitting makes every room column nullable, because a venue may have no measurements at all.
        // What the database cannot express that way is that they go together: a row with a width and no depth is
        // legal SQL and throws on the way back into C#. Either all of them or none.
        b.ToTable(t => t.HasCheckConstraint(
            "CK_ProjectVenues_Room_AllOrNothing",
            "([Room_WidthM] IS NULL AND [Room_DepthM] IS NULL AND [Room_ClearHeightM] IS NULL" +
            " AND [Room_StageOffsetXM] IS NULL AND [Room_BehindStageM] IS NULL AND [Room_RakeDeg] IS NULL" +
            " AND [Room_PlanOriginXM] IS NULL AND [Room_PlanOriginZM] IS NULL AND [Room_PlanRotationDeg] IS NULL)" +
            " OR ([Room_WidthM] IS NOT NULL AND [Room_DepthM] IS NOT NULL AND [Room_ClearHeightM] IS NOT NULL" +
            " AND [Room_StageOffsetXM] IS NOT NULL AND [Room_BehindStageM] IS NOT NULL AND [Room_RakeDeg] IS NOT NULL" +
            " AND [Room_PlanOriginXM] IS NOT NULL AND [Room_PlanOriginZM] IS NOT NULL AND [Room_PlanRotationDeg] IS NOT NULL)"));
    }
}
