package terracraft.model;

/** The payload returned by /api/search and /api/coords. */
public class SearchResult {
    public String location;
    public double lat;
    public double lon;
    public int gridSize;
    public double[][] heightMatrix;
    public double minElev;
    public double maxElev;
    public boolean hasWater;
    public double autoWaterLevel;
    public boolean cached;
    public int failedTileCount;

    public SearchResult(
        String location,
        double lat,
        double lon,
        int gridSize,
        double[][] heightMatrix,
        double minElev,
        double maxElev,
        boolean hasWater,
        double autoWaterLevel,
        boolean cached,
        int failedTileCount
    ) {
        this.location = location;
        this.lat = lat;
        this.lon = lon;
        this.gridSize = gridSize;
        this.heightMatrix = heightMatrix;
        this.minElev = minElev;
        this.maxElev = maxElev;
        this.hasWater = hasWater;
        this.autoWaterLevel = autoWaterLevel;
        this.cached = cached;
        this.failedTileCount = failedTileCount;
    }
}
