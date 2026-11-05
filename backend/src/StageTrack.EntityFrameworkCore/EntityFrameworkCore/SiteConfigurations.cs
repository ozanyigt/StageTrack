using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StageTrack.Projects;
using StageTrack.Sites;

namespace StageTrack.EntityFrameworkCore;

public class SitePlanConfiguration : IEntityTypeConfiguration<SitePlan>
{
    public void Configure(EntityTypeBuilder<SitePlan> b)
    {
        b.Property(x => x.Name).HasMaxLength(SiteConsts.MaxNameLength).IsRequired();

        // One room per job, like its quote.
        b.HasIndex(x => new { x.CompanyId, x.ProjectId }).IsUnique().HasFilter("[IsDeleted] = 0");
        b.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);

        // The room lives in the plan's own row: it is one set of numbers, never queried on its own.
        b.OwnsOne(x => x.Venue, v => v.ToTable("SitePlans"));
        b.Navigation(x => x.Venue).IsRequired(false);

        // Table splitting makes every venue column nullable, because a plan may have no room at all. What the
        // database cannot express that way is that they go together: a row with a width and no depth is legal
        // SQL and throws on the way back into C#. Either all of them or none.
        b.ToTable(t => t.HasCheckConstraint(
            "CK_SitePlans_Venue_AllOrNothing",
            "([Venue_WidthM] IS NULL AND [Venue_DepthM] IS NULL AND [Venue_ClearHeightM] IS NULL" +
            " AND [Venue_StageOffsetXM] IS NULL AND [Venue_BehindStageM] IS NULL AND [Venue_RakeDeg] IS NULL" +
            " AND [Venue_PlanOriginXM] IS NULL AND [Venue_PlanOriginZM] IS NULL AND [Venue_PlanRotationDeg] IS NULL)" +
            " OR ([Venue_WidthM] IS NOT NULL AND [Venue_DepthM] IS NOT NULL AND [Venue_ClearHeightM] IS NOT NULL" +
            " AND [Venue_StageOffsetXM] IS NOT NULL AND [Venue_BehindStageM] IS NOT NULL AND [Venue_RakeDeg] IS NOT NULL" +
            " AND [Venue_PlanOriginXM] IS NOT NULL AND [Venue_PlanOriginZM] IS NOT NULL AND [Venue_PlanRotationDeg] IS NOT NULL)"));
    }
}
