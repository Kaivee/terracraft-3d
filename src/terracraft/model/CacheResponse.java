package terracraft.model;

/** The payload returned by /api/cache/{id}. */
public class CacheResponse {
    public long id;
    public String locationName;
    public double lat;
    public double lon;
    public double[][] heightMatrix;
    public double minElev;
    public double maxElev;
    public boolean hasWater;
    public double autoWaterLevel;

    public CacheResponse(CachedTerrain cached) {
        this.id = cached.id();
        this.locationName = cached.locationName();
        this.lat = cached.lat();
        this.lon = cached.lon();
        this.heightMatrix = cached.heightMatrix();
        this.minElev = cached.minElev();
        this.maxElev = cached.maxElev();
        this.hasWater = cached.hasWater();
        this.autoWaterLevel = cached.autoWaterLevel();
    }
}
