namespace StageTrack.Sites;

/// <summary>
/// Ground measurements from latitude and longitude. A festival field is a few hundred metres across, so the Earth
/// is treated as flat over that patch and only the shrinking of longitude with latitude is corrected — that is
/// accurate to well under a metre at this size, which is the same order as the satellite imagery itself.
/// </summary>
public static class SiteGeometry
{
    private const double MetresPerDegreeLat = 111_320;

    /// <summary>Metres between two points on the ground.</summary>
    public static double DistanceM(SitePoint a, SitePoint b)
    {
        var (dx, dy) = Offset(a, b);
        return Math.Sqrt(dx * dx + dy * dy);
    }

    /// <summary>Total length of a route or a barrier, in metres.</summary>
    public static double LengthM(IReadOnlyList<SitePoint> points)
    {
        var total = 0d;
        for (var i = 1; i < points.Count; i++)
        {
            total += DistanceM(points[i - 1], points[i]);
        }

        return total;
    }

    /// <summary>
    /// Ground a closed shape covers, in square metres (the shoelace formula on the local flat projection).
    /// The shape closes itself: the last corner is joined back to the first.
    /// </summary>
    public static double AreaM2(IReadOnlyList<SitePoint> points)
    {
        if (points.Count < 3)
        {
            return 0;
        }

        var origin = points[0];
        var sum = 0d;
        for (var i = 0; i < points.Count; i++)
        {
            var (x1, y1) = Offset(origin, points[i]);
            var (x2, y2) = Offset(origin, points[(i + 1) % points.Count]);
            sum += (x1 * y2) - (x2 * y1);
        }

        return Math.Abs(sum) / 2;
    }

    /// <summary>Metres east and north of <paramref name="from"/>.</summary>
    private static (double X, double Y) Offset(SitePoint from, SitePoint to)
    {
        var midLat = (from.Lat + to.Lat) / 2 * Math.PI / 180;
        return ((to.Lng - from.Lng) * MetresPerDegreeLat * Math.Cos(midLat), (to.Lat - from.Lat) * MetresPerDegreeLat);
    }
}
