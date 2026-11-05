using StageTrack.Entities;

namespace StageTrack.Venues;

/// <summary>
/// The venue a job is built in. One per job, like its quote.
///
/// This record was born as a site plan - equipment pinned on satellite imagery, zones drawn on the ground - and
/// that screen was removed once the work moved indoors, where a picture of a roof answers nothing. What was
/// worth keeping is the room itself: its measurements, the clear height the rig has to pass under, and the
/// venue's own drawing laid on the floor to scale. Those live in <see cref="Room"/>.
/// </summary>
public class ProjectVenue : CompanyAggregateRoot
{
    public Guid ProjectId { get; private set; }

    /// <summary>What the venue is called; the job's own venue name when nobody says otherwise.</summary>
    public string Name { get; private set; } = null!;

    /// <summary>
    /// The room the job is built in. Null until somebody enters it - a job outdoors has none, and a job nobody
    /// has measured yet has none either.
    /// </summary>
    public VenueRoom? Room { get; private set; }

    private ProjectVenue()
    {
    }

    public ProjectVenue(Guid id, Guid projectId, string name) : base(id)
    {
        ProjectId = projectId;
        Name = name.Trim();
    }

    public void Rename(string name) => Name = name.Trim();

    /// <summary>The room's measurements; the first call brings it into being, <see cref="RemoveRoom"/> takes it away.</summary>
    public VenueRoom SetRoom(double widthM, double depthM, double clearHeightM, double stageOffsetXM, double behindStageM, double rakeDeg)
    {
        Room ??= new VenueRoom(widthM, depthM, clearHeightM);
        Room.SetSize(widthM, depthM, clearHeightM, stageOffsetXM, behindStageM, rakeDeg);
        return Room;
    }

    public void RemoveRoom() => Room = null;

    public VenueRoom RoomOrThrow() => Room ?? throw new BusinessException(StageTrackErrorCodes.RoomNotSet);
}
