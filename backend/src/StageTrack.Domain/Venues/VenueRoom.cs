namespace StageTrack.Venues;

/// <summary>
/// The room the job is built in. A satellite picture answers everything on an open field and nothing inside a
/// stadium: once the doors close, what decides where the stage goes is the hall - how wide it is, how deep, and
/// how much clear height there is under the roof steel.
///
/// Two ways to describe it, and a firm normally has both. The measurements are three numbers anyone can read off
/// a technical rider. The plan image is what the venue actually sends: its own layout drawing, scaled by pointing
/// at a distance that is known ("this line is 20 m"), which brings the columns, the doors and the seating bowl
/// into the design without anybody modelling a building.
///
/// Scene coordinates: x runs across the stage, z towards the audience, and the screens stand at z = 0 - the same
/// floor the 3D stage uses, so a venue entered here is the venue the design stands in.
/// </summary>
public class VenueRoom
{
    /// <summary>Across, metres.</summary>
    public double WidthM { get; private set; }

    /// <summary>From the back wall to the far end of the audience, metres.</summary>
    public double DepthM { get; private set; }

    /// <summary>
    /// Under the lowest thing the rig has to clear - roof steel, a catwalk, a scoreboard. The number that decides
    /// whether a nine-metre truss goes up at all.
    /// </summary>
    public double ClearHeightM { get; private set; }

    /// <summary>The stage centre off the room's centre line; 0 = dead centre.</summary>
    public double StageOffsetXM { get; private set; }

    /// <summary>From the podium's back edge to the back wall: the space the crew works in.</summary>
    public double BehindStageM { get; private set; } = 2;

    /// <summary>How steeply the seating rises, degrees; 0 = a flat floor.</summary>
    public double RakeDeg { get; private set; }

    /// <summary>The venue's own layout drawing, as an attachment of the job.</summary>
    public Guid? PlanAttachmentId { get; private set; }

    /// <summary>What one pixel of that drawing is worth on the ground; set by pointing at a known distance.</summary>
    public double? PlanMetresPerPixel { get; private set; }

    /// <summary>Where the drawing's top-left corner falls in scene metres, and how far it is turned.</summary>
    public double PlanOriginXM { get; private set; }

    public double PlanOriginZM { get; private set; }

    public double PlanRotationDeg { get; private set; }

    private VenueRoom()
    {
    }

    public VenueRoom(double widthM, double depthM, double clearHeightM)
    {
        SetSize(widthM, depthM, clearHeightM, 0, 2, 0);
    }

    public void SetSize(double widthM, double depthM, double clearHeightM, double stageOffsetXM, double behindStageM, double rakeDeg)
    {
        WidthM = Clamp(widthM, VenueConsts.MinRoomM, VenueConsts.MaxRoomM);
        DepthM = Clamp(depthM, VenueConsts.MinRoomM, VenueConsts.MaxRoomM);
        ClearHeightM = Clamp(clearHeightM, 0, VenueConsts.MaxHeightM);
        StageOffsetXM = Clamp(stageOffsetXM, -VenueConsts.MaxRoomM, VenueConsts.MaxRoomM);
        BehindStageM = Clamp(behindStageM, 0, VenueConsts.MaxRoomM);
        RakeDeg = Clamp(rakeDeg, 0, 45);
    }

    /// <summary>The drawing and what it is worth; metres per pixel null = it is there but not scaled yet.</summary>
    public void SetPlan(Guid? attachmentId, double? metresPerPixel, double originXM, double originZM, double rotationDeg)
    {
        PlanAttachmentId = attachmentId;
        PlanMetresPerPixel = metresPerPixel is > 0 and < 10 ? metresPerPixel : null;
        PlanOriginXM = Clamp(originXM, -VenueConsts.MaxRoomM, VenueConsts.MaxRoomM);
        PlanOriginZM = Clamp(originZM, -VenueConsts.MaxRoomM, VenueConsts.MaxRoomM);
        PlanRotationDeg = Clamp(rotationDeg, -360, 360);
    }

    private static double Clamp(double value, double min, double max) =>
        double.IsFinite(value) ? Math.Clamp(value, min, max) : min;
}
