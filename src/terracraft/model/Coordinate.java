package terracraft.model;

/** A validated latitude/longitude pair. */
public record Coordinate(double lat, double lon) {

    private static final double MAX_MERCATOR_LAT = 85.05112878;

    public Coordinate {
        if (!isValid(lat, lon)) {
            throw new IllegalArgumentException("Invalid coordinates: " + lat + ", " + lon);
        }
    }

    public static boolean isValid(double lat, double lon) {
        return Double.isFinite(lat) && Double.isFinite(lon)
            && lat >= -90 && lat <= 90
            && lon >= -180 && lon <= 180;
    }

    /** Latitude clamped to the Web Mercator limit, used for tile math. */
    public double mercatorLat() {
        return Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
    }
}
