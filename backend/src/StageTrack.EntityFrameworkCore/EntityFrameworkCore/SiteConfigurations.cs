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
    }
}
